/** How fast an item goes off once bought. Shared by the server and the pages. */
export type Tier = "days" | "week" | "weeks" | "pantry";

export const TIERS: Record<Tier, { label: string; short: string; shelfDays: number; help: string }> = {
  days: { label: "Use within 2–3 days", short: "2–3 days", shelfDays: 3, help: "Herbs, leafy greens, berries, fresh meat and fish" },
  week: { label: "Use within a week", short: "~1 week", shelfDays: 6, help: "Most fresh vegetables and soft dairy" },
  weeks: { label: "Keeps 1–2 weeks or more", short: "1–2 weeks", shelfDays: 14, help: "Root vegetables, onions and garlic, hard cheese, eggs" },
  pantry: { label: "Pantry (keeps for months)", short: "pantry", shelfDays: 180, help: "Dry goods, cans, spices, oils, sauces, frozen" },
};
