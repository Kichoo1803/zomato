import { useEffect, useState } from "react";
import { Save, Store, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Input } from "@/components/ui/input";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage, logoutFromServer } from "@/lib/auth";
import { getOwnerProfile, toSessionUser, updateOwnerProfile, type OwnerProfile } from "@/lib/owner";
import { RefreshButton, getToneForStatus, toLabel } from "@/pages/admin/admin-shared";

const ownerProfileUpdateToastId = "owner-profile-update";

export const OwnerProfilePage = () => {
  const navigate = useNavigate();
  const { accessToken, clearSession, setSession } = useAuth();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", profileImage: "" });

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const user = await getOwnerProfile();
      setProfile(user);
      setForm({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone ?? "",
        profileImage: user.profileImage ?? "",
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the owner profile."));
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
      const user = await updateOwnerProfile({
        fullName: form.fullName,
        phone: form.phone.trim() || undefined,
        profileImage: form.profileImage.trim() || undefined,
      });
      setProfile(user);
      if (accessToken) {
        setSession({ user: toSessionUser(user), accessToken });
      }
      toast.success("Owner profile updated successfully.", { id: ownerProfileUpdateToastId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your profile."), {
        id: ownerProfileUpdateToastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutFromServer();
    } catch {
      // Clear local auth state even if the refresh cookie is already absent.
    } finally {
      clearSession();
      window.localStorage.removeItem("zomato-luxe-auth");
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("refreshToken");
      toast.success("Logged out successfully.");
      navigate("/owner/login", { replace: true });
      setIsLoggingOut(false);
    }
  };

  if (isLoading || !profile) {
    return <AdminLoadingState rows={5} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner profile"
        title="Your account details and restaurant identity."
        description="Update your basic profile while keeping email and password flows aligned with the current backend."
        action={<RefreshButton onClick={() => void loadProfile()} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <SurfaceCard className="space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input label="Full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
            <Input label="Email" value={form.email} disabled />
            <IndianPhoneInput label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Profile image URL" value={form.profileImage} onChange={(event) => setForm({ ...form, profileImage: event.target.value })} />
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "Signing out..." : "Logout"}
              </Button>
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Store className="h-5 w-5" />
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
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <p className="text-sm leading-7 text-ink-soft">
              Password change is intentionally left as a safe placeholder because the current backend does not expose a dedicated password-update endpoint yet.
            </p>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};
