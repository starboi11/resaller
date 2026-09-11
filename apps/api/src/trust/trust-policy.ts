export type TrustInputs = {
  verified: boolean;
  completed: number;
  cancelled: number;
  timedOut: number;
  disputes: number;
};

export function calculateTrust(inputs: TrustInputs): {
  badge: 'NEW' | 'IDENTITY_VERIFIED' | 'TRUSTED' | 'TOP_SELLER';
  score: number;
  timeoutRisk: boolean;
} {
  if (!inputs.verified) return { badge: 'NEW', score: 0, timeoutRisk: false };
  const total = inputs.completed + inputs.cancelled + inputs.timedOut;
  const completionRate = total ? inputs.completed / total : 0;
  const disputePenalty = Math.min(inputs.disputes * 10, 30);
  const score = Math.max(
    0,
    Math.min(100, Math.round(completionRate * 100) - disputePenalty),
  );
  const badge =
    inputs.completed >= 50 && completionRate >= 0.95 && inputs.disputes <= 1
      ? 'TOP_SELLER'
      : inputs.completed >= 10 && completionRate >= 0.9 && inputs.disputes <= 1
        ? 'TRUSTED'
        : 'IDENTITY_VERIFIED';
  return {
    badge,
    score,
    timeoutRisk: total >= 5 && inputs.timedOut / total > 0.2,
  };
}
