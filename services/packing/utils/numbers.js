/** Number manipulation utilities */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toFixedNumber = (value) => {
  const numeric = Number(value);
  return !Number.isFinite(numeric) ? 0 : Number(numeric.toFixed(2));
};

const safeSum = (items, selector) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const val = selector(item);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);
};

export { clamp, toFixedNumber, safeSum };
