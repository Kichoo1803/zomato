import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getRegionsAdmin, type AdminRegion } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  getDistrictOptions,
  getSingleRegionSelection,
  resolveRegionOptions,
  type RegionOptions,
} from "@/lib/india-regions";
import {
  getOperationsRegions,
  type OperationsRegionsSummary,
} from "@/lib/ops";
import {
  approveRegistrationApplication,
  getRegistrationApplications,
  rejectRegistrationApplication,
  type RegistrationApplication,
  type RegistrationApplicationAsset,
  type RegistrationApplicationRoleType,
  type RegistrationApplicationStatus,
} from "@/lib/registration-applications";
import {
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  getToneForStatus,
  paginate,
  toLabel,
} from "@/pages/admin/admin-shared";

type ReviewScope = "ADMIN" | "OPS";

type RegistrationApplicationsPageProps = {
  scope: ReviewScope;
};

const ROLE_FILTER_OPTIONS: RegistrationApplicationRoleType[] = ["RESTAURANT_OWNER", "DELIVERY_PARTNER"];
const STATUS_FILTER_OPTIONS: RegistrationApplicationStatus[] = ["PENDING", "APPROVED", "REJECTED"];

const buildRegionLabel = (region: Pick<AdminRegion, "districtName" | "stateName" | "name">) =>
  `${region.districtName}, ${region.stateName}`;

const getReviewScopeCopy = (scope: ReviewScope) =>
  scope === "ADMIN"
    ? {
        eyebrow: "Applications",
        title: "Every owner and rider onboarding request in one admin queue.",
        description:
          "Review all registration applications, inspect uploads, override regional decisions when needed, and surface regions that still have no assigned manager.",
      }
    : {
        eyebrow: "Regional applications",
        title: "Assigned district applications ready for regional review.",
        description:
          "Inspect owner and delivery partner requests only for the regions currently assigned to your operations scope.",
      };

const getDocumentItems = (application: RegistrationApplication) => {
  const documents = application.documents;

  return [
    documents?.fssaiCertificate
      ? {
          previewLabel: "FSSAI certificate",
          ...documents.fssaiCertificate,
        }
      : null,
    documents?.drivingLicense
      ? {
          previewLabel: "Driving license",
          ...documents.drivingLicense,
        }
      : null,
    documents?.idProof
      ? {
          previewLabel: `${toLabel(application.idProofType)} proof`,
          ...documents.idProof,
        }
      : null,
    documents?.profilePhoto
      ? {
          previewLabel: "Profile photo",
          ...documents.profilePhoto,
        }
      : null,
    ...(documents?.restaurantImages?.map((asset, index) => ({
      previewLabel: `Restaurant image ${index + 1}`,
      ...asset,
    })) ?? []),
  ].filter((item): item is RegistrationApplicationAsset & { previewLabel: string } => Boolean(item));
};

