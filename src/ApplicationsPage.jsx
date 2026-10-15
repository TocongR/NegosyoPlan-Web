import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { STATUSES, statusClass, when, peso, toDate } from './format.js';

export default function ApplicationsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Pending');
  const [search, setSearch] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'applications'), orderBy('submittedAt', 'desc')),
        (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => setError(`${e.code}: ${e.message}`),
      ),
    [],
  );

  const counts = useMemo(() => {
    const c = { All: rows?.length || 0 };
    for (const s of STATUSES) c[s] = (rows || []).filter((r) => (r.status || 'Pending') === s).length;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || [])
      .filter((r) => filter === 'All' || (r.status || 'Pending') === filter)
      .filter((r) => !q || [r.ownerName, r.businessName, r.mobile, r.barangay, r.town].some((x) => String(x || '').toLowerCase().includes(q)))
      // Oldest pending first, so nobody waits too long.
      .sort((a, b) => (filter === 'Pending' ? (toDate(a.submittedAt) || 0) - (toDate(b.submittedAt) || 0) : 0));
  }, [rows, filter, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Applications</h1>
          <p className="muted">Submitted from the NegosyoPlan app. Updates live.</p>
        </div>
        <input className="search" placeholder="Search name, business, mobile, barangay…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="tabs">
        {[...STATUSES, 'All'].map((s) => (
          <button key={s} className={`tab ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>
            {s} <span className="count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="alert red">
          Could not load applications. {error}
          <br />
          Check that the Firestore rules for staff are published.
        </div>
      )}
      {!rows && !error && <div className="card muted">Loading…</div>}
      {rows && shown.length === 0 && <div className="card muted">No applications here.</div>}

      {shown.length > 0 && (
        <div className="card table-card">
          <table className="list">
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Location</th>
                <th className="r">Loan</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => (window.location.hash = `#/app/${r.id}`)}>
                  <td>
                    <b>{r.businessName || '—'}</b>
                  </td>
                  <td>
                    {r.ownerName || '—'}
                    <div className="muted small">{r.mobile}</div>
                  </td>
                  <td>{[r.barangay, r.town].filter(Boolean).join(', ') || '—'}</td>
                  <td className="r">{peso(r.loanAmount)}</td>
                  <td>{when(r.submittedAt)}</td>
                  <td>
                    <span className={`badge ${statusClass(r.status)}`}>{r.status || 'Pending'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}