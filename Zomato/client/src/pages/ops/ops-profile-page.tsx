import { useEffect, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { useAuth } from "@/hooks/use-auth";
import {
  getOperationsProfile,
  toOperationsSessionUser,
  updateOperationsProfile,
  type OperationsProfile,
} from "@/lib/ops";
import { getApiErrorMessage } from "@/lib/auth";
import { RefreshButton, getToneForStatus, toLabel } from "@/pages/admin/admin-shared";

export const OpsProfilePage = () => {
  const { accessToken, setSession } = useAuth();
  const [profile, setProfile] = useState<OperationsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    profileImage: "",
  });

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const user = await getOperationsProfile();
      setProfile(user);
      setForm({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone ?? "",
        profileImage: user.profileImage ?? "",
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the operations profile."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const user = await updateOperationsProfile({
        fullName: form.fullName,
        phone: form.phone.trim() || undefined,
        profileImage: form.profileImage.trim() || undefined,
      });
      setProfile(user);
      if (accessToken) {
        setSession({ user: toOperationsSessionUser(user), accessToken });
      }
      toast.success("Operations profile updated successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your profile."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return <AdminLoadingState rows={5} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Operations profile"
        title="Your regional ops account details."
        description="Update your profile while keeping login, auth, and session flows aligned with the existing backend."
        action={<RefreshButton onClick={() => void loadProfile()} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <SurfaceCard className="space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input label="Full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
            <Input label="Email" value={form.email} disabled />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Profile image URL" value={form.profileImage} onChange={(event) => setForm({ ...form, profileImage: event.target.value })} />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Role</p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-ink">{toLabel(profile.role)}</h2>
          </div>
          <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Account status</span>
              <StatusPill label={profile.isActive ? "Active" : "Inactive"} tone={getToneForStatus(profile.isActive)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Email verification</span>
              <StatusPill label={profile.emailVerified ? "Verified" : "Pending"} tone={getToneForStatus(profile.emailVerified)} />
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4 text-sm leading-7 text-ink-soft">
            Password changes stay on hold here as well because the current backend still does not expose a dedicated password-update endpoint.
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
