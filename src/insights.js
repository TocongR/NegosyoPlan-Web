import { toDate, amount } from './format.js';

const DAY = 86400000;
const STATUSES = ['Pending', 'Accepted', 'Returned for completion'];
export const statusOf = (r) => r.status || 'Pending';

/** Counts items into [{label, value}] sorted high → low. */
function tally(items) {
  const m = new Map();
  for (const x of items) if (x) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Everything the Overview page shows, worked out from the applications list. */
export function summarize(rows, now = new Date()) {
  const total = rows.length;
  const count = (s) => rows.filter((r) => statusOf(r) === s).length;
  const loans = rows.map((r) => amount(r.loanAmount)).filter((n) => n !== null && n > 0);
  const sum = loans.reduce((a, b) => a + b, 0);

  // Days from submit to the staff decision.
  const reviewDays = rows
    .filter((r) => statusOf(r) !== 'Pending')
    .map((r) => {
      const a = toDate(r.submittedAt);
      const b = toDate(r.reviewedAt);
      return a && b ? Math.max(0, (b - a) / DAY) : null;
    })
    .filter((n) => n !== null);

  // Submissions per day, last 14 days (oldest first).
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start.getTime() - (13 - i) * DAY);
    return { date: d, value: 0 };
  });
  for (const r of rows) {
    const d = toDate(r.submittedAt);
    if (!d) continue;
    const i = Math.floor((d - days[0].date) / DAY);
    if (i >= 0 && i < 14) days[i].value++;
  }

  const buckets = [
    { label: 'Up to ₱50,000', test: (n) => n <= 50000 },
    { label: '₱50,001 – ₱100,000', test: (n) => n > 50000 && n <= 100000 },
    { label: 'Over ₱100,000', test: (n) => n > 100000 },
  ].map((b) => ({ label: b.label, value: loans.filter(b.test).length }));

  const waiting = rows
    .filter((r) => statusOf(r) === 'Pending')
    .map((r) => ({ r, since: toDate(r.submittedAt) }))
    .filter((x) => x.since)
    .map((x) => ({ ...x, days: Math.floor((now - x.since) / DAY) }))
    .sort((a, b) => b.days - a.days);

  const activity = rows
    .flatMap((r) => (r.history || []).map((h) => ({ ...h, business: r.businessName, id: r.id, at: toDate(h.at) })))
    .filter((h) => h.at)
    .sort((a, b) => b.at - a.at);

  return {
    total,
    pending: count('Pending'),
    accepted: count('Accepted'),
    returned: count('Returned for completion'),
    totalLoan: sum,
    avgLoan: loans.length ? sum / loans.length : 0,
    avgReviewDays: reviewDays.length ? reviewDays.reduce((a, b) => a + b, 0) / reviewDays.length : null,
    byStatus: STATUSES.map((s) => ({ label: s, value: count(s) })),
    byTown: tally(rows.map((r) => (r.town || '').trim())),
    byKind: tally(rows.map((r) => r.answers?.g?.bt?.[0])),
    byLoan: buckets,
    days,
    waiting,
    activity,
  };
}