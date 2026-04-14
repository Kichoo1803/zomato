import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const AdminSettingsPage = () => {
  const [form, setForm] = useState({
    supportEmail: "ops@zomatoluxe.dev",
    senderName: "Zomato Luxe Ops",
    featuredHeadline: "Curated premium dining, delivered beautifully.",
    payoutWindow: "Weekly payouts every Monday",
    moderationMode: "balanced",
  });

  const handleSave = () => {
    toast.success("Settings saved locally. Dedicated platform settings endpoints are not wired yet.");
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform settings"
        title="Operational defaults and safe placeholders."
        description="This settings surface stays visually native and isolated until a dedicated backend settings module is introduced."
        action={
          <Button type="button" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save settings
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-4">
          <Input label="Support email" value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} />
          <Input label="Notification sender" value={form.senderName} onChange={(event) => setForm({ ...form, senderName: event.target.value })} />
          <Input label="Featured headline" value={form.featuredHeadline} onChange={(event) => setForm({ ...form, featuredHeadline: event.target.value })} />
          <Textarea label="Payout operations note" value={form.payoutWindow} onChange={(event) => setForm({ ...form, payoutWindow: event.target.value })} />
          <Select label="Moderation mode" value={form.moderationMode} onChange={(event) => setForm({ ...form, moderationMode: event.target.value })}>
            <option value="balanced">Balanced</option>
            <option value="strict">Strict</option>
            <option value="light">Light touch</option>
          </Select>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Safe placeholder" description="These settings are intentionally UI-first for now." />
          <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm leading-7 text-ink-soft">
            Backend endpoints for platform-wide settings are not present yet, so this page keeps admin controls isolated and non-destructive while preserving the established design system.
          </div>
          <div className="rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4 text-sm leading-7 text-ink-soft">
            Once settings APIs exist, this form can be connected without changing the route, layout, or visual language.
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