export const RegistrationApplicationsPage = ({ scope }: RegistrationApplicationsPageProps) => {
  const { user } = useAuth();
  const copy = getReviewScopeCopy(scope);
  const [applications, setApplications] = useState<RegistrationApplication[]>([]);
  const [adminRegions, setAdminRegions] = useState<AdminRegion[]>([]);
  const [opsRegionOptions, setOpsRegionOptions] = useState<RegionOptions | null>(null);
  const [scopeMessage, setScopeMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | RegistrationApplicationRoleType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | RegistrationApplicationStatus>("PENDING");
  const [regionFilter, setRegionFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [detailsApplication, setDetailsApplication] = useState<RegistrationApplication | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const isRegionalManager = user?.role === "REGIONAL_MANAGER";

  const mergedOpsRegions = useMemo(
    () =>
      resolveRegionOptions(opsRegionOptions, {
        includeIndiaDefaults: !(scope === "OPS" && isRegionalManager),
      }),
    [isRegionalManager, opsRegionOptions, scope],
  );
  const districtOptions = useMemo(
    () =>
      getDistrictOptions(stateFilter, opsRegionOptions, {
        includeIndiaDefaults: !(scope === "OPS" && isRegionalManager),
      }),
    [isRegionalManager, opsRegionOptions, scope, stateFilter],
  );

  useEffect(() => {
    if (scope !== "OPS" || !isRegionalManager || !opsRegionOptions) {
      return;
    }

    const assignedRegion = getSingleRegionSelection(opsRegionOptions);

    if (stateFilter !== assignedRegion.state) {
      setStateFilter(assignedRegion.state);
    }

    if (districtFilter !== assignedRegion.district) {
      setDistrictFilter(assignedRegion.district);
    }
  }, [districtFilter, isRegionalManager, opsRegionOptions, scope, stateFilter]);

  const loadApplications = async () => {
    setIsLoading(true);

    try {
      const filters = {
          search: search || undefined,
          roleType: roleFilter === "ALL" ? undefined : roleFilter,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          regionId: scope === "ADMIN" && regionFilter ? Number(regionFilter) : undefined,
          state: scope === "OPS" ? stateFilter || undefined : undefined,
          district: scope === "OPS" ? districtFilter || undefined : undefined,
          createdFrom: createdFrom || undefined,
          createdTo: createdTo || undefined,
          unassignedOnly: scope === "ADMIN" && unassignedOnly ? true : undefined,
        } as const;

      if (scope === "ADMIN") {
        const [applicationRows, regionRows] = await Promise.all([
          getRegistrationApplications(filters),
          getRegionsAdmin({ isActive: true }),
        ]);

        setApplications(applicationRows);
        setAdminRegions(regionRows);
        setScopeMessage(null);
      } else {
        const [applicationRows, regions] = await Promise.all([
          getRegistrationApplications(filters),
          getOperationsRegions(),
        ]);

        setApplications(applicationRows);
        setOpsRegionOptions((regions as OperationsRegionsSummary).regionOptions);
        setScopeMessage((regions as OperationsRegionsSummary).scopeMessage ?? null);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load registration applications."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, [scope, search, roleFilter, statusFilter, regionFilter, stateFilter, districtFilter, createdFrom, createdTo, unassignedOnly]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, regionFilter, stateFilter, districtFilter, createdFrom, createdTo, unassignedOnly]);

  useEffect(() => {
    if (!detailsApplication) {
      setReviewRemarks("");
      return;
    }

    setReviewRemarks(detailsApplication.reviewRemarks ?? "");
  }, [detailsApplication]);

  const summary = useMemo(
    () => ({
      total: applications.length,
      pending: applications.filter((application) => application.status === "PENDING").length,
      approved: applications.filter((application) => application.status === "APPROVED").length,
      rejected: applications.filter((application) => application.status === "REJECTED").length,
      unassigned: applications.filter((application) => !application.assignedRegionalManagerId).length,
    }),
    [applications],
  );

  const pagedApplications = paginate(applications, page);

  const handleApprove = async (application: RegistrationApplication) => {
    setIsReviewing(true);

    try {
      const updatedApplication = await approveRegistrationApplication(application.id, {
        remarks: reviewRemarks.trim() || undefined,
      });
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === updatedApplication.id ? updatedApplication : currentApplication,
        ),
      );
      setDetailsApplication(updatedApplication);
      toast.success("Application approved successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to approve this application."));
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async (application: RegistrationApplication) => {
    if (!reviewRemarks.trim()) {
      toast.error("Enter rejection remarks before rejecting this application.");
      return;
    }

    setIsReviewing(true);

    try {
      const updatedApplication = await rejectRegistrationApplication(application.id, {
        remarks: reviewRemarks.trim(),
      });
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === updatedApplication.id ? updatedApplication : currentApplication,
        ),
      );
      setDetailsApplication(updatedApplication);
      toast.success("Application rejected successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to reject this application."));
    } finally {
      setIsReviewing(false);
    }
  };

  const detailsDocuments = detailsApplication ? getDocumentItems(detailsApplication) : [];

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={<RefreshButton onClick={() => void loadApplications()} />}
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">All applications</p>
          <p className="font-display text-4xl font-semibold text-ink">{summary.total}</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Pending</p>
          <p className="font-display text-4xl font-semibold text-ink">{summary.pending}</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Approved</p>
          <p className="font-display text-4xl font-semibold text-ink">{summary.approved}</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Rejected</p>
          <p className="font-display text-4xl font-semibold text-ink">{summary.rejected}</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">No regional manager</p>
          <p className="font-display text-4xl font-semibold text-ink">{summary.unassigned}</p>
        </SurfaceCard>
      </div>

      {scope === "OPS" && isRegionalManager && scopeMessage ? (
        <SurfaceCard>
          <EmptyState title="No region assigned" description={scopeMessage} />
        </SurfaceCard>
      ) : (
        <AdminToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by applicant, email, phone, restaurant, vehicle, district, or ID proof"
          filters={
            <>
              <Select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                className="min-w-[180px]"
              >
                <option value="ALL">All roles</option>
                {ROLE_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {toLabel(option)}
                  </option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="min-w-[180px]"
              >
                <option value="ALL">All statuses</option>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {toLabel(option)}
                  </option>
                ))}
              </Select>
              {scope === "ADMIN" ? (
                <Select
                  value={regionFilter}
                  onChange={(event) => setRegionFilter(event.target.value)}
                  className="min-w-[220px]"
                >
                  <option value="">All mapped regions</option>
                  {adminRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {buildRegionLabel(region)}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <Select
                    value={stateFilter}
                    onChange={(event) => {
                      setStateFilter(event.target.value);
                      setDistrictFilter("");
                    }}
                    className="min-w-[180px]"
                    disabled={isRegionalManager}
                  >
                    {isRegionalManager ? null : <option value="">All assigned states</option>}
                    {mergedOpsRegions.states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={districtFilter}
                    onChange={(event) => setDistrictFilter(event.target.value)}
                    className="min-w-[180px]"
                    disabled={!stateFilter || isRegionalManager}
                  >
                    {isRegionalManager ? null : (
                      <option value="">{stateFilter ? "All assigned districts" : "Choose a state first"}</option>
                    )}
                    {districtOptions.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </Select>
                </>
              )}
              <Input
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
                className="min-w-[160px]"
              />
              <Input
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
                className="min-w-[160px]"
              />
              {scope === "ADMIN" ? (
                <label className="flex items-center gap-2 rounded-full border border-accent/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-soft">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[rgb(139,30,36)]"
                    checked={unassignedOnly}
                    onChange={(event) => setUnassignedOnly(event.target.checked)}
                  />
                  Unassigned only
                </label>
              ) : null}
            </>
          }
        />
      )}

      {scope === "OPS" && !(isRegionalManager && scopeMessage) ? (
        <SurfaceCard className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Regional scope enforcement</p>
          <p className="text-sm leading-7 text-ink-soft">
            This list is already restricted by the backend to your assigned regions. State and district filters
            only narrow that approved scope.
          </p>
        </SurfaceCard>
      ) : null}

      {isLoading ? (
        <AdminLoadingState rows={6} />
      ) : (
        <>
          <AdminDataTable
            rows={pagedApplications.items}
            getRowKey={(application) => application.id}
            emptyTitle="No registration applications found"
            emptyDescription="Adjust the filters or wait for new owner and delivery partner requests."
            columns={[
              {
                key: "applicant",
                label: "Applicant",
                render: (application) => (
                  <div>
                    <p className="font-semibold text-ink">{application.fullName}</p>
                    <p className="text-xs text-ink-muted">{application.email}</p>
                    <p className="text-xs text-ink-muted">{application.phone}</p>
                  </div>
                ),
              },
              {
                key: "role",
                label: "Role",
                render: (application) => (
                  <div>
                    <StatusPill label={toLabel(application.roleType)} tone="info" />
                    <p className="mt-2 text-xs text-ink-muted">
                      {application.restaurantName || application.vehicleType || "Application details attached"}
                    </p>
                  </div>
                ),
              },
              {
                key: "region",
                label: "Region",
                render: (application) => (
                  <div>
                    <p className="font-semibold text-ink">{application.district}</p>
                    <p className="text-xs text-ink-muted">{application.state}</p>
                    <p className="text-xs text-ink-muted">{application.pincode}</p>
                  </div>
                ),
              },
              {
                key: "routing",
                label: "Routing",
                render: (application) => (
                  <div className="space-y-2">
                    <StatusPill
                      label={application.routingTarget === "REGIONAL_MANAGER" ? "Regional manager" : "Admin"}
                      tone={application.routingTarget === "REGIONAL_MANAGER" ? "success" : "warning"}
                    />
                    <p className="text-xs text-ink-muted">
                      {application.assignedRegionalManager?.fullName ?? "No regional manager assigned"}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (application) => (
                  <div className="space-y-2">
                    <StatusPill label={toLabel(application.status)} tone={getToneForStatus(application.status)} />
                    <p className="text-xs text-ink-muted">{formatDateTime(application.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (application) => (
                  <RowActions onView={() => setDetailsApplication(application)} />
                ),
              },
            ]}
          />
          {applications.length > PAGE_SIZE ? (
            <Pagination
              page={pagedApplications.currentPage}
              totalPages={pagedApplications.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={Boolean(detailsApplication)}
        onClose={() => setDetailsApplication(null)}
        title={detailsApplication ? `${detailsApplication.fullName} application` : ""}
        className="max-w-6xl"
      >
        {detailsApplication ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={toLabel(detailsApplication.roleType)} tone="info" />
              <StatusPill label={toLabel(detailsApplication.status)} tone={getToneForStatus(detailsApplication.status)} />
              <StatusPill
                label={detailsApplication.routingTarget === "REGIONAL_MANAGER" ? "Regional manager queue" : "Admin queue"}
                tone={detailsApplication.routingTarget === "REGIONAL_MANAGER" ? "success" : "warning"}
              />
            </div>

            <AdminDetailsGrid
              items={[
                { label: "Email", value: detailsApplication.email },
                { label: "Phone", value: detailsApplication.phone },
                { label: "Alternate phone", value: detailsApplication.alternatePhone ?? "Not provided" },
                {
                  label: "Region",
                  value: [detailsApplication.district, detailsApplication.state, detailsApplication.pincode]
                    .filter(Boolean)
                    .join(", "),
                },
                {
                  label: "Assigned regional manager",
                  value: detailsApplication.assignedRegionalManager?.fullName ?? "No regional manager assigned",
                },
                { label: "Submitted", value: formatDateTime(detailsApplication.createdAt) },
                {
                  label: "Restaurant details",
                  value:
                    detailsApplication.roleType === "RESTAURANT_OWNER"
                      ? `${detailsApplication.restaurantName ?? "Restaurant"} â€¢ ${detailsApplication.restaurantAddress ?? detailsApplication.addressLine}`
                      : "Not applicable",
                },
                {
                  label: "Delivery details",
                  value:
                    detailsApplication.roleType === "DELIVERY_PARTNER"
                      ? `${toLabel(detailsApplication.vehicleType ?? "BIKE")} â€¢ ${detailsApplication.vehicleNumber ?? "No vehicle number"}`
                      : "Not applicable",
                },
                {
                  label: "ID proof",
                  value: `${toLabel(detailsApplication.idProofType)} â€¢ ${detailsApplication.idProofNumber}`,
                },
                {
                  label: "Compliance",
                  value:
                    detailsApplication.roleType === "RESTAURANT_OWNER"
                      ? detailsApplication.fssaiCertificateNumber ?? "No FSSAI number"
                      : detailsApplication.drivingLicenseNumber ?? "No license number",
                },
                {
                  label: "Payout details",
                  value: detailsApplication.payoutDetails
                    ? detailsApplication.payoutDetails.method === "BANK_TRANSFER"
                      ? `Bank transfer â€¢ ${detailsApplication.payoutDetails.bankName ?? "Bank"} â€¢ a/c ending ${detailsApplication.payoutDetails.accountNumberLast4 ?? "N/A"}`
                      : `UPI â€¢ ${detailsApplication.payoutDetails.upiId ?? "N/A"}`
                    : "Not provided",
                },
                {
                  label: "Review",
                  value: detailsApplication.reviewedAt
                    ? `${detailsApplication.reviewedBy?.fullName ?? "Reviewer"} â€¢ ${formatDateTime(detailsApplication.reviewedAt)}`
                    : "Pending review",
                },
              ]}
            />

            <SurfaceCard className="space-y-5">
              <SectionHeading
                title="Uploaded documents"
                description="Preview the submitted identity, compliance, and image assets before taking action."
              />
              {detailsDocuments.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {detailsDocuments.map((document) => {
                    const isImage = document.mimeType.startsWith("image/");

                    return (
                      <a
                        key={`${document.previewLabel}-${document.fileUrl}`}
                        href={document.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4 shadow-soft transition hover:-translate-y-0.5"
                      >
                        {isImage ? (
                          <img
                            src={document.fileUrl}
                            alt={document.previewLabel}
                            className="h-40 w-full rounded-[1rem] object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-[1rem] bg-cream text-sm font-semibold text-ink">
                            PDF preview
                          </div>
                        )}
                        <p className="mt-3 font-semibold text-ink">{document.previewLabel}</p>
                        <p className="mt-1 text-xs text-ink-muted">{document.originalName}</p>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No documents available"
                  description="This application does not have any stored uploads to preview."
                />
              )}
            </SurfaceCard>

            <SurfaceCard className="space-y-5">
              <SectionHeading
                title="Review remarks"
                description={
                  detailsApplication.status === "PENDING"
                    ? "Remarks are optional for approval and required for rejection."
                    : "Stored review remarks stay attached to the application record."
                }
              />
              <Textarea
                value={reviewRemarks}
                onChange={(event) => setReviewRemarks(event.target.value)}
                placeholder="Capture review context, document notes, or rejection reason."
              />
              {detailsApplication.status === "PENDING" ? (
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleApprove(detailsApplication)}
                    disabled={isReviewing}
                  >
                    {isReviewing ? "Working..." : "Approve application"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleReject(detailsApplication)}
                    disabled={isReviewing}
                  >
                    {isReviewing ? "Working..." : "Reject application"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm leading-7 text-ink-soft">
                  {detailsApplication.reviewRemarks?.trim() || "No remarks were recorded for this decision."}
                </p>
              )}
            </SurfaceCard>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
