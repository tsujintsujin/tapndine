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

/** "7:42 PM", restaurant time. */
export const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** "7 PM", for an hour of the day 0–23. */
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

/** "just now", "4 min ago", "1 h 20 min ago". */
export const ago = (ms: number, now = Date.now()) => {
  const min = Math.floor((now - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ${min % 60} min ago`;
};
