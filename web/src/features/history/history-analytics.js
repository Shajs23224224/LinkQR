function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function parsedTimestamp(record) {
  const value = Date.parse(record?.createdAt ?? "");
  return Number.isFinite(value) ? value : null;
}

/**
 * Derives deterministic dashboard metrics from the caller's current local history.
 * Recent activity spans seven local calendar days, including the supplied current day.
 */
export function summarizeHistory(items, { now = new Date() } = {}) {
  const records = Array.isArray(items) ? items : [];
  const safeNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const generated = records.filter((record) => record?.source === "generated").length;
  const scanned = records.filter((record) => record?.source === "scanned").length;
  const urls = records.filter((record) => record?.kind === "url").length;
  const texts = records.filter((record) => record?.kind === "text").length;
  const favorites = records.filter((record) => record?.favorite === true).length;
  const tagged = records.filter((record) => Array.isArray(record?.tags) && record.tags.length > 0).length;
  const distinctTags = new Set();
  const tagCounts = new Map();
  const activityCounts = new Map();

  for (const record of records) {
    const recordTags = Array.isArray(record?.tags) ? new Set(record.tags.filter((tag) => typeof tag === "string" && tag.trim())) : new Set();
    for (const tag of recordTags) {
      distinctTags.add(tag);
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const timestamp = parsedTimestamp(record);
    if (timestamp !== null) {
      const date = new Date(timestamp);
      const key = localDateKey(date);
      activityCounts.set(key, (activityCounts.get(key) ?? 0) + 1);
    }
  }

  const activity = [];
  const today = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate());
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = localDateKey(day);
    const weekday = new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(day).replace(/\.$/u, "");
    activity.push({
      date: key,
      label: weekday + " " + day.getDate(),
      count: activityCounts.get(key) ?? 0,
    });
  }

  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "es"))
    .slice(0, 8);

  return {
    total: records.length,
    generated,
    scanned,
    urls,
    texts,
    favorites,
    tagged,
    untagged: records.length - tagged,
    distinctTagCount: distinctTags.size,
    favoriteRate: records.length ? Math.round((favorites / records.length) * 100) : 0,
    topTags,
    activity,
    maxDailyActivity: Math.max(0, ...activity.map((day) => day.count)),
  };
}
