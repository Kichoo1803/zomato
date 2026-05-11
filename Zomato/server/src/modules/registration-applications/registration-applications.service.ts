import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import path from "node:path";
import { env } from "../../config/env.js";
import { DeliveryAvailabilityStatus, NotificationType, Role } from "../../constants/enums.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { buildPublicUploadUrl } from "../../lib/uploads.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { resolveRegionIdForAssignment } from "../regions/regions.service.js";
import { slugify } from "../../utils/slug.js";
import { AppError } from "../../utils/app-error.js";
import {
  applyRegionalReadScope,
  assertRegionalRecordScope,
  ensureAssignedRegionalAccess,
  getRegionalAccessState,
} from "../../utils/regional-access.js";
import {
  getIndianPhoneSearchVariants,
  normalizeIndianPhoneNumber,
} from "../../utils/phone.js";
import {
  normalizeLicenseNumber,
  normalizeVehicleNumber,
} from "../../utils/vehicle.js";
import {
  RegistrationApplicationPayoutMethod,
  RegistrationApplicationRoleType,
  RegistrationApplicationStatus,
} from "./registration-applications.constants.js";

type ApplicationActor = {
  id: number;
  role: Role;
};

type RequestContext = {
  endpoint?: string;
};

type RegistrationApplicationFiles = Record<string, Express.Multer.File[] | undefined>;
type RegistrationApplicationClient = Prisma.TransactionClient | typeof prisma;

type UploadedAsset = {
  fieldName: string;
  label: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  uploadedAt: string;
};

type ApplicationDocumentsSnapshot = {
  fssaiCertificate?: UploadedAsset | null;
  idProof?: UploadedAsset | null;
  restaurantImages?: UploadedAsset[];
  drivingLicense?: UploadedAsset | null;
  profilePhoto?: UploadedAsset | null;
};

type PayoutDetailsSnapshot = {
  method: string;
  accountHolderName?: string | null;
  bankName?: string | null;
  accountNumberLast4?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
};

