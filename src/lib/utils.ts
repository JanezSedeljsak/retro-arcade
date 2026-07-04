/** Safely reads a message out of a catch-block value, which TS types as `unknown` since anything can be thrown. */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Formats an ISO timestamp as "D.M.YYYY HH:MM" for leaderboard rows. */
export function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const date = d.toLocaleDateString("sl").replace(/\s+/g, "");
  return `${date} ${hours}:${minutes}`;
}
