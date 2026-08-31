export const BADGE_MSG = "xcb-badge" as const;

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