const registrationApplicationSelect = {
  id: true,
  roleType: true,
  fullName: true,
  email: true,
  phone: true,
  alternatePhone: true,
  addressLine: true,
  state: true,
  district: true,
  pincode: true,
  regionId: true,
  restaurantName: true,
  restaurantAddress: true,
  fssaiCertificateNumber: true,
  idProofType: true,
  idProofNumber: true,
  vehicleType: true,
  vehicleNumber: true,
  drivingLicenseNumber: true,
  payoutDetails: true,
  documents: true,
  status: true,
  assignedRegionalManagerId: true,
  reviewedById: true,
  approvedUserId: true,
  reviewRemarks: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  region: {
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      stateName: true,
      districtName: true,
      managerUserId: true,
      manager: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  },
  assignedRegionalManager: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
  approvedUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.RegistrationApplicationSelect;

type RegistrationApplicationRecord = Prisma.RegistrationApplicationGetPayload<{
  select: typeof registrationApplicationSelect;
}>;

const registrationApplicationPermissionSelect = {
  id: true,
  roleType: true,
  status: true,
  regionId: true,
  state: true,
  district: true,
  assignedRegionalManagerId: true,
  approvedUserId: true,
  region: {
    select: {
      managerUserId: true,
    },
  },
} satisfies Prisma.RegistrationApplicationSelect;

const registrationApplicationApprovalSelect = {
  id: true,
  roleType: true,
  fullName: true,
  email: true,
  phone: true,
  alternatePhone: true,
  passwordHash: true,
  addressLine: true,
  state: true,
  district: true,
  pincode: true,
  regionId: true,
  restaurantName: true,
  restaurantAddress: true,
  fssaiCertificateNumber: true,
  idProofType: true,
  documents: true,
  vehicleType: true,
  vehicleNumber: true,
  drivingLicenseNumber: true,
  approvedUserId: true,
  status: true,
} satisfies Prisma.RegistrationApplicationSelect;

type RegistrationApplicationPermissionRecord = Prisma.RegistrationApplicationGetPayload<{
  select: typeof registrationApplicationPermissionSelect;
}>;

type RegistrationApplicationApprovalContext = Prisma.RegistrationApplicationGetPayload<{
  select: typeof registrationApplicationApprovalSelect;
}>;

const parseSnapshot = <T>(value?: string | null): T | null => {
  if (!value?.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const serializeSnapshot = (value?: Record<string, unknown> | null) =>
  value ? JSON.stringify(value) : null;

const toUploadedAsset = (
  file: Express.Multer.File,
  label: string,
  baseUrl: string,
): UploadedAsset => ({
  fieldName: file.fieldname,
  label,
  originalName: file.originalname,
  mimeType: file.mimetype,
  size: file.size,
  fileUrl: buildPublicUploadUrl(baseUrl, "registration-applications", path.basename(file.filename)),
  uploadedAt: new Date().toISOString(),
});

const getSingleFile = (
  files: RegistrationApplicationFiles,
  fieldName: string,
  label: string,
  baseUrl: string,
  {
    required = true,
  }: {
    required?: boolean;
  } = {},
) => {
  const file = files[fieldName]?.[0];

  if (!file) {
    if (!required) {
      return null;
    }

    throw new AppError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${label} is required`,
      "REQUIRED_UPLOAD_MISSING",
      { field: fieldName },
    );
  }

  return toUploadedAsset(file, label, baseUrl);
};

const getMultiFiles = (
  files: RegistrationApplicationFiles,
  fieldName: string,
  label: string,
  baseUrl: string,
  minimumCount = 1,
) => {
  const uploadedFiles = files[fieldName] ?? [];

  if (uploadedFiles.length < minimumCount) {
    throw new AppError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${label} is required`,
      "REQUIRED_UPLOAD_MISSING",
      { field: fieldName },
    );
  }

  return uploadedFiles.map((file) => toUploadedAsset(file, label, baseUrl));
};

const buildDocumentsSnapshot = (
  roleType: string,
  files: RegistrationApplicationFiles,
  baseUrl: string,
): ApplicationDocumentsSnapshot => {
  if (roleType === RegistrationApplicationRoleType.RESTAURANT_OWNER) {
    return {
      fssaiCertificate: getSingleFile(files, "fssaiCertificate", "FSSAI certificate", baseUrl),
      idProof: getSingleFile(files, "idProof", "ID proof", baseUrl),
      restaurantImages: getMultiFiles(files, "restaurantImages", "Restaurant image", baseUrl),
    };
  }

  return {
    drivingLicense: getSingleFile(files, "drivingLicense", "Driving license", baseUrl),
    idProof: getSingleFile(files, "idProof", "ID proof", baseUrl),
    profilePhoto: getSingleFile(files, "profilePhoto", "Profile photo", baseUrl),
  };
};

const buildPayoutDetailsSnapshot = (input: {
  payoutMethod?: string;
  accountHolderName?: string;
  bankName?: string;
  accountNumberLast4?: string;
  ifscCode?: string;
  upiId?: string;
}) => {
  if (!input.payoutMethod) {
    return null;
  }

  return {
    method: input.payoutMethod,
    accountHolderName: input.accountHolderName?.trim() || null,
    bankName: input.bankName?.trim() || null,
    accountNumberLast4: input.accountNumberLast4?.trim() || null,
    ifscCode: input.ifscCode?.trim().toUpperCase() || null,
    upiId: input.upiId?.trim() || null,
  } satisfies PayoutDetailsSnapshot;
};

const mapRegistrationApplication = (application: RegistrationApplicationRecord) => ({
  ...application,
  assignedRegionalManagerId:
    application.region?.manager?.id ?? application.assignedRegionalManagerId ?? null,
  assignedRegionalManager:
    application.region?.manager ?? application.assignedRegionalManager ?? null,
  payoutDetails: parseSnapshot<PayoutDetailsSnapshot>(application.payoutDetails),
  documents: parseSnapshot<ApplicationDocumentsSnapshot>(application.documents),
  routingTarget: application.region?.manager?.id ? "REGIONAL_MANAGER" : "ADMIN",
});

const buildRegionSearchClause = (search: string): Prisma.RegistrationApplicationWhereInput => ({
  OR: [
    { state: { contains: search } },
    { district: { contains: search } },
    { restaurantName: { contains: search } },
    { vehicleNumber: { contains: search } },
    { idProofNumber: { contains: search } },
    {
      region: {
        OR: [
          { name: { contains: search } },
          { stateName: { contains: search } },
          { districtName: { contains: search } },
        ],
      },
    },
  ],
});

const ensureNoIdentityConflicts = async (
  client: Prisma.TransactionClient | typeof prisma,
  input: {
    email: string;
    phone: string;
    alternatePhone?: string;
    excludeApplicationId?: number;
  },
) => {
  const phoneCandidates = [...new Set([input.phone, input.alternatePhone].flatMap((value) => getIndianPhoneSearchVariants(value)))];

  const existingUser = await client.user.findFirst({
    where: {
      OR: [
        { email: input.email },
        ...phoneCandidates.map((value) => ({ phone: value })),
      ],
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "An account with these details already exists",
      "ACCOUNT_ALREADY_EXISTS",
    );
  }

  const existingPendingApplication = await client.registrationApplication.findFirst({
    where: {
      status: RegistrationApplicationStatus.PENDING,
      ...(input.excludeApplicationId
        ? {
            NOT: {
              id: input.excludeApplicationId,
            },
          }
        : {}),
      OR: [
        { email: input.email },
        ...phoneCandidates.flatMap((value) => [{ phone: value }, { alternatePhone: value }]),
      ],
    },
    select: {
      id: true,
    },
  });

  if (existingPendingApplication) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "A pending partner application already exists for these details",
      "REGISTRATION_APPLICATION_ALREADY_EXISTS",
    );
  }
};

const ensureFssaiNumberAvailable = async (
  client: Prisma.TransactionClient | typeof prisma,
  fssaiCertificateNumber?: string | null,
  excludeApplicationId?: number,
) => {
  const normalizedCertificateNumber = fssaiCertificateNumber?.trim();

  if (!normalizedCertificateNumber) {
    return;
  }

  const [existingRestaurant, existingPendingOwnerApplication] = await Promise.all([
    client.restaurant.findFirst({
      where: {
        licenseNumber: normalizedCertificateNumber,
      },
      select: {
        id: true,
      },
    }),
    client.registrationApplication.findFirst({
      where: {
        roleType: RegistrationApplicationRoleType.RESTAURANT_OWNER,
        status: RegistrationApplicationStatus.PENDING,
        fssaiCertificateNumber: normalizedCertificateNumber,
        ...(excludeApplicationId
          ? {
              NOT: {
                id: excludeApplicationId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (existingRestaurant || existingPendingOwnerApplication) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "This FSSAI certificate number is already linked to another registration",
      "FSSAI_CERTIFICATE_ALREADY_USED",
    );
  }
};

const notifyAdmins = async (application: RegistrationApplicationRecord) => {
  const admins = await prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  await Promise.all(
    admins.map((admin) =>
      notificationsService.createForUser({
        userId: admin.id,
        title: `${application.roleType === Role.RESTAURANT_OWNER ? "Restaurant owner" : "Delivery partner"} application pending`,
        message: `${application.fullName} submitted a ${application.roleType === Role.RESTAURANT_OWNER ? "restaurant owner" : "delivery partner"} registration for ${application.district}, ${application.state}.`,
        type: NotificationType.SYSTEM,
        meta: {
          eventKey: "registration-application:pending",
          registrationApplicationId: application.id,
          path: "/admin/applications",
        },
        dedupeWindowMinutes: 15,
      }),
    ),
  );
};

const notifyAssignedRegionalManager = async (application: RegistrationApplicationRecord) => {
  const regionalManager = application.region?.manager;

  if (!regionalManager?.id || !regionalManager.isActive) {
    return;
  }

  await notificationsService.createForUser({
    userId: regionalManager.id,
    title: `${application.roleType === Role.RESTAURANT_OWNER ? "Restaurant owner" : "Delivery partner"} application pending`,
    message: `${application.fullName} submitted a new application in your assigned region ${application.region?.districtName}, ${application.region?.stateName}.`,
    type: NotificationType.SYSTEM,
    meta: {
      eventKey: "registration-application:pending",
      registrationApplicationId: application.id,
      path: "/ops/applications",
    },
    dedupeWindowMinutes: 15,
  });
};

const getTargetRoleForApplication = (
  roleType: string,
): Role =>
  roleType === RegistrationApplicationRoleType.RESTAURANT_OWNER
    ? Role.RESTAURANT_OWNER
    : Role.DELIVERY_PARTNER;

const getApplicationPhoneCandidates = (application: {
  phone: string;
  alternatePhone?: string | null;
}) =>
  [
    ...new Set(
      [application.phone, application.alternatePhone ?? undefined]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => getIndianPhoneSearchVariants(value)),
    ),
  ];

const loadRegistrationApplicationForResponse = async (applicationId: number) => {
  const application = await prisma.registrationApplication.findUnique({
    where: { id: applicationId },
    select: registrationApplicationSelect,
  });

  if (!application) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "Registration application not found",
      "REGISTRATION_APPLICATION_NOT_FOUND",
    );
  }

  return application;
};

const loadRegistrationApplicationApprovalContext = async (
  client: RegistrationApplicationClient,
  applicationId: number,
) => {
  const application = await client.registrationApplication.findUnique({
    where: { id: applicationId },
    select: registrationApplicationApprovalSelect,
  });

  if (!application) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "Registration application not found",
      "REGISTRATION_APPLICATION_NOT_FOUND",
    );
  }

  return application;
};

const serializeReviewError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return {
      message: "Unknown error",
    };
  }

  const serialized = {
    name: error.name,
    message: error.message,
    ...(error instanceof AppError ? { appCode: error.code } : {}),
  } as {
    name: string;
    message: string;
    appCode?: string;
    prismaCode?: string;
  };

  if (
    error.name === "PrismaClientKnownRequestError" &&
    typeof (error as unknown as { code?: unknown }).code === "string"
  ) {
    serialized.prismaCode = (error as unknown as { code: string }).code;
  }

  return serialized;
};

