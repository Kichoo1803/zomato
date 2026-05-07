export type EventRefundPolicyFormValues = {
  cancellationAllowed: boolean;
  refundAllowed: boolean;
  cancellationWithoutRefundAllowed: boolean;
  refundDeadline: string;
  refundPercentage: string;
  cancellationFee: string;
  refundPolicyNote: string;
};

export const buildEventRefundPolicyPayload = (
  values: EventRefundPolicyFormValues,
  fallbackRefundDeadlineIso: string,
) => ({
  cancellationAllowed: values.cancellationAllowed,
  refundAllowed: values.refundAllowed,
  cancellationWithoutRefundAllowed:
    values.cancellationAllowed && values.cancellationWithoutRefundAllowed,
  refundDeadline: values.refundAllowed
    ? values.refundDeadline
      ? new Date(values.refundDeadline).toISOString()
      : fallbackRefundDeadlineIso
    : null,
  refundPercentage: values.refundAllowed
    ? values.refundPercentage.trim()
      ? Number(values.refundPercentage)
      : 100
    : 0,
  cancellationFee: values.refundAllowed
    ? values.cancellationFee.trim()
      ? Number(values.cancellationFee)
      : 0
    : 0,
  refundPolicyNote: values.refundPolicyNote.trim() || null,
});
