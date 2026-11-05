/** A fixed-point integer string as a decimal with grouped thousands, rounded half up: (1234567, 3, 2) is 1,234.57. */
export const formatPredictionFixed = (value: string, scale: number, fractionDigits: number) => {
  const raw = BigInt(value);
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const divisor = 10n ** BigInt(scale);
  const fractionUnit = 10n ** BigInt(fractionDigits);
  const rounded = (absolute * fractionUnit + divisor / 2n) / divisor;
  const whole = rounded / fractionUnit;
  const fraction = (rounded % fractionUnit).toString().padStart(fractionDigits, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fractionDigits ? `.${fraction}` : ''}`;
};
