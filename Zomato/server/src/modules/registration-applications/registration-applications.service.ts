import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import path from "node:path";
import { DeliveryAvailabilityStatus, NotificationType, Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { buildPublicUploadUrl } from "../../lib/uploads.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { resolveRegionIdForAssignment } from "../regions/regions.service.js";
import { slugify } from "../../utils/slug.js";
import { AppError } from "../../utils/app-error.js";
import {
  getIndianPhoneSearchVariants,
  normalizeIndianPhoneNumber,
} from "../../utils/phone.js";
import {
  RegistrationApplicationPayoutMethod,
  RegistrationApplicationRoleType,
  RegistrationApplicationStatus,
} from "./registration-applications.constants.js";

type ApplicationActor = {
  id: number;
  role: Role;
};

type RegistrationApplicationFiles = Record<string, Express.Multer.File[] | undefined>;

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
type RegistrationApplicationApprovalRecord = RegistrationApplicationRecord & {
  passwordHash: string;
};

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
): Promise<Prisma.RegistrationApplicationWhereInput> => {
  const search = filters?.search?.trim();
  const clauses: Prisma.RegistrationApplicationWhereInput[] = [];

  if (filters?.roleType) {
    clauses.push({ roleType: filters.roleType });
  }

  if (filters?.status) {
    clauses.push({ status: filters.status });
  }

  if (filters?.regionId) {
    clauses.push({ regionId: filters.regionId });
  }

  if (filters?.state) {
    clauses.push({ state: filters.state });
  }

  if (filters?.district) {
    clauses.push({ district: filters.district });
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

  if (actor.role === Role.REGIONAL_MANAGER) {
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
) => {
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

  if (actor.role === Role.REGIONAL_MANAGER && application.region?.managerUserId !== actor.id) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  return application;
};

const generateUniqueRestaurantSlug = async (
  client: Prisma.TransactionClient,
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

const approveRestaurantOwnerApplication = async (
  client: Prisma.TransactionClient,
  application: RegistrationApplicationApprovalRecord,
) => {
  await ensureFssaiNumberAvailable(client, application.fssaiCertificateNumber, application.id);
  await ensureNoIdentityConflicts(client, {
    email: application.email,
    phone: application.phone,
    alternatePhone: application.alternatePhone ?? undefined,
    excludeApplicationId: application.id,
  });
  const phone = normalizeIndianPhoneNumber(application.phone) ?? application.phone;

  const user = await client.user.create({
    data: {
      fullName: application.fullName,
      email: application.email,
      phone,
      passwordHash: application.passwordHash,
      role: Role.RESTAURANT_OWNER,
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

  const documents = parseSnapshot<ApplicationDocumentsSnapshot>(application.documents);
  const restaurantName = application.restaurantName?.trim() || `${application.fullName}'s Kitchen`;
  const restaurantSlug = await generateUniqueRestaurantSlug(client, restaurantName);

  await client.restaurant.create({
    data: {
      ownerId: user.id,
      regionId: application.regionId,
      name: restaurantName,
      slug: restaurantSlug,
      description: "Created from a partner onboarding approval.",
      email: application.email,
      phone,
      coverImage: documents?.restaurantImages?.[0]?.fileUrl ?? null,
      licenseNumber: application.fssaiCertificateNumber?.trim() || null,
      addressLine: application.restaurantAddress?.trim() || application.addressLine,
      area: application.district,
      city: application.district,
      state: application.state,
      pincode: application.pincode,
      isActive: false,
    },
  });

  return user;
};

const approveDeliveryPartnerApplication = async (
  client: Prisma.TransactionClient,
  application: RegistrationApplicationApprovalRecord,
) => {
  await ensureNoIdentityConflicts(client, {
    email: application.email,
    phone: application.phone,
    alternatePhone: application.alternatePhone ?? undefined,
    excludeApplicationId: application.id,
  });

  const documents = parseSnapshot<ApplicationDocumentsSnapshot>(application.documents);
  const profileImage = documents?.profilePhoto?.fileUrl ?? null;
  const phone = normalizeIndianPhoneNumber(application.phone) ?? application.phone;
  const user = await client.user.create({
    data: {
      fullName: application.fullName,
      email: application.email,
      phone,
      passwordHash: application.passwordHash,
      profileImage,
      role: Role.DELIVERY_PARTNER,
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

  const partner = await client.deliveryPartner.create({
    data: {
      userId: user.id,
      vehicleType: application.vehicleType?.trim() || "BIKE",
      vehicleNumber: application.vehicleNumber?.trim() || null,
      licenseNumber: application.drivingLicenseNumber?.trim() || null,
      availabilityStatus: DeliveryAvailabilityStatus.OFFLINE,
      isVerified: true,
    },
    select: {
      id: true,
    },
  });

  const approvalTimestamp = new Date();
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
    await client.deliveryDocument.createMany({
      data: deliveryDocuments.map((document) => ({
        deliveryPartnerId: partner.id,
        name: document.name,
        fileUrl: document.fileUrl,
        status: RegistrationApplicationStatus.APPROVED,
        reviewedAt: approvalTimestamp,
      })),
    });
  }

  return user;
};

const createApprovedAccountForApplication = async (
  client: Prisma.TransactionClient,
  application: RegistrationApplicationApprovalRecord,
) => {
  if (application.roleType === RegistrationApplicationRoleType.RESTAURANT_OWNER) {
    return approveRestaurantOwnerApplication(client, application);
  }

  return approveDeliveryPartnerApplication(client, application);
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

    await Promise.all([notifyAdmins(application), notifyAssignedRegionalManager(application)]);

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
        vehicleNumber: input.vehicleNumber.trim(),
        drivingLicenseNumber: input.drivingLicenseNumber.trim(),
        payoutDetails: serializeSnapshot(payoutDetails),
        documents: JSON.stringify(documents),
        assignedRegionalManagerId: regionAssignment?.managerUserId ?? null,
      },
      select: registrationApplicationSelect,
    });

    await Promise.all([notifyAdmins(application), notifyAssignedRegionalManager(application)]);

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
  ) {
    const applications = await prisma.registrationApplication.findMany({
      where: await buildScopedWhere(actor, filters),
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
  ) {
    const application = await ensureApplicationVisibleToActor(actor, applicationId);

    if (application.status !== RegistrationApplicationStatus.PENDING) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This registration application has already been reviewed",
        "REGISTRATION_APPLICATION_ALREADY_REVIEWED",
      );
    }

    const reviewedApplication = await prisma.$transaction(async (tx) => {
      const currentApplication = await tx.registrationApplication.findUniqueOrThrow({
        where: { id: applicationId },
        select: {
          ...registrationApplicationSelect,
          passwordHash: true,
        },
      });

      const approvedUser = await createApprovedAccountForApplication(
        tx,
        currentApplication as RegistrationApplicationApprovalRecord,
      );

      return tx.registrationApplication.update({
        where: { id: applicationId },
        data: {
          status: RegistrationApplicationStatus.APPROVED,
          approvedUserId: approvedUser.id,
          reviewedById: actor.id,
          reviewRemarks: input.remarks?.trim() || null,
          reviewedAt: new Date(),
        },
        select: registrationApplicationSelect,
      });
    });

    await notificationsService.createForUser({
      userId: reviewedApplication.approvedUser!.id,
      title: "Registration approved",
      message:
        reviewedApplication.roleType === Role.RESTAURANT_OWNER
          ? "Your restaurant owner onboarding has been approved. You can now sign in and complete your restaurant setup."
          : "Your delivery partner onboarding has been approved. You can now sign in and start using the delivery dashboard.",
      type: NotificationType.SYSTEM,
      meta: {
        eventKey: "registration-application:approved",
        registrationApplicationId: reviewedApplication.id,
        path:
          reviewedApplication.roleType === Role.RESTAURANT_OWNER
            ? "/owner/dashboard"
            : "/delivery",
      },
    });

    return mapRegistrationApplication(reviewedApplication);
  },

  async reject(
    actor: ApplicationActor,
    applicationId: number,
    input: {
      remarks: string;
    },
  ) {
    const application = await ensureApplicationVisibleToActor(actor, applicationId);

    if (application.status !== RegistrationApplicationStatus.PENDING) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This registration application has already been reviewed",
        "REGISTRATION_APPLICATION_ALREADY_REVIEWED",
      );
    }

    const reviewedApplication = await prisma.registrationApplication.update({
      where: { id: applicationId },
      data: {
        status: RegistrationApplicationStatus.REJECTED,
        reviewedById: actor.id,
        reviewRemarks: input.remarks.trim(),
        reviewedAt: new Date(),
      },
      select: registrationApplicationSelect,
    });

    return mapRegistrationApplication(reviewedApplication);
  },
};
