const VALID_SORTS = new Set(["newest", "oldest", "content-asc", "favorites-first", "tagged-first"]);

function localDateBoundary(value, exclusiveEnd = false) {
  if (!value) return null;
  if (typeof value !== "string") return Number.NaN;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || !parts.every(Number.isInteger)) return Number.NaN;
  const [year, month, day] = parts;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return Number.NaN;
  const start = new Date(year, month - 1, day);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return Number.NaN;
  if (!exclusiveEnd) return start.getTime();
  return new Date(year, month - 1, day + 1).getTime();
}

function timestamp(record) {
  const parsed = Date.parse(record?.createdAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareNewest(a, b) {
  return timestamp(b) - timestamp(a) || String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/**
 * Filters and sorts local history. Date inputs are interpreted as inclusive local calendar days.
 * Returns invalidDateRange instead of silently misrepresenting an invalid date interval.
 */
export function queryHistoryRecords(items, {
  query = "",
  source = "all",
  tag = "all",
  kind = "all",
  dateFrom = "",
  dateTo = "",
  sort = "newest",
} = {}) {
  if (!Array.isArray(items)) return { items: [], invalidDateRange: false };
  const from = localDateBoundary(dateFrom);
  const until = localDateBoundary(dateTo, true);
  const invalidDateRange = Number.isNaN(from) || Number.isNaN(until) ||
    (from !== null && until !== null && from >= until);
  if (invalidDateRange) return { items: [], invalidDateRange: true };

  const needle = typeof query === "string" ? query.trim().toLocaleLowerCase() : "";
  const filtered = items.filter((item) => {
    if (source !== "all" && item.source !== source) return false;
    if (kind !== "all" && item.kind !== kind) return false;
    if (tag !== "all" && !(item.tags ?? []).includes(tag)) return false;
    if (needle && !String(item.content ?? "").toLocaleLowerCase().includes(needle)) return false;
    const createdAt = timestamp(item);
    if (from !== null && createdAt < from) return false;
    if (until !== null && createdAt >= until) return false;
    return true;
  });

  const mode = VALID_SORTS.has(sort) ? sort : "newest";
  filtered.sort((a, b) => {
    if (mode === "oldest") return timestamp(a) - timestamp(b) || String(a.id ?? "").localeCompare(String(b.id ?? ""));
    if (mode === "content-asc") {
      return String(a.content ?? "").localeCompare(String(b.content ?? ""), undefined, { sensitivity: "base", numeric: true }) || compareNewest(a, b);
    }
    if (mode === "favorites-first" && Boolean(a.favorite) !== Boolean(b.favorite)) return Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
    if (mode === "tagged-first" && (a.tags ?? []).length !== (b.tags ?? []).length) return (b.tags ?? []).length - (a.tags ?? []).length;
    return compareNewest(a, b);
  });
  return { items: filtered, invalidDateRange: false };
}
