import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EventRefundPolicySectionProps = {
  cancellationAllowed: boolean;
  refundAllowed: boolean;
  cancellationWithoutRefundAllowed: boolean;
  refundDeadline: string;
  refundPercentage: string;
  cancellationFee: string;
  refundPolicyNote: string;
  onCancellationAllowedChange: (value: boolean) => void;
  onRefundAllowedChange: (value: boolean) => void;
  onCancellationWithoutRefundAllowedChange: (value: boolean) => void;
  onRefundDeadlineChange: (value: string) => void;
  onRefundPercentageChange: (value: string) => void;
  onCancellationFeeChange: (value: string) => void;
  onRefundPolicyNoteChange: (value: string) => void;
  description?: string;
  notePlaceholder?: string;
};

const DEFAULT_DESCRIPTION =
  "Control whether guests can cancel at all, whether refunds apply, whether no-refund cancellations stay allowed, and any extra policy note guests should see.";
const DEFAULT_NOTE_PLACEHOLDER =
  "Add any extra refund conditions, review notes, or timing clarifications.";

export const EventRefundPolicySection = ({
  cancellationAllowed,
  refundAllowed,
  cancellationWithoutRefundAllowed,
  refundDeadline,
  refundPercentage,
  cancellationFee,
  refundPolicyNote,
  onCancellationAllowedChange,
  onRefundAllowedChange,
  onCancellationWithoutRefundAllowedChange,
  onRefundDeadlineChange,
  onRefundPercentageChange,
  onCancellationFeeChange,
  onRefundPolicyNoteChange,
  description = DEFAULT_DESCRIPTION,
  notePlaceholder = DEFAULT_NOTE_PLACEHOLDER,
}: EventRefundPolicySectionProps) => (
  <div className="md:col-span-2 rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-5 py-5">
    <div className="mb-4">
      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cancellation and refund policy</p>
      <p className="mt-2 text-sm text-ink-soft">{description}</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream px-4 py-3 text-sm font-semibold text-ink">
        <span>Cancellation allowed</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[rgb(139,30,36)]"
          checked={cancellationAllowed}
          onChange={(event) => onCancellationAllowedChange(event.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream px-4 py-3 text-sm font-semibold text-ink">
        <span>Refund allowed</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[rgb(139,30,36)]"
          checked={refundAllowed}
          onChange={(event) => onRefundAllowedChange(event.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream px-4 py-3 text-sm font-semibold text-ink md:col-span-2">
        <span>Allow cancellation without refund</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[rgb(139,30,36)]"
          checked={cancellationWithoutRefundAllowed}
          onChange={(event) => onCancellationWithoutRefundAllowedChange(event.target.checked)}
          disabled={!cancellationAllowed}
        />
      </label>
      <Input
        label="Refund deadline"
        type="datetime-local"
        value={refundDeadline}
        onChange={(event) => onRefundDeadlineChange(event.target.value)}
        disabled={!cancellationAllowed || !refundAllowed}
      />
      <Input
        label="Refund percentage"
        type="number"
        min="0"
        max="100"
        value={refundPercentage}
        onChange={(event) => onRefundPercentageChange(event.target.value)}
        disabled={!cancellationAllowed || !refundAllowed}
      />
      <Input
        label="Cancellation fee"
        type="number"
        min="0"
        step="0.01"
        value={cancellationFee}
        onChange={(event) => onCancellationFeeChange(event.target.value)}
        disabled={!cancellationAllowed || !refundAllowed}
      />
    </div>
    <div className="mt-4">
      <Textarea
        label="Refund policy note"
        value={refundPolicyNote}
        onChange={(event) => onRefundPolicyNoteChange(event.target.value)}
        placeholder={notePlaceholder}
      />
    </div>
  </div>
);