const logApplicationReviewEvent = (
  phase: "started" | "completed" | "failed",
  payload: {
    applicationId: number;
    applicationType: string;
    reviewerId: number;
    reviewerRole: Role;
    action: "APPROVE" | "REJECT";
    previousStatus: string;
    nextStatus?: string;
    durationMs?: number;
    error?: unknown;
  },
) => {
  if (!env.isDevelopment) {
    return;
  }

  const basePayload = {
    applicationId: payload.applicationId,
    applicationType: payload.applicationType,
    reviewerId: payload.reviewerId,
    reviewerRole: payload.reviewerRole,
    action: payload.action,
    previousStatus: payload.previousStatus,
    nextStatus: payload.nextStatus ?? payload.previousStatus,
    durationMs: payload.durationMs ?? null,
  };

  if (phase === "failed") {
    logger.error("Registration application review failed", {
      ...basePayload,
      error: serializeReviewError(payload.error),
    });
    return;
  }

  logger.info(
    phase === "started"
      ? "Registration application review started"
      : "Registration application review completed",
    basePayload,
  );
};

const runPostReviewNotification = async (
  operation: () => Promise<void>,
  context: {
    applicationId: number;
    action: "APPROVE" | "REJECT";
  },
) => {
  try {
    await operation();
  } catch (error) {
    if (env.isDevelopment) {
      logger.warn("Registration application notification failed after review", {
        applicationId: context.applicationId,
        action: context.action,
        error: serializeReviewError(error),
      });
    }
  }
};

const notifyApplicantAboutApproval = async (application: RegistrationApplicationRecord) => {
  if (!application.approvedUser?.id) {
    return;
  }

  await runPostReviewNotification(
    () =>
      notificationsService.createForUser({
        userId: application.approvedUser!.id,
        title: "Registration approved",
        message:
          application.roleType === Role.RESTAURANT_OWNER
            ? "Your restaurant owner onboarding has been approved. You can now sign in and complete your restaurant setup."
            : "Your delivery partner onboarding has been approved. You can now sign in and start using the delivery dashboard.",
        type: NotificationType.SYSTEM,
        meta: {
          eventKey: "registration-application:approved",
          registrationApplicationId: application.id,
          path:
            application.roleType === Role.RESTAURANT_OWNER
              ? "/owner/dashboard"
              : "/delivery",
        },
        dedupeWindowMinutes: 15,
      }).then(() => undefined),
    {
      applicationId: application.id,
      action: "APPROVE",
    },
  );
};

