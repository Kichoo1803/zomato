import { useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useForm, type FieldError, type UseFormRegisterReturn } from "react-hook-form";
import { Link } from "react-router-dom";
import { ShieldCheck, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Input } from "@/components/ui/input";
import { LicenseNumberInput } from "@/components/ui/license-number-input";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VehicleNumberInput } from "@/components/ui/vehicle-number-input";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, getIndianStateOptions } from "@/lib/india-regions";
import {
  areIndianPhoneInputsEqual,
  isValidIndianPhoneInput,
} from "@/lib/phone";
import {
  INDIAN_LICENSE_NUMBER_ERROR_MESSAGE,
  INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE,
  getLicenseNumberInputValue,
  getVehicleNumberInputValue,
  isValidIndianLicenseNumber,
  isValidIndianVehicleNumber,
} from "@/lib/vehicle";
import {
  type RegistrationApplicationAsset,
  submitDeliveryPartnerApplication,
  submitRestaurantOwnerApplication,
  type RegistrationApplication,
  type RegistrationApplicationPayoutMethod,
} from "@/lib/registration-applications";
import { VEHICLE_OPTIONS, formatDateTime, toLabel } from "@/pages/admin/admin-shared";
import { cn } from "@/utils/cn";

const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const UPI_REGEX = /^[a-z0-9._-]{2,256}@[a-z]{2,64}$/i;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ID_PROOF_OPTIONS = ["AADHAAR", "PAN", "PASSPORT", "VOTER_ID", "DRIVING_LICENSE"];
const PAYOUT_METHOD_OPTIONS: RegistrationApplicationPayoutMethod[] = ["BANK_TRANSFER", "UPI"];

type SharedApplicationFormValues = {
  fullName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  password: string;
  state: string;
  district: string;
  pincode: string;
  idProofType: string;
  idProofNumber: string;
  payoutMethod: "" | RegistrationApplicationPayoutMethod;
  accountHolderName: string;
  bankName: string;
  accountNumberLast4: string;
  ifscCode: string;
  upiId: string;
  termsAccepted: boolean;
};

type RestaurantOwnerFormValues = SharedApplicationFormValues & {
  restaurantName: string;
  restaurantAddress: string;
  fssaiCertificateNumber: string;
  fssaiCertificate: FileList;
  idProof: FileList;
  restaurantImages: FileList;
};

type DeliveryPartnerFormValues = SharedApplicationFormValues & {
  addressLine: string;
  vehicleType: string;
  vehicleNumber: string;
  drivingLicenseNumber: string;
  drivingLicense: FileList;
  idProof: FileList;
  profilePhoto: FileList;
};

const getSelectedFiles = (fileList?: FileList | null) => Array.from(fileList ?? []);

const hasAllowedMimeTypes = (files: FileList | null | undefined, allowedTypes: string[]) =>
  getSelectedFiles(files).every((file) => allowedTypes.includes(file.type));

const hasAllowedFileSizes = (files: FileList | null | undefined) =>
  getSelectedFiles(files).every((file) => file.size <= MAX_UPLOAD_BYTES);

const appendOptionalField = (formData: FormData, key: string, value?: string | null) => {
  const normalizedValue = value?.trim();

  if (normalizedValue) {
    formData.append(key, normalizedValue);
  }
};

const appendFiles = (formData: FormData, key: string, files?: FileList | null) => {
  getSelectedFiles(files).forEach((file) => {
    formData.append(key, file);
  });
};

const normalizePincodeInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const normalizeLastFourDigits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

const normalizeIfscInput = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11).toUpperCase();

const getDocumentCards = (application: RegistrationApplication) => {
  const documents = application.documents;
  const items: Array<{ label: string; asset: RegistrationApplicationAsset } | null> = [
    documents?.fssaiCertificate
      ? {
          label: "FSSAI certificate",
          asset: documents.fssaiCertificate,
        }
      : null,
    documents?.drivingLicense
      ? {
          label: "Driving license",
          asset: documents.drivingLicense,
        }
      : null,
    documents?.idProof
      ? {
          label: `${toLabel(application.idProofType)} proof`,
          asset: documents.idProof,
        }
      : null,
    documents?.profilePhoto
      ? {
          label: "Profile photo",
          asset: documents.profilePhoto,
        }
      : null,
    ...(documents?.restaurantImages?.map((asset, index) => ({
      label: `Restaurant image ${index + 1}`,
      asset,
    })) ?? []),
  ];

  return items.filter((item): item is { label: string; asset: RegistrationApplicationAsset } => Boolean(item));
};

const FieldGroup = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <SurfaceCard className="space-y-5">
    <SectionHeading title={title} description={description} />
    <div className="grid gap-4 md:grid-cols-2">{children}</div>
  </SurfaceCard>
);

