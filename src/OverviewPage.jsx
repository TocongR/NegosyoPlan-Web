import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { when } from './format.js';
import { summarize } from './insights.js';

const php = (n) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const pct = (n, total) => (total ? `${Math.round((100 * n) / total)}%` : '0%');

function Bars({ rows, empty = 'No data yet.' }) {
  if (!rows.length) return <div className="muted small">{empty}</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div className="bar-label">{r.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(100 * r.value) / max}%` }} />
          </div>
          <div className="bar-num">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'applications'), orderBy('submittedAt', 'desc')),
        (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => setError(`${e.code}: ${e.message}`),
      ),
    [],
  );

  const s = useMemo(() => (rows ? summarize(rows) : null), [rows]);

  if (error)
    return (
      <div className="alert red">
        Could not load applications. {error}
        <br />
        Check that the Firestore rules for staff are published.
      </div>
    );
  if (!s) return <div className="card muted">Loading…</div>;

  const maxDay = Math.max(1, ...s.days.map((d) => d.value));
  const fmtDay = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  const kpis = [
    { label: 'Applicants', value: s.total, note: 'Submitted in the app' },
    { label: 'Pending', value: s.pending, note: 'Waiting for review' },
    { label: 'Accepted', value: s.accepted, note: 'Papers complete' },
    { label: 'Returned for completion', value: s.returned, note: `${pct(s.returned, s.total)} of applicants` },
    { label: 'Total loan requested', value: php(s.totalLoan), note: s.total ? `Average ${php(s.avgLoan)}` : '—' },
    {
      label: 'Average review time',
      value: s.avgReviewDays === null ? '—' : `${s.avgReviewDays.toFixed(1)} days`,
      note: 'Submitted → decision',
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
            <p className="muted">
                See what needs your review, what's been returned, and where applicants are coming from.
            </p>
        </div>
        <a className="btn primary" href="#/">
          Open applications
        </a>
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-note">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="pair">
        <section className="card">
          <h2>Applications by status</h2>
          <Bars rows={s.byStatus} />
        </section>
        <section className="card">
          <h2>Submitted in the last 14 days</h2>
          <div className="trend">
            {s.days.map((d) => (
              <div className="trend-col" key={d.date.getTime()} title={`${fmtDay(d.date)}: ${d.value}`}>
                <div className="trend-num">{d.value || ''}</div>
                <div className="trend-bar" style={{ height: `${Math.max(d.value ? 8 : 2, (100 * d.value) / maxDay)}%` }} />
              </div>
            ))}
          </div>
          <div className="trend-axis small muted">
            <span>{fmtDay(s.days[0].date)}</span>
            <span>{fmtDay(s.days[13].date)}</span>
          </div>
        </section>
      </div>

      <div className="pair">
        <section className="card">
          <h2>Applications by town</h2>
          <Bars rows={s.byTown.slice(0, 8)} />
        </section>
        <section className="card">
          <h2>Kind of business</h2>
          <Bars rows={s.byKind} />
          <h2 className="gap">Loan size</h2>
          <Bars rows={s.byLoan} />
        </section>
      </div>

      <div className="pair">
        <section className="card">
          <h2>Waiting the longest</h2>
          {s.waiting.length === 0 && <div className="muted small">Nothing is waiting for review.</div>}
          <ul className="rows">
            {s.waiting.slice(0, 6).map(({ r, days }) => (
              <li key={r.id}>
                <div className="grow">
                  <a href={`#/app/${r.id}`} className="b">
                    {r.businessName || '—'}
                  </a>
                  <div className="small muted">{[r.ownerName, r.town].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={`badge ${days >= 7 ? 'red' : 'amber'}`}>{days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Recent activity</h2>
          {s.activity.length === 0 && <div className="muted small">No activity yet.</div>}
          <ul className="rows">
            {s.activity.slice(0, 6).map((h, i) => (
              <li key={i}>
                <div className="grow">
                  <a href={`#/app/${h.id}`}>
                    <span className="b">{h.business || '—'}</span>
                  </a>{' '}
                  · {h.action}
                  <div className="small muted">
                    {h.by ? `${h.by} · ` : ''}
                    {when(h.at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}