const notifyApplicantAboutRejection = async (application: RegistrationApplicationRecord) => {
  if (!application.approvedUser?.id) {
    return;
  }

  await runPostReviewNotification(
    () =>
      notificationsService.createForUser({
        userId: application.approvedUser!.id,
        title: "Registration rejected",
        message:
          application.reviewRemarks?.trim() ||
          "Your onboarding application was rejected. Review the remarks and contact support if needed.",
        type: NotificationType.SYSTEM,
        meta: {
          eventKey: "registration-application:rejected",
          registrationApplicationId: application.id,
          path: "/support",
        },
        dedupeWindowMinutes: 15,
      }).then(() => undefined),
    {
      applicationId: application.id,
      action: "REJECT",
    },
  );
};

const buildScopedWhere = async (
  actor: ApplicationActor,
  filters?: {
    search?: string;
    roleType?: string;
    status?: string;
    regionId?: number;
    state?: string;
    district?: string;
    createdFrom?: string;
    createdTo?: string;
    unassignedOnly?: boolean;
  },
  context?: RequestContext,
): Promise<Prisma.RegistrationApplicationWhereInput> => {
  const access = await getRegionalAccessState(actor);
  const scopedRegionFilters = access.isRestricted
    ? applyRegionalReadScope(
        access,
        {
          regionId: filters?.regionId,
          state: filters?.state,
          district: filters?.district,
        },
        {
          actor,
          endpoint: context?.endpoint,
        },
      )
    : {
        regionId: filters?.regionId,
        state: filters?.state,
        district: filters?.district,
      };
  const search = filters?.search?.trim();
  const clauses: Prisma.RegistrationApplicationWhereInput[] = [];

  if (filters?.roleType) {
    clauses.push({ roleType: filters.roleType });
  }

  if (filters?.status) {
    clauses.push({ status: filters.status });
  }

  if (scopedRegionFilters.regionId) {
    clauses.push({ regionId: scopedRegionFilters.regionId });
  }

  if (scopedRegionFilters.state) {
    clauses.push({ state: scopedRegionFilters.state });
  }

  if (scopedRegionFilters.district) {
    clauses.push({ district: scopedRegionFilters.district });
  }

  if (filters?.createdFrom || filters?.createdTo) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (filters.createdFrom) {
      createdAt.gte = new Date(`${filters.createdFrom}T00:00:00.000Z`);
    }

    if (filters.createdTo) {
      createdAt.lte = new Date(`${filters.createdTo}T23:59:59.999Z`);
    }

    clauses.push({ createdAt });
  }

  if (search) {
    clauses.push({
      OR: [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { alternatePhone: { contains: search } },
        { addressLine: { contains: search } },
        buildRegionSearchClause(search),
      ],
    });
  }

  if (access.isRestricted) {
    if (!access.assignedRegion?.regionId) {
      clauses.push({ regionId: -1 });
    } else {
      clauses.push({ regionId: access.assignedRegion.regionId });
    }

    clauses.push({
      region: {
        is: {
          managerUserId: actor.id,
        },
      },
    });
  }

  if (filters?.unassignedOnly) {
    clauses.push({
      OR: [{ regionId: null }, { region: { is: { managerUserId: null } } }],
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const ensureApplicationVisibleToActor = async (
  actor: ApplicationActor,
  applicationId: number,
  context?: RequestContext,
) => {
  const access = await getRegionalAccessState(actor);
  const application = await prisma.registrationApplication.findUnique({
    where: { id: applicationId },
    select: registrationApplicationPermissionSelect,
  });

  if (!application) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "Registration application not found",
      "REGISTRATION_APPLICATION_NOT_FOUND",
    );
  }

  if (access.isRestricted) {
    ensureAssignedRegionalAccess(access, {
      actor,
      endpoint: context?.endpoint,
      requestedRegion: {
        regionId: application.regionId,
        state: application.state,
        district: application.district,
      },
    });

    assertRegionalRecordScope(
      access,
      {
        regionId: application.regionId,
        state: application.state,
        district: application.district,
      },
      {
        actor,
        endpoint: context?.endpoint,
      },
    );

    if (application.region?.managerUserId !== actor.id) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "You can only review applications assigned to your region",
        "ACCESS_DENIED",
      );
    }
  }

  return application;
};

const generateUniqueRestaurantSlug = async (
  client: RegistrationApplicationClient,
  restaurantName: string,
) => {
  const baseSlug = slugify(restaurantName);
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await client.restaurant.findFirst({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const ensureNoOtherPendingApplicationConflicts = async (
  client: RegistrationApplicationClient,
  application: RegistrationApplicationApprovalContext,
) => {
  const phoneCandidates = getApplicationPhoneCandidates(application);

  const conflictingApplication = await client.registrationApplication.findFirst({
    where: {
      status: RegistrationApplicationStatus.PENDING,
      NOT: {
        id: application.id,
      },
      OR: [
        { email: application.email },
        ...phoneCandidates.flatMap((value) => [{ phone: value }, { alternatePhone: value }]),
      ],
    },
    select: {
      id: true,
    },
  });

  if (conflictingApplication) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "A pending registration with the same email or phone still needs review",
      "REGISTRATION_APPLICATION_ALREADY_EXISTS",
    );
  }

  if (
    application.roleType === RegistrationApplicationRoleType.RESTAURANT_OWNER &&
    application.fssaiCertificateNumber?.trim()
  ) {
    const conflictingFssaiApplication = await client.registrationApplication.findFirst({
      where: {
        id: {
          not: application.id,
        },
        roleType: RegistrationApplicationRoleType.RESTAURANT_OWNER,
        status: RegistrationApplicationStatus.PENDING,
        fssaiCertificateNumber: application.fssaiCertificateNumber.trim(),
      },
      select: {
        id: true,
      },
    });

    if (conflictingFssaiApplication) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This FSSAI certificate is already linked to another pending application",
        "FSSAI_CERTIFICATE_ALREADY_USED",
      );
    }
  }
};