const FileUploadField = ({
  label,
  hint,
  registration,
  error,
  accept,
  multiple,
  selectedFiles,
}: {
  label: string;
  hint: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  accept: string;
  multiple?: boolean;
  selectedFiles: File[];
}) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-semibold text-ink">{label}</span>
    <div
      className={cn(
        "rounded-[1.5rem] border border-dashed border-accent/20 bg-cream-soft/60 p-4 shadow-soft",
        error && "border-accent-soft",
      )}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        {...registration}
      />
      <p className="mt-3 text-xs leading-6 text-ink-muted">{hint}</p>
      {selectedFiles.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedFiles.map((file) => (
            <span
              key={`${file.name}-${file.size}`}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-soft"
            >
              {file.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
    {error?.message ? <span className="text-xs font-medium text-accent-soft">{error.message}</span> : null}
  </label>
);

const TermsCheckbox = ({
  checked,
  onChange,
  error,
  registration,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  registration: UseFormRegisterReturn;
}) => (
  <label className="flex items-start gap-3 rounded-[1.5rem] border border-accent/10 bg-white/70 px-4 py-4 shadow-soft">
    <input
      type="checkbox"
      className="mt-1 h-4 w-4 rounded accent-[rgb(139,30,36)]"
      checked={checked}
      onChange={(event) => {
        registration.onChange(event);
        onChange(event.target.checked);
      }}
      onBlur={registration.onBlur}
      name={registration.name}
      ref={registration.ref}
    />
    <span className="text-sm leading-7 text-ink-soft">
      I confirm that the information and documents are accurate, I agree to the partner onboarding
      terms, and I understand access stays locked until approval.
      {error ? <span className="mt-1 block text-xs font-medium text-accent-soft">{error}</span> : null}
    </span>
  </label>
);

const SubmissionState = ({
  application,
  loginPath,
}: {
  application: RegistrationApplication;
  loginPath: string;
}) => {
  const payoutDetails = application.payoutDetails;
  const documents = getDocumentCards(application);

  return (
    <SurfaceCard className="space-y-6 border-accent/15 bg-[radial-gradient(circle_at_top,_rgba(139,30,36,0.08),_transparent_55%),rgba(255,255,255,0.92)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <StatusPill label="Application submitted" tone="success" />
          <div>
            <h2 className="font-display text-4xl font-semibold text-ink">Approval queue confirmed</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
              Your onboarding request is saved with status <strong>PENDING</strong>. Dashboard access
              remains disabled until an admin or regional manager approves the application.
            </p>
          </div>
        </div>
        <Link
          to={loginPath}
          className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-deep"
        >
          Go to login
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] bg-cream px-5 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Application ID</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">#{application.id}</p>
        </div>
        <div className="rounded-[1.5rem] bg-cream px-5 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Review route</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {application.routingTarget === "REGIONAL_MANAGER" ? "Regional manager queue" : "Admin queue"}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-cream px-5 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Submitted</p>
          <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(application.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] bg-white px-5 py-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Region</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {[application.district, application.state, application.pincode].filter(Boolean).join(", ")}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            {application.region
              ? `${application.region.districtName}, ${application.region.stateName}`
              : "No mapped regional manager was found for this region, so admin review will handle it."}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-white px-5 py-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Payout details</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {payoutDetails ? toLabel(payoutDetails.method) : "Not provided during onboarding"}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            {payoutDetails?.method === "BANK_TRANSFER"
              ? `Only payout-safe metadata is stored. Account ending ${payoutDetails.accountNumberLast4 ?? "N/A"}.`
              : payoutDetails?.method === "UPI"
                ? `UPI payout handle: ${payoutDetails.upiId ?? "N/A"}`
                : "Raw card numbers and CVV are never collected here."}
          </p>
        </div>
      </div>

      {documents.length ? (
        <div className="space-y-4">
          <SectionHeading
            title="Uploaded documents"
            description="Your review package is attached below for operations and admin verification."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map(({ label, asset }) => {
              const isImage = asset.mimeType.startsWith("image/");

              return (
                <a
                  key={`${label}-${asset.fileUrl}`}
                  href={asset.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4 shadow-soft transition hover:-translate-y-0.5"
                >
                  {isImage ? (
                    <img
                      src={asset.fileUrl}
                      alt={label}
                      className="h-40 w-full rounded-[1rem] object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-[1rem] bg-cream text-sm font-semibold text-ink">
                      PDF preview
                    </div>
                  )}
                  <p className="mt-3 font-semibold text-ink">{label}</p>
                  <p className="mt-1 text-xs text-ink-muted">{asset.originalName}</p>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
};

const OnboardingHeader = ({
  eyebrow,
  title,
  description,
  loginPath,
  secondaryPath,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  loginPath: string;
  secondaryPath: string;
  secondaryLabel: string;
}) => (
  <PageShell
    eyebrow={eyebrow}
    title={title}
    description={description}
    actions={
      <>
        <Link
          to={loginPath}
          className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft transition hover:border-accent/30"
        >
          Already approved? Sign in
        </Link>
        <Link
          to={secondaryPath}
          className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-deep"
        >
          {secondaryLabel}
        </Link>
      </>
    }
  >
    <></>
  </PageShell>
);

const OwnerOnboardingForm = () => {
  const [submittedApplication, setSubmittedApplication] = useState<RegistrationApplication | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<RestaurantOwnerFormValues>({
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      alternatePhone: "",
      password: "",
      restaurantName: "",
      restaurantAddress: "",
      state: "",
      district: "",
      pincode: "",
      fssaiCertificateNumber: "",
      idProofType: "",
      idProofNumber: "",
      payoutMethod: "",
      accountHolderName: "",
      bankName: "",
      accountNumberLast4: "",
      ifscCode: "",
      upiId: "",
      termsAccepted: false,
    },
  });
  const states = useMemo(() => getIndianStateOptions(), []);
  const selectedState = form.watch("state");
  const selectedDistricts = useMemo(() => getDistrictOptions(selectedState), [selectedState]);
  const payoutMethod = form.watch("payoutMethod");
  const selectedFssaiFiles = getSelectedFiles(form.watch("fssaiCertificate"));
  const selectedIdProofFiles = getSelectedFiles(form.watch("idProof"));
  const selectedRestaurantImages = getSelectedFiles(form.watch("restaurantImages"));
  const termsAcceptedField = form.register("termsAccepted", {
    validate: (value) => value || "Accept the onboarding terms to continue.",
  });
  const stateField = form.register("state", {
    required: "Select a state or union territory.",
  });

  const handleStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    stateField.onChange(event);
    form.setValue("district", "", { shouldDirty: true, shouldValidate: true });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const formData = new FormData();

    formData.append("fullName", values.fullName.trim());
    formData.append("email", values.email.trim());
    formData.append("phone", values.phone.trim());
    formData.append("password", values.password);
    formData.append("restaurantName", values.restaurantName.trim());
    formData.append("restaurantAddress", values.restaurantAddress.trim());
    formData.append("state", values.state);
    formData.append("district", values.district);
    formData.append("pincode", values.pincode.trim());
    formData.append("fssaiCertificateNumber", values.fssaiCertificateNumber.trim());
    formData.append("idProofType", values.idProofType);
    formData.append("idProofNumber", values.idProofNumber.trim());
    formData.append("termsAccepted", "true");
    appendOptionalField(formData, "alternatePhone", values.alternatePhone);
    appendOptionalField(formData, "payoutMethod", values.payoutMethod);
    appendOptionalField(formData, "accountHolderName", values.accountHolderName);
    appendOptionalField(formData, "bankName", values.bankName);
    appendOptionalField(formData, "accountNumberLast4", values.accountNumberLast4);
    appendOptionalField(formData, "ifscCode", values.ifscCode);
    appendOptionalField(formData, "upiId", values.upiId);
    appendFiles(formData, "fssaiCertificate", values.fssaiCertificate);
    appendFiles(formData, "idProof", values.idProof);
    appendFiles(formData, "restaurantImages", values.restaurantImages);

    setIsSubmitting(true);

    try {
      const application = await submitRestaurantOwnerApplication(formData);
      setSubmittedApplication(application);
      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Restaurant owner application submitted.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to submit the restaurant owner application."));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="space-y-8">
      <OnboardingHeader
        eyebrow="Restaurant partner onboarding"
        title="Bring your restaurant into the Zomato-style partner network."
        description="Share restaurant, compliance, identity, and payout details in one secure onboarding workflow. Applications are reviewed by the mapped regional manager when available, or by admin as a safe fallback."
        loginPath="/owner/login"
        secondaryPath="/register/delivery-partner"
        secondaryLabel="Apply as delivery partner"
      />

      <section className="-mt-24 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            {submittedApplication ? (
              <SubmissionState application={submittedApplication} loginPath="/owner/login" />
            ) : null}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <FieldGroup
                title="Primary contact"
                description="These details will be used for verification and future account activation after approval."
              >
                <Input
                  label="Full name"
                  placeholder="Aarav Mehta"
                  error={form.formState.errors.fullName?.message}
                  {...form.register("fullName", {
                    required: "Enter your full name.",
                    minLength: { value: 2, message: "Full name must be at least 2 characters." },
                  })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="partner@restaurant.com"
                  error={form.formState.errors.email?.message}
                  {...form.register("email", {
                    required: "Enter your email address.",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address.",
                    },
                  })}
                />
                <IndianPhoneInput
                  label="Phone number"
                  error={form.formState.errors.phone?.message}
                  {...form.register("phone", {
                    required: "Enter your phone number.",
                    validate: (value) =>
                      isValidIndianPhoneInput(value) || "Enter a valid 10-digit Indian mobile number.",
                  })}
                />
                <IndianPhoneInput
                  label="Alternate phone number"
                  error={form.formState.errors.alternatePhone?.message}
                  {...form.register("alternatePhone", {
                    validate: (value) => {
                      if (!value.trim()) {
                        return true;
                      }

                      if (!isValidIndianPhoneInput(value)) {
                        return "Enter a valid 10-digit alternate Indian mobile number.";
                      }

                      if (areIndianPhoneInputsEqual(value, form.getValues("phone"))) {
                        return "Alternate phone number should be different.";
                      }

                      return true;
                    },
                  })}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Choose a strong password"
                  error={form.formState.errors.password?.message}
                  {...form.register("password", {
                    required: "Set a password for the future owner account.",
                    validate: (value) => {
                      if (value.length < 8) {
                        return "Password must be at least 8 characters.";
                      }

                      if (!/[A-Z]/.test(value)) {
                        return "Password must include an uppercase letter.";
                      }

                      if (!/[a-z]/.test(value)) {
                        return "Password must include a lowercase letter.";
                      }

                      if (!/[0-9]/.test(value)) {
                        return "Password must include a number.";
                      }

                      if (!/[^A-Za-z0-9]/.test(value)) {
                        return "Password must include a special character.";
                      }

                      return true;
                    },
                  })}
                />
              </FieldGroup>

              <FieldGroup
                title="Restaurant details"
                description="This information determines regional routing and the initial storefront record created after approval."
              >
                <Input
                  label="Restaurant name"
                  placeholder="The Coastal Table"
                  error={form.formState.errors.restaurantName?.message}
                  {...form.register("restaurantName", {
                    required: "Enter the restaurant name.",
                    minLength: { value: 2, message: "Restaurant name must be at least 2 characters." },
                  })}
                />
                <Input
                  label="FSSAI certificate number"
                  placeholder="FSSAI-2026-XYZ-101"
                  error={form.formState.errors.fssaiCertificateNumber?.message}
                  {...form.register("fssaiCertificateNumber", {
                    required: "Enter the FSSAI certificate number.",
                    minLength: { value: 6, message: "FSSAI certificate number looks too short." },
                  })}
                />
                <Textarea
                  label="Restaurant address"
                  className="md:col-span-2"
                  placeholder="House number, street, area, landmark"
                  error={form.formState.errors.restaurantAddress?.message}
                  {...form.register("restaurantAddress", {
                    required: "Enter the restaurant address.",
                    minLength: { value: 8, message: "Address must be at least 8 characters." },
                  })}
                />
                <Select
                  label="State / Union territory"
                  error={form.formState.errors.state?.message}
                  {...stateField}
                  onChange={handleStateChange}
                >
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
                <Select
                  label="District"
                  error={form.formState.errors.district?.message}
                  disabled={!selectedState}
                  {...form.register("district", {
                    required: "Select a district.",
                  })}
                >
                  <option value="">{selectedState ? "Select district" : "Choose a state first"}</option>
                  {selectedDistricts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Pincode"
                  placeholder="560001"
                  inputMode="numeric"
                  error={form.formState.errors.pincode?.message}
                  {...form.register("pincode", {
                    required: "Enter the pincode.",
                    validate: (value) =>
                      PINCODE_REGEX.test(value) || "Enter a valid 6-digit Indian PIN code.",
                    onChange: (event) => {
                      event.target.value = normalizePincodeInput(event.target.value);
                    },
                  })}
                />
              </FieldGroup>

              <FieldGroup
                title="Compliance and identity"
                description="Document uploads stay limited to review-safe files. PDFs and images up to 3 MB each are supported."
              >
                <Select
                  label="ID proof type"
                  error={form.formState.errors.idProofType?.message}
                  {...form.register("idProofType", {
                    required: "Select an ID proof type.",
                  })}
                >
                  <option value="">Select ID proof</option>
                  {ID_PROOF_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {toLabel(option)}
                    </option>
                  ))}
                </Select>
                <Input
                  label="ID proof number"
                  placeholder="Enter government ID number"
                  error={form.formState.errors.idProofNumber?.message}
                  {...form.register("idProofNumber", {
                    required: "Enter the ID proof number.",
                    minLength: { value: 4, message: "ID proof number looks too short." },
                  })}
                />
                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <FileUploadField
                    label="FSSAI certificate upload"
                    hint="Upload one PDF or image. Accepted: PDF, JPG, PNG, WEBP. Max 3 MB."
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    selectedFiles={selectedFssaiFiles}
                    error={form.formState.errors.fssaiCertificate}
                    registration={form.register("fssaiCertificate", {
                      validate: (files) => {
                        const firstFile = files?.[0];

                        if (!firstFile) {
                          return "Upload the FSSAI certificate.";
                        }

                        if (!hasAllowedMimeTypes(files, ALLOWED_UPLOAD_TYPES)) {
                          return "Only PDF, JPG, PNG, or WEBP files are allowed.";
                        }

                        if (!hasAllowedFileSizes(files)) {
                          return "Each upload must be 3 MB or smaller.";
                        }

                        return true;
                      },
                    })}
                  />
                  <FileUploadField
                    label="ID proof upload"
                    hint="Upload the selected government ID proof. Accepted: PDF, JPG, PNG, WEBP. Max 3 MB."
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    selectedFiles={selectedIdProofFiles}
                    error={form.formState.errors.idProof}
                    registration={form.register("idProof", {
                      validate: (files) => {
                        if (!files?.[0]) {
                          return "Upload the ID proof.";
                        }

                        if (!hasAllowedMimeTypes(files, ALLOWED_UPLOAD_TYPES)) {
                          return "Only PDF, JPG, PNG, or WEBP files are allowed.";
                        }

                        if (!hasAllowedFileSizes(files)) {
                          return "Each upload must be 3 MB or smaller.";
                        }

                        return true;
                      },
                    })}
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploadField
                    label="Restaurant images upload"
                    hint="Upload at least one storefront or interior image. Accepted: JPG, PNG, WEBP. Max 3 MB each."
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple
                    selectedFiles={selectedRestaurantImages}
                    error={form.formState.errors.restaurantImages}
                    registration={form.register("restaurantImages", {
                      validate: (files) => {
                        if (!files?.length) {
                          return "Upload at least one restaurant image.";
                        }

                        if (!hasAllowedMimeTypes(files, IMAGE_UPLOAD_TYPES)) {
                          return "Restaurant images must be JPG, PNG, or WEBP files.";
                        }

                        if (!hasAllowedFileSizes(files)) {
                          return "Each upload must be 3 MB or smaller.";
                        }

                        return true;
                      },
                    })}
                  />
                </div>
              </FieldGroup>

              <FieldGroup
                title="Payout details"
                description="Only safe payout metadata is collected here. Raw card numbers and CVV are never stored."
              >
                <Select
                  label="Preferred payout method"
                  error={form.formState.errors.payoutMethod?.message}
                  {...form.register("payoutMethod")}
                >
                  <option value="">Skip for now</option>
                  {PAYOUT_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {toLabel(option)}
                    </option>
                  ))}
                </Select>
                {payoutMethod === "BANK_TRANSFER" ? (
                  <>
                    <Input
                      label="Account holder name"
                      error={form.formState.errors.accountHolderName?.message}
                      {...form.register("accountHolderName", {
                        validate: (value) =>
                          payoutMethod !== "BANK_TRANSFER" || value.trim()
                            ? true
                            : "Enter the account holder name.",
                      })}
                    />
                    <Input
                      label="Bank name"
                      error={form.formState.errors.bankName?.message}
                      {...form.register("bankName", {
                        validate: (value) =>
                          payoutMethod !== "BANK_TRANSFER" || value.trim()
                            ? true
                            : "Enter the bank name.",
                      })}
                    />
                    <Input
                      label="Account number last 4 digits"
                      placeholder="1234"
                      inputMode="numeric"
                      error={form.formState.errors.accountNumberLast4?.message}
                      {...form.register("accountNumberLast4", {
                        validate: (value) => {
                          if (payoutMethod !== "BANK_TRANSFER") {
                            return true;
                          }

                          return /^\d{4}$/.test(value) || "Enter exactly 4 digits.";
                        },
                        onChange: (event) => {
                          event.target.value = normalizeLastFourDigits(event.target.value);
                        },
                      })}
                    />
                    <Input
                      label="IFSC code"
                      placeholder="HDFC0001234"
                      error={form.formState.errors.ifscCode?.message}
                      {...form.register("ifscCode", {
                        validate: (value) => {
                          if (payoutMethod !== "BANK_TRANSFER") {
                            return true;
                          }

                          return IFSC_REGEX.test(value) || "Enter a valid IFSC code.";
                        },
                        onChange: (event) => {
                          event.target.value = normalizeIfscInput(event.target.value);
                        },
                      })}
                    />
                  </>
                ) : null}
                {payoutMethod === "UPI" ? (
                  <Input
                    label="UPI ID"
                    className="md:col-span-2"
                    placeholder="payments@bank"
                    error={form.formState.errors.upiId?.message}
                    {...form.register("upiId", {
                      validate: (value) => {
                        if (payoutMethod !== "UPI") {
                          return true;
                        }

                        return UPI_REGEX.test(value) || "Enter a valid UPI ID.";
                      },
                    })}
                  />
                ) : null}
              </FieldGroup>

              <SurfaceCard className="space-y-5">
                <SectionHeading
                  title="Final confirmation"
                  description="Applications remain pending until approved by the mapped reviewer."
                />
                <TermsCheckbox
                  checked={form.watch("termsAccepted")}
                  onChange={(checked) =>
                    form.setValue("termsAccepted", checked, { shouldDirty: true, shouldValidate: true })
                  }
                  error={form.formState.errors.termsAccepted?.message}
                  registration={termsAcceptedField}
                />
                <div className="flex flex-wrap justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => form.reset()} disabled={isSubmitting}>
                    Reset form
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting application..." : "Submit owner application"}
                  </Button>
                </div>
              </SurfaceCard>
            </form>
          </div>

          <div className="space-y-6">
            <SurfaceCard className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">What happens next</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Owner review pipeline</h3>
                </div>
              </div>
              <p className="text-sm leading-7 text-ink-soft">
                Your application is routed to the regional manager assigned to the selected district when one
                exists. If no manager is mapped, admin receives it automatically.
              </p>
              <div className="space-y-3">
                {[
                  "Status starts as PENDING and blocks dashboard access.",
                  "Admin can always view, approve, or reject the application.",
                  "Rejected applications stay recorded with review remarks.",
                ].map((item) => (
                  <div key={item} className="rounded-[1.25rem] bg-cream px-4 py-3 text-sm text-ink-soft">
                    {item}
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Privacy guardrails</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Safe financial collection</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm leading-7 text-ink-soft">
                <p>Only safe payout metadata is stored for onboarding review.</p>
                <p>No raw card number, expiry, or CVV is requested anywhere in this flow.</p>
                <p>Bank collection is limited to account holder, bank name, IFSC, and last four digits.</p>
              </div>
            </SurfaceCard>
          </div>
        </div>
      </section>
    </div>
  );
};

const DeliveryOnboardingForm = () => {
  const [submittedApplication, setSubmittedApplication] = useState<RegistrationApplication | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<DeliveryPartnerFormValues>({
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      alternatePhone: "",
      password: "",
      addressLine: "",
      state: "",
      district: "",
      pincode: "",
      vehicleType: "BIKE",
      vehicleNumber: "",
      drivingLicenseNumber: "",
      idProofType: "",
      idProofNumber: "",
      payoutMethod: "",
      accountHolderName: "",
      bankName: "",
      accountNumberLast4: "",
      ifscCode: "",
      upiId: "",
      termsAccepted: false,
    },
  });
  const states = useMemo(() => getIndianStateOptions(), []);
  const selectedState = form.watch("state");
  const selectedDistricts = useMemo(() => getDistrictOptions(selectedState), [selectedState]);
  const payoutMethod = form.watch("payoutMethod");
  const selectedDrivingLicenseFiles = getSelectedFiles(form.watch("drivingLicense"));
  const selectedIdProofFiles = getSelectedFiles(form.watch("idProof"));
  const selectedProfilePhotoFiles = getSelectedFiles(form.watch("profilePhoto"));
  const termsAcceptedField = form.register("termsAccepted", {
    validate: (value) => value || "Accept the onboarding terms to continue.",
  });
  const stateField = form.register("state", {
    required: "Select a state or union territory.",
  });

  const handleStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    stateField.onChange(event);
    form.setValue("district", "", { shouldDirty: true, shouldValidate: true });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const formData = new FormData();

    formData.append("fullName", values.fullName.trim());
    formData.append("email", values.email.trim());
    formData.append("phone", values.phone.trim());
    formData.append("password", values.password);
    formData.append("addressLine", values.addressLine.trim());
    formData.append("state", values.state);
    formData.append("district", values.district);
    formData.append("pincode", values.pincode.trim());
    formData.append("vehicleType", values.vehicleType);
    formData.append("vehicleNumber", getVehicleNumberInputValue(values.vehicleNumber));
    formData.append("drivingLicenseNumber", getLicenseNumberInputValue(values.drivingLicenseNumber));
    formData.append("idProofType", values.idProofType);
    formData.append("idProofNumber", values.idProofNumber.trim());
    formData.append("termsAccepted", "true");
    appendOptionalField(formData, "alternatePhone", values.alternatePhone);
    appendOptionalField(formData, "payoutMethod", values.payoutMethod);
    appendOptionalField(formData, "accountHolderName", values.accountHolderName);
    appendOptionalField(formData, "bankName", values.bankName);
    appendOptionalField(formData, "accountNumberLast4", values.accountNumberLast4);
    appendOptionalField(formData, "ifscCode", values.ifscCode);
    appendOptionalField(formData, "upiId", values.upiId);
    appendFiles(formData, "drivingLicense", values.drivingLicense);
    appendFiles(formData, "idProof", values.idProof);
    appendFiles(formData, "profilePhoto", values.profilePhoto);

    setIsSubmitting(true);

    try {
      const application = await submitDeliveryPartnerApplication(formData);
      setSubmittedApplication(application);
      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Delivery partner application submitted.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to submit the delivery partner application."));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="space-y-8">
      <OnboardingHeader
        eyebrow="Delivery partner onboarding"
        title="Join the delivery fleet with a secure approval-first flow."
        description="Capture rider identity, licensing, location, and payout details in one responsive onboarding experience. Regional managers review their own mapped districts, while admin keeps full visibility and override control."
        loginPath="/delivery/login"
        secondaryPath="/register/restaurant-owner"
        secondaryLabel="Apply as restaurant owner"
      />

      <section className="-mt-24 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            {submittedApplication ? (
              <SubmissionState application={submittedApplication} loginPath="/delivery/login" />
            ) : null}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <FieldGroup
                title="Primary contact"
                description="These details will be reused when the live delivery account is activated after approval."
              >
                <Input
                  label="Full name"
                  placeholder="Ravi Kumar"
                  error={form.formState.errors.fullName?.message}
                  {...form.register("fullName", {
                    required: "Enter your full name.",
                    minLength: { value: 2, message: "Full name must be at least 2 characters." },
                  })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="rider@example.com"
                  error={form.formState.errors.email?.message}
                  {...form.register("email", {
                    required: "Enter your email address.",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address.",
                    },
                  })}
                />
                <IndianPhoneInput
                  label="Phone number"
                  error={form.formState.errors.phone?.message}
                  {...form.register("phone", {
                    required: "Enter your phone number.",
                    validate: (value) =>
                      isValidIndianPhoneInput(value) || "Enter a valid 10-digit Indian mobile number.",
                  })}
                />
                <IndianPhoneInput
                  label="Alternate phone number"
                  error={form.formState.errors.alternatePhone?.message}
                  {...form.register("alternatePhone", {
                    validate: (value) => {
                      if (!value.trim()) {
                        return true;
                      }

                      if (!isValidIndianPhoneInput(value)) {
                        return "Enter a valid 10-digit alternate Indian mobile number.";
                      }

                      if (areIndianPhoneInputsEqual(value, form.getValues("phone"))) {
                        return "Alternate phone number should be different.";
                      }

                      return true;
                    },
                  })}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Choose a strong password"
                  error={form.formState.errors.password?.message}
                  {...form.register("password", {
                    required: "Set a password for the future rider account.",
                    validate: (value) => {
                      if (value.length < 8) {
                        return "Password must be at least 8 characters.";
                      }

                      if (!/[A-Z]/.test(value)) {
                        return "Password must include an uppercase letter.";
                      }

                      if (!/[a-z]/.test(value)) {
                        return "Password must include a lowercase letter.";
                      }

                      if (!/[0-9]/.test(value)) {
                        return "Password must include a number.";
                      }

                      if (!/[^A-Za-z0-9]/.test(value)) {
                        return "Password must include a special character.";
                      }

                      return true;
                    },
                  })}
                />
              </FieldGroup>

              <FieldGroup
                title="Address and region"
                description="Selected state and district determine whether the application is routed to a regional manager or directly to admin."
              >
                <Textarea
                  label="Address"
                  className="md:col-span-2"
                  placeholder="House number, street, landmark, area"
                  error={form.formState.errors.addressLine?.message}
                  {...form.register("addressLine", {
                    required: "Enter your address.",
                    minLength: { value: 8, message: "Address must be at least 8 characters." },
                  })}
                />
                <Select
                  label="State / Union territory"
                  error={form.formState.errors.state?.message}
                  {...stateField}
                  onChange={handleStateChange}
                >
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
                <Select
                  label="District"
                  error={form.formState.errors.district?.message}
                  disabled={!selectedState}
                  {...form.register("district", {
                    required: "Select a district.",
                  })}
                >
                  <option value="">{selectedState ? "Select district" : "Choose a state first"}</option>
                  {selectedDistricts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Pincode"
                  placeholder="560001"
                  inputMode="numeric"
                  error={form.formState.errors.pincode?.message}
                  {...form.register("pincode", {
                    required: "Enter the pincode.",
                    validate: (value) =>
                      PINCODE_REGEX.test(value) || "Enter a valid 6-digit Indian PIN code.",
                    onChange: (event) => {
                      event.target.value = normalizePincodeInput(event.target.value);
                    },
                  })}
                />
              </FieldGroup>

              <FieldGroup
                title="Vehicle and compliance"
                description="Vehicle, license, identity, and photo uploads support the rider verification workflow."
              >
                <Select
                  label="Vehicle type"
                  error={form.formState.errors.vehicleType?.message}
                  {...form.register("vehicleType", {
                    required: "Select the vehicle type.",
                  })}
                >
                  {VEHICLE_OPTIONS.map((vehicle) => (
                    <option key={vehicle} value={vehicle}>
                      {toLabel(vehicle)}
                    </option>
                  ))}
                </Select>
                <VehicleNumberInput
                  label="Vehicle number"
                  placeholder="KA01AB1234"
                  error={form.formState.errors.vehicleNumber?.message}
                  {...form.register("vehicleNumber", {
                    required: "Enter the vehicle number.",
                    validate: (value) =>
                      isValidIndianVehicleNumber(value) || INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE,
                  })}
                />
                <LicenseNumberInput
                  label="Driving license number"
                  placeholder="TN0120110012345"
                  error={form.formState.errors.drivingLicenseNumber?.message}
                  {...form.register("drivingLicenseNumber", {
                    required: "Enter the driving license number.",
                    validate: (value) =>
                      isValidIndianLicenseNumber(value) || INDIAN_LICENSE_NUMBER_ERROR_MESSAGE,
                  })}
                />
                <Select
                  label="ID proof type"
                  error={form.formState.errors.idProofType?.message}
                  {...form.register("idProofType", {
                    required: "Select an ID proof type.",
                  })}
                >
                  <option value="">Select ID proof</option>
                  {ID_PROOF_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {toLabel(option)}
                    </option>
                  ))}
                </Select>
                <Input
                  label="ID proof number"
                  placeholder="Enter government ID number"
                  error={form.formState.errors.idProofNumber?.message}
                  {...form.register("idProofNumber", {
                    required: "Enter the ID proof number.",
                    minLength: { value: 4, message: "ID proof number looks too short." },
                  })}
                />
                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <FileUploadField
                    label="Driving license upload"
                    hint="Upload one PDF or image. Accepted: PDF, JPG, PNG, WEBP. Max 3 MB."
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    selectedFiles={selectedDrivingLicenseFiles}
                    error={form.formState.errors.drivingLicense}
                    registration={form.register("drivingLicense", {
                      validate: (files) => {
                        if (!files?.[0]) {
                          return "Upload the driving license.";
                        }

                        if (!hasAllowedMimeTypes(files, ALLOWED_UPLOAD_TYPES)) {
                          return "Only PDF, JPG, PNG, or WEBP files are allowed.";
                        }

                        if (!hasAllowedFileSizes(files)) {
                          return "Each upload must be 3 MB or smaller.";
                        }

                        return true;
                      },
                    })}
                  />
                  <FileUploadField
                    label="ID proof upload"
                    hint="Upload the selected government ID proof. Accepted: PDF, JPG, PNG, WEBP. Max 3 MB."
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    selectedFiles={selectedIdProofFiles}
                    error={form.formState.errors.idProof}
                    registration={form.register("idProof", {
                      validate: (files) => {
                        if (!files?.[0]) {
                          return "Upload the ID proof.";
                        }

                        if (!hasAllowedMimeTypes(files, ALLOWED_UPLOAD_TYPES)) {
                          return "Only PDF, JPG, PNG, or WEBP files are allowed.";
                        }

                        if (!hasAllowedFileSizes(files)) {
                          return "Each upload must be 3 MB or smaller.";
                        }

                        return true;
                      },
                    })}
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploadField
                    label="Profile photo upload"
                    hint="Upload one clear profile image. Accepted: JPG, PNG, WEBP. Max 3 MB."
                    accept=".jpg,.jpeg,.png,.webp"
                    selectedFiles={selectedProfilePhotoFiles}
                    error={form.formState.errors.profilePhoto}
                    registration={form.register("profilePhoto", {
                      validate: (files) => {
                        if (!files?.[0]) {
                          return "Upload a profile photo.";
                        }

                        if (!hasAllowedMimeTypes(files, IMAGE_UPLOAD_TYPES)) {
                          return "Profile photo must be JPG, PNG, or WEBP.";
                        }

                        if (!hasAllowedFileSizes(files)) {
                          return "Each upload must be 3 MB or smaller.";
                        }

                        return true;
                      },
                    })}
                  />
                </div>
              </FieldGroup>

              <FieldGroup
                title="Payout details"
                description="Add safe payout metadata now if you want faster finance setup after approval."
              >
                <Select
                  label="Preferred payout method"
                  error={form.formState.errors.payoutMethod?.message}
                  {...form.register("payoutMethod")}
                >
                  <option value="">Skip for now</option>
                  {PAYOUT_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {toLabel(option)}
                    </option>
                  ))}
                </Select>
                {payoutMethod === "BANK_TRANSFER" ? (
                  <>
                    <Input
                      label="Account holder name"
                      error={form.formState.errors.accountHolderName?.message}
                      {...form.register("accountHolderName", {
                        validate: (value) =>
                          payoutMethod !== "BANK_TRANSFER" || value.trim()
                            ? true
                            : "Enter the account holder name.",
                      })}
                    />
                    <Input
                      label="Bank name"
                      error={form.formState.errors.bankName?.message}
                      {...form.register("bankName", {
                        validate: (value) =>
                          payoutMethod !== "BANK_TRANSFER" || value.trim()
                            ? true
                            : "Enter the bank name.",
                      })}
                    />
                    <Input
                      label="Account number last 4 digits"
                      placeholder="1234"
                      inputMode="numeric"
                      error={form.formState.errors.accountNumberLast4?.message}
                      {...form.register("accountNumberLast4", {
                        validate: (value) => {
                          if (payoutMethod !== "BANK_TRANSFER") {
                            return true;
                          }

                          return /^\d{4}$/.test(value) || "Enter exactly 4 digits.";
                        },
                        onChange: (event) => {
                          event.target.value = normalizeLastFourDigits(event.target.value);
                        },
                      })}
                    />
                    <Input
                      label="IFSC code"
                      placeholder="HDFC0001234"
                      error={form.formState.errors.ifscCode?.message}
                      {...form.register("ifscCode", {
                        validate: (value) => {
                          if (payoutMethod !== "BANK_TRANSFER") {
                            return true;
                          }

                          return IFSC_REGEX.test(value) || "Enter a valid IFSC code.";
                        },
                        onChange: (event) => {
                          event.target.value = normalizeIfscInput(event.target.value);
                        },
                      })}
                    />
                  </>
                ) : null}
                {payoutMethod === "UPI" ? (
                  <Input
                    label="UPI ID"
                    className="md:col-span-2"
                    placeholder="rider@upi"
                    error={form.formState.errors.upiId?.message}
                    {...form.register("upiId", {
                      validate: (value) => {
                        if (payoutMethod !== "UPI") {
                          return true;
                        }

                        return UPI_REGEX.test(value) || "Enter a valid UPI ID.";
                      },
                    })}
                  />
                ) : null}
              </FieldGroup>

              <SurfaceCard className="space-y-5">
                <SectionHeading
                  title="Final confirmation"
                  description="Approval-first activation keeps the current auth and role flows safe."
                />
                <TermsCheckbox
                  checked={form.watch("termsAccepted")}
                  onChange={(checked) =>
                    form.setValue("termsAccepted", checked, { shouldDirty: true, shouldValidate: true })
                  }
                  error={form.formState.errors.termsAccepted?.message}
                  registration={termsAcceptedField}
                />
                <div className="flex flex-wrap justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => form.reset()} disabled={isSubmitting}>
                    Reset form
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting application..." : "Submit delivery application"}
                  </Button>
                </div>
              </SurfaceCard>
            </form>
          </div>

          <div className="space-y-6">
            <SurfaceCard className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Review path</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Regional delivery checks</h3>
                </div>
              </div>
              <p className="text-sm leading-7 text-ink-soft">
                Applications inside a managed district appear in that regional manager dashboard first, while
                admin always retains full visibility and override control.
              </p>
              <div className="space-y-3">
                {[
                  "Pending riders cannot sign in until approved.",
                  "Reviewers can approve or reject with remarks.",
                  "Rejections stay recorded for audit-safe follow-up.",
                ].map((item) => (
                  <div key={item} className="rounded-[1.25rem] bg-cream px-4 py-3 text-sm text-ink-soft">
                    {item}
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Data handling</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Sensitive info stays out</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm leading-7 text-ink-soft">
                <p>Only license, identity, location, and payout-safe metadata are collected.</p>
                <p>Raw card payment information is never requested or stored in this onboarding flow.</p>
                <p>Uploads are limited to review assets used by operations and admin verification.</p>
              </div>
            </SurfaceCard>
          </div>
        </div>
      </section>
    </div>
  );
};

export const RestaurantOwnerRegistrationPage = () => <OwnerOnboardingForm />;

export const DeliveryPartnerRegistrationPage = () => <DeliveryOnboardingForm />;
