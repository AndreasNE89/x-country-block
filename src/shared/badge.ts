export const BADGE_MSG = "xcb-badge" as const;

/** Marigold reads as information rather than an alarm and stays apart from the teal icon. */
export const BADGE_BACKGROUND_COLOR = "#FFB638";
export const BADGE_TEXT_COLOR = "#14201F";

export type BadgeMessage = {
  type: typeof BADGE_MSG;
  count: number;
};

export function formatBadgeText(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

export function isBadgeMessage(value: unknown): value is BadgeMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BadgeMessage>;
  return row.type === BADGE_MSG && typeof row.count === "number";
}