const loadExistingApprovedUserForApplication = async (
  client: RegistrationApplicationClient,
  application: RegistrationApplicationApprovalContext,
) => {
  const targetRole = getTargetRoleForApplication(application.roleType);

  if (application.approvedUserId) {
    const approvedUser = await client.user.findUnique({
      where: {
        id: application.approvedUserId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (approvedUser) {
      if (approvedUser.role !== targetRole) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "The approved account linked to this application uses a different role",
          "REGISTRATION_APPLICATION_ACCOUNT_CONFLICT",
        );
      }

      return approvedUser;
    }
  }

  const phoneCandidates = getApplicationPhoneCandidates(application);
  const existingUser = await client.user.findFirst({
    where: {
      OR: [
        { email: application.email },
        ...phoneCandidates.map((value) => ({ phone: value })),
      ],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  if (!existingUser) {
    return null;
  }

  if (existingUser.role !== targetRole) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "An account with this email or phone already exists under another role",
      "ACCOUNT_ALREADY_EXISTS",
    );
  }

  return existingUser;
};

const ensureApprovedUserForApplication = async (
  client: RegistrationApplicationClient,
  application: RegistrationApplicationApprovalContext,
) => {
  const targetRole = getTargetRoleForApplication(application.roleType);
  const normalizedPhone = normalizeIndianPhoneNumber(application.phone) ?? application.phone;
  const documents = parseSnapshot<ApplicationDocumentsSnapshot>(application.documents);
  const profileImage =
    application.roleType === RegistrationApplicationRoleType.DELIVERY_PARTNER
      ? documents?.profilePhoto?.fileUrl ?? null
      : null;
  const existingUser = await loadExistingApprovedUserForApplication(client, application);

  if (existingUser) {
    return client.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        fullName: application.fullName,
        email: application.email,
        phone: normalizedPhone,
        ...(profileImage !== null ? { profileImage } : {}),
        role: targetRole,
        regionId: application.regionId,
        opsState: application.state,
        opsDistrict: application.district,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
  }

  return client.user.upsert({
    where: {
      email: application.email,
    },
    update: {
      fullName: application.fullName,
      phone: normalizedPhone,
      ...(profileImage !== null ? { profileImage } : {}),
      role: targetRole,
      regionId: application.regionId,
      opsState: application.state,
      opsDistrict: application.district,
      isActive: true,
    },
    create: {
      fullName: application.fullName,
      email: application.email,
      phone: normalizedPhone,
      ...(profileImage !== null ? { profileImage } : {}),
      passwordHash: application.passwordHash,
      role: targetRole,
      regionId: application.regionId,
      opsState: application.state,
      opsDistrict: application.district,
      isActive: true,
      emailVerified: false,
      phoneVerified: false,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });
};

const ensureApprovedRestaurantForApplication = async (
  client: RegistrationApplicationClient,
  application: RegistrationApplicationApprovalContext,
  userId: number,
) => {
  const restaurantName =
    application.restaurantName?.trim() || `${application.fullName}'s Kitchen`;
  const restaurantAddress =
    application.restaurantAddress?.trim() || application.addressLine.trim();
  const normalizedPhone = normalizeIndianPhoneNumber(application.phone) ?? application.phone;
  const normalizedLicenseNumber =
    application.fssaiCertificateNumber?.trim() || null;
  const documents = parseSnapshot<ApplicationDocumentsSnapshot>(application.documents);
  const matchingRestaurant = await client.restaurant.findFirst({
    where: {
      ownerId: userId,
      OR: [
        { name: restaurantName },
        { addressLine: restaurantAddress },
        ...(normalizedLicenseNumber ? [{ licenseNumber: normalizedLicenseNumber }] : []),
      ],
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (normalizedLicenseNumber) {
    const conflictingRestaurant = await client.restaurant.findFirst({
      where: {
        licenseNumber: normalizedLicenseNumber,
        ownerId: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (conflictingRestaurant) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This FSSAI certificate is already linked to another restaurant",
        "FSSAI_CERTIFICATE_ALREADY_USED",
      );
    }
  }

  if (matchingRestaurant) {
    await client.restaurant.update({
      where: {
        id: matchingRestaurant.id,
      },
      data: {
        ownerId: userId,
        regionId: application.regionId,
        name: restaurantName,
        description: "Created from a partner onboarding approval.",
        email: application.email,
        phone: normalizedPhone,
        coverImage: documents?.restaurantImages?.[0]?.fileUrl ?? null,
        licenseNumber: normalizedLicenseNumber,
        addressLine: restaurantAddress,
        area: application.district,
        city: application.district,
        state: application.state,
        pincode: application.pincode,
      },
    });

    return matchingRestaurant.id;
  }

  const restaurantSlug = await generateUniqueRestaurantSlug(client, restaurantName);
  const createdRestaurant = await client.restaurant.create({
    data: {
      ownerId: userId,
      regionId: application.regionId,
      name: restaurantName,
      slug: restaurantSlug,
      description: "Created from a partner onboarding approval.",
      email: application.email,
      phone: normalizedPhone,
      coverImage: documents?.restaurantImages?.[0]?.fileUrl ?? null,
      licenseNumber: normalizedLicenseNumber,
      addressLine: restaurantAddress,
      area: application.district,
      city: application.district,
      state: application.state,
      pincode: application.pincode,
      isActive: false,
    },
    select: {
      id: true,
    },
  });

  return createdRestaurant.id;
};

const ensureApprovedDeliveryPartnerProfile = async (
  client: RegistrationApplicationClient,
  application: RegistrationApplicationApprovalContext,
  userId: number,
) => {
  const vehicleNumber = normalizeVehicleNumber(application.vehicleNumber);
  const licenseNumber = normalizeLicenseNumber(application.drivingLicenseNumber);
  const partner = await client.deliveryPartner.upsert({
    where: {
      userId,
    },
    update: {
      vehicleType: application.vehicleType?.trim() || "BIKE",
      vehicleNumber: vehicleNumber ?? null,
      licenseNumber: licenseNumber ?? null,
      isVerified: true,
    },
    create: {
      userId,
      vehicleType: application.vehicleType?.trim() || "BIKE",
      vehicleNumber: vehicleNumber ?? null,
      licenseNumber: licenseNumber ?? null,
      availabilityStatus: DeliveryAvailabilityStatus.OFFLINE,
      isVerified: true,
    },
    select: {
      id: true,
    },
  });

  const documents = parseSnapshot<ApplicationDocumentsSnapshot>(application.documents);
  const deliveryDocuments = [
    ...(documents?.drivingLicense
      ? [
          {
            name: "Driving license",
            fileUrl: documents.drivingLicense.fileUrl,
          },
        ]
      : []),
    ...(documents?.idProof
      ? [
          {
            name: `${application.idProofType} ID proof`,
            fileUrl: documents.idProof.fileUrl,
          },
        ]
      : []),
  ];

  if (deliveryDocuments.length) {
    const existingDocuments = await client.deliveryDocument.findMany({
      where: {
        deliveryPartnerId: partner.id,
      },
      select: {
        name: true,
        fileUrl: true,
      },
    });

    const newDocuments = deliveryDocuments.filter(
      (document) =>
        !existingDocuments.some(
          (existingDocument) =>
            existingDocument.name === document.name &&
            existingDocument.fileUrl === document.fileUrl,
        ),
    );

    if (newDocuments.length) {
      await client.deliveryDocument.createMany({
        data: newDocuments.map((document) => ({
          deliveryPartnerId: partner.id,
          name: document.name,
          fileUrl: document.fileUrl,
          status: RegistrationApplicationStatus.APPROVED,
          reviewedAt: new Date(),
        })),
      });
    }
  }

  return partner.id;
};

const ensureApprovedAccountForApplication = async (
  client: RegistrationApplicationClient,
  application: RegistrationApplicationApprovalContext,
  options?: {
    skipPendingConflictChecks?: boolean;
  },
) => {
  if (!options?.skipPendingConflictChecks) {
    await ensureNoOtherPendingApplicationConflicts(client, application);
  }

  const approvedUser = await ensureApprovedUserForApplication(client, application);

  if (application.roleType === RegistrationApplicationRoleType.RESTAURANT_OWNER) {
    await ensureApprovedRestaurantForApplication(client, application, approvedUser.id);
  } else {
    await ensureApprovedDeliveryPartnerProfile(client, application, approvedUser.id);
  }

  return approvedUser;
};

const finalizeApprovedApplication = async (
  applicationId: number,
  options?: {
    skipPendingConflictChecks?: boolean;
  },
) => {
  const application = await loadRegistrationApplicationApprovalContext(prisma, applicationId);
  const approvedUser = await ensureApprovedAccountForApplication(prisma, application, options);

  if (application.approvedUserId !== approvedUser.id) {
    await prisma.registrationApplication.update({
      where: {
        id: applicationId,
      },
      data: {
        approvedUserId: approvedUser.id,
      },
    });
  }

  return loadRegistrationApplicationForResponse(applicationId);
};

const loadApprovedApplicationWithRepair = async (applicationId: number) => {
  const application = await loadRegistrationApplicationForResponse(applicationId);

  if (
    application.status !== RegistrationApplicationStatus.APPROVED ||
    application.approvedUserId
  ) {
    return application;
  }

  try {
    return await finalizeApprovedApplication(applicationId, {
      skipPendingConflictChecks: true,
    });
  } catch (error) {
    if (env.isDevelopment) {
      logger.warn("Registration application approval repair failed", {
        applicationId,
        error: serializeReviewError(error),
      });
    }

    return application;
  }
};

export const registrationApplicationsService = {
  async submitRestaurantOwnerApplication(
    input: {
      fullName: string;
      email: string;
      phone: string;
      alternatePhone?: string;
      password: string;
      restaurantName: string;
      restaurantAddress: string;
      state: string;
      district: string;
      pincode: string;
      fssaiCertificateNumber: string;
      idProofType: string;
      idProofNumber: string;
      payoutMethod?: string;
      accountHolderName?: string;
      bankName?: string;
      accountNumberLast4?: string;
      ifscCode?: string;
      upiId?: string;
    },
    files: RegistrationApplicationFiles,
    baseUrl: string,
  ) {
    const email = input.email.trim().toLowerCase();
    const phone = normalizeIndianPhoneNumber(input.phone) ?? input.phone.trim();
    const alternatePhone =
      normalizeIndianPhoneNumber(input.alternatePhone) ?? (input.alternatePhone?.trim() || null);
    const documents = buildDocumentsSnapshot(
      RegistrationApplicationRoleType.RESTAURANT_OWNER,
      files,
      baseUrl,
    );
    const payoutDetails = buildPayoutDetailsSnapshot(input);

    await ensureNoIdentityConflicts(prisma, {
      email,
      phone,
      alternatePhone: alternatePhone ?? undefined,
    });
    await ensureFssaiNumberAvailable(prisma, input.fssaiCertificateNumber);

    const passwordHash = await bcrypt.hash(input.password, 12);
    const region = await resolveRegionIdForAssignment(prisma, input.state, input.district);
    const regionAssignment =
      region?.id != null
        ? await prisma.region.findUnique({
            where: { id: region.id },
            select: {
              id: true,
              managerUserId: true,
            },
          })
        : null;
    const application = await prisma.registrationApplication.create({
      data: {
        roleType: RegistrationApplicationRoleType.RESTAURANT_OWNER,
        fullName: input.fullName.trim(),
        email,
        phone,
        alternatePhone,
        passwordHash,
        addressLine: input.restaurantAddress.trim(),
        state: input.state.trim(),
        district: input.district.trim(),
        pincode: input.pincode.trim(),
        regionId: regionAssignment?.id ?? region?.id ?? null,
        restaurantName: input.restaurantName.trim(),
        restaurantAddress: input.restaurantAddress.trim(),
        fssaiCertificateNumber: input.fssaiCertificateNumber.trim(),
        idProofType: input.idProofType.trim(),
        idProofNumber: input.idProofNumber.trim(),
        payoutDetails: serializeSnapshot(payoutDetails),
        documents: JSON.stringify(documents),
        assignedRegionalManagerId: regionAssignment?.managerUserId ?? null,
      },
      select: registrationApplicationSelect,
    });

    if (application.region?.manager?.id && application.region.manager.isActive) {
      await notifyAssignedRegionalManager(application);
    } else {
      await notifyAdmins(application);
    }

    return mapRegistrationApplication(application);
  },

  async submitDeliveryPartnerApplication(
    input: {
      fullName: string;
      email: string;
      phone: string;
      alternatePhone?: string;
      password: string;
      addressLine: string;
      state: string;
      district: string;
      pincode: string;
      vehicleType: string;
      vehicleNumber: string;
      drivingLicenseNumber: string;
      idProofType: string;
      idProofNumber: string;
      payoutMethod?: string;
      accountHolderName?: string;
      bankName?: string;
      accountNumberLast4?: string;
      ifscCode?: string;
      upiId?: string;
    },
    files: RegistrationApplicationFiles,
    baseUrl: string,
  ) {
    const email = input.email.trim().toLowerCase();
    const phone = normalizeIndianPhoneNumber(input.phone) ?? input.phone.trim();
    const alternatePhone =
      normalizeIndianPhoneNumber(input.alternatePhone) ?? (input.alternatePhone?.trim() || null);
    const vehicleNumber = normalizeVehicleNumber(input.vehicleNumber) ?? input.vehicleNumber.trim();
    const drivingLicenseNumber =
      normalizeLicenseNumber(input.drivingLicenseNumber) ?? input.drivingLicenseNumber.trim();
    const documents = buildDocumentsSnapshot(
      RegistrationApplicationRoleType.DELIVERY_PARTNER,
      files,
      baseUrl,
    );
    const payoutDetails = buildPayoutDetailsSnapshot(input);

    await ensureNoIdentityConflicts(prisma, {
      email,
      phone,
      alternatePhone: alternatePhone ?? undefined,
    });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const region = await resolveRegionIdForAssignment(prisma, input.state, input.district);
    const regionAssignment =
      region?.id != null
        ? await prisma.region.findUnique({
            where: { id: region.id },
            select: {
              id: true,
              managerUserId: true,
            },
          })
        : null;
    const application = await prisma.registrationApplication.create({
      data: {
        roleType: RegistrationApplicationRoleType.DELIVERY_PARTNER,
        fullName: input.fullName.trim(),
        email,
        phone,
        alternatePhone,
        passwordHash,
        addressLine: input.addressLine.trim(),
        state: input.state.trim(),
        district: input.district.trim(),
        pincode: input.pincode.trim(),
        regionId: regionAssignment?.id ?? region?.id ?? null,
        idProofType: input.idProofType.trim(),
        idProofNumber: input.idProofNumber.trim(),
        vehicleType: input.vehicleType.trim(),
        vehicleNumber,
        drivingLicenseNumber,
        payoutDetails: serializeSnapshot(payoutDetails),
        documents: JSON.stringify(documents),
        assignedRegionalManagerId: regionAssignment?.managerUserId ?? null,
      },
      select: registrationApplicationSelect,
    });

    if (application.region?.manager?.id && application.region.manager.isActive) {
      await notifyAssignedRegionalManager(application);
    } else {
      await notifyAdmins(application);
    }

    return mapRegistrationApplication(application);
  },

  async listForActor(
    actor: ApplicationActor,
    filters?: {
      search?: string;
      roleType?: string;
      status?: string;
      regionId?: number;
      state?: string;
      district?: string;
      createdFrom?: string;
      createdTo?: string;
      unassignedOnly?: boolean;
    },
    context?: RequestContext,
  ) {
    const access = await getRegionalAccessState(actor);

    if (access.isRestricted && !access.assignedRegion) {
      return [];
    }

    const applications = await prisma.registrationApplication.findMany({
      where: await buildScopedWhere(actor, filters, context),
      select: registrationApplicationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return applications.map(mapRegistrationApplication);
  },

  async approve(
    actor: ApplicationActor,
    applicationId: number,
    input: {
      remarks?: string;
    },
    context?: RequestContext,
  ) {
    const startedAt = Date.now();
    const nextStatus = RegistrationApplicationStatus.APPROVED;
    const application = await ensureApplicationVisibleToActor(actor, applicationId, context);
    const trimmedRemarks = input.remarks?.trim() || null;

    logApplicationReviewEvent("started", {
      applicationId,
      applicationType: application.roleType,
      reviewerId: actor.id,
      reviewerRole: actor.role,
      action: "APPROVE",
      previousStatus: application.status,
      nextStatus,
    });

    try {
      if (application.status === RegistrationApplicationStatus.REJECTED) {
        const reviewedApplication = await loadRegistrationApplicationForResponse(applicationId);

        logApplicationReviewEvent("completed", {
          applicationId,
          applicationType: application.roleType,
          reviewerId: actor.id,
          reviewerRole: actor.role,
          action: "APPROVE",
          previousStatus: application.status,
          nextStatus: reviewedApplication.status,
          durationMs: Date.now() - startedAt,
        });

        return mapRegistrationApplication(reviewedApplication);
      }

      if (application.status === RegistrationApplicationStatus.APPROVED) {
        const reviewedApplication = await loadApprovedApplicationWithRepair(applicationId);

        logApplicationReviewEvent("completed", {
          applicationId,
          applicationType: application.roleType,
          reviewerId: actor.id,
          reviewerRole: actor.role,
          action: "APPROVE",
          previousStatus: application.status,
          nextStatus: reviewedApplication.status,
          durationMs: Date.now() - startedAt,
        });

        return mapRegistrationApplication(reviewedApplication);
      }

      const approvalUpdate = await prisma.registrationApplication.updateMany({
        where: {
          id: applicationId,
          status: RegistrationApplicationStatus.PENDING,
        },
        data: {
          status: nextStatus,
          reviewedById: actor.id,
          reviewRemarks: trimmedRemarks,
          reviewedAt: new Date(),
        },
      });

      let reviewedApplication: RegistrationApplicationRecord;

      if (approvalUpdate.count === 0) {
        reviewedApplication = await loadApprovedApplicationWithRepair(applicationId);
      } else {
        reviewedApplication = await finalizeApprovedApplication(applicationId);
        await notifyApplicantAboutApproval(reviewedApplication);
      }

      logApplicationReviewEvent("completed", {
        applicationId,
        applicationType: application.roleType,
        reviewerId: actor.id,
        reviewerRole: actor.role,
        action: "APPROVE",
        previousStatus: application.status,
        nextStatus: reviewedApplication.status,
        durationMs: Date.now() - startedAt,
      });

      return mapRegistrationApplication(reviewedApplication);
    } catch (error) {
      logApplicationReviewEvent("failed", {
        applicationId,
        applicationType: application.roleType,
        reviewerId: actor.id,
        reviewerRole: actor.role,
        action: "APPROVE",
        previousStatus: application.status,
        nextStatus,
        durationMs: Date.now() - startedAt,
        error,
      });

      throw error;
    }
  },

  async reject(
    actor: ApplicationActor,
    applicationId: number,
    input: {
      remarks: string;
    },
    context?: RequestContext,
  ) {
    const startedAt = Date.now();
    const nextStatus = RegistrationApplicationStatus.REJECTED;
    const application = await ensureApplicationVisibleToActor(actor, applicationId, context);
    const trimmedRemarks = input.remarks.trim();

    logApplicationReviewEvent("started", {
      applicationId,
      applicationType: application.roleType,
      reviewerId: actor.id,
      reviewerRole: actor.role,
      action: "REJECT",
      previousStatus: application.status,
      nextStatus,
    });

    try {
      if (application.status !== RegistrationApplicationStatus.PENDING) {
        const reviewedApplication = await loadRegistrationApplicationForResponse(applicationId);

        logApplicationReviewEvent("completed", {
          applicationId,
          applicationType: application.roleType,
          reviewerId: actor.id,
          reviewerRole: actor.role,
          action: "REJECT",
          previousStatus: application.status,
          nextStatus: reviewedApplication.status,
          durationMs: Date.now() - startedAt,
        });

        return mapRegistrationApplication(reviewedApplication);
      }

      const rejectionUpdate = await prisma.registrationApplication.updateMany({
        where: {
          id: applicationId,
          status: RegistrationApplicationStatus.PENDING,
        },
        data: {
          status: nextStatus,
          reviewedById: actor.id,
          reviewRemarks: trimmedRemarks,
          reviewedAt: new Date(),
        },
      });

      const reviewedApplication = await loadRegistrationApplicationForResponse(applicationId);

      if (rejectionUpdate.count > 0) {
        await notifyApplicantAboutRejection(reviewedApplication);
      }

      logApplicationReviewEvent("completed", {
        applicationId,
        applicationType: application.roleType,
        reviewerId: actor.id,
        reviewerRole: actor.role,
        action: "REJECT",
        previousStatus: application.status,
        nextStatus: reviewedApplication.status,
        durationMs: Date.now() - startedAt,
      });

      return mapRegistrationApplication(reviewedApplication);
    } catch (error) {
      logApplicationReviewEvent("failed", {
        applicationId,
        applicationType: application.roleType,
        reviewerId: actor.id,
        reviewerRole: actor.role,
        action: "REJECT",
        previousStatus: application.status,
        nextStatus,
        durationMs: Date.now() - startedAt,
        error,
      });

      throw error;
    }
  },
};
