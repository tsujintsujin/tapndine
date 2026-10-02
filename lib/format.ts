/** ₱385, or ₱385.50 when there are centavos. */
export const formatPrice = (cents: number) =>
  "₱" +
  (cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });

/** "1 person", "2 people", "2–4 people". */
export const servesLabel = (min: number, max: number) =>
  min === max ? `${min} ${min === 1 ? "person" : "people"}` : `${min}–${max} people`;
