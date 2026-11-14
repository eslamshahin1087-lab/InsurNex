export function calculateOpenClaimsCount(total, closed, rejected) {
  const normalizeCount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  };
  return Math.max(0, normalizeCount(total) - normalizeCount(closed) - normalizeCount(rejected));
}
