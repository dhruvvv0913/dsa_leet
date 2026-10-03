import { site } from "./site";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: site.timeZone,
});
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: site.timeZone }); // YYYY-MM-DD

function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** "19 Sep 2026" from a YYYY-MM-DD class date */
export function formatDay(day: string | null | undefined) {
  if (!day) return "No date";
  return dateFmt.format(parseDay(day));
}

/** "19 Sep" */
export function formatShortDay(day: string | null | undefined) {
  if (!day) return "—";
  return shortDateFmt.format(parseDay(day));
}

/** "Fri, 19 Sep" */
export function formatWeekday(day: string | null | undefined) {
  if (!day) return "No date";
  return weekdayFmt.format(parseDay(day));
}

/** "3 Oct, 9:41 pm" in the cohort's time zone */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return dateTimeFmt.format(new Date(iso));
}

/** Today's date (YYYY-MM-DD) in the cohort's time zone */
export function todayInZone(now = new Date()) {
  return isoDayFmt.format(now);
}

/** The cohort-time-zone calendar day of an ISO timestamp */
export function dayInZone(iso: string) {
  return isoDayFmt.format(new Date(iso));
}

/** YYYY-MM-DD for today ± n days in the cohort's time zone */
export function dayOffset(days: number, now = new Date()) {
  const today = parseDay(todayInZone(now));
  today.setUTCDate(today.getUTCDate() + days);
  return today.toISOString().slice(0, 10);
}

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "never";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(iso).split(",")[0];
}

export function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: site.timeZone }).format(now),
  );
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
