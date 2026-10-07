import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { API_BASE_URL } from '../lib/api';

// Costings — hours, fuel and real cost against crop, field, job and machine.
//
// Everything on this page comes from three readings that were not collected
// for it: the Daily Work Plan (who, what, where), Go2Clock (paid hours) and
// John Deere telematics (machine hours and litres). The server does the
// joining; this page only shows it, and says plainly how much of it is an
// even split rather than a reading.

const VIEWS = [
  ['dept', 'Crop / Dept'],
  ['field', 'Field'],
  ['job', 'Job'],
  ['machine', 'Machine'],
  ['person', 'People'],
];

const iso = (d) => d.toISOString().slice(0, 10);

function presets() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;          // Monday = 0
  const thisMon = new Date(today); thisMon.setDate(today.getDate() - dow);
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1);
  const fourBack = new Date(thisMon); fourBack.setDate(thisMon.getDate() - 28);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return [
    ['This week', iso(thisMon), iso(today)],
    ['Last week', iso(lastMon), iso(lastSun)],
    ['Last 4 weeks', iso(fourBack), iso(today)],
    ['This month', iso(monthStart), iso(today)],
    ['Everything', '2020-01-01', iso(today)],
  ];
}

const n1 = (v) => (v === null || v === undefined ? '—' : Math.round(v * 10) / 10);
const money = (v) => (v === null || v === undefined ? '—'
  : '£' + Math.round(v).toLocaleString());

export default function CostingsPanel({ adminPw }) {
  const P = presets();
  const [from, setFrom] = useState(P[1][1]);
  const [until, setUntil] = useState(P[1][2]);
  const [view, setView] = useState('dept');
  const [showMoney, setShowMoney] = useState(true);
  const [open, setOpen] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!adminPw) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/costings?from_date=${from}&until_date=${until}`,
        { headers: { 'X-Admin-Password': adminPw } });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setData(d);
      else setError(d.detail || 'Could not work the costings out');
    } catch (e) {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [adminPw, from, until]);

  useEffect(() => { load(); }, [load]);

  // Moving one end past the other drags the other with it, rather than
  // quietly ignoring what was typed.
  const setFromSafe = (v) => { setFrom(v); if (v > until) setUntil(v); };
  const setUntilSafe = (v) => { setUntil(v); if (v < from) setFrom(v); };

  const rows = data ? (view === 'person' ? data.by_person : data[`by_${view}`]) || [] : [];
  const childKey = view === 'dept' ? 'fields' : (view === 'field' || view === 'machine') ? 'jobs' : null;
  const activePreset = P.find(([, f, u]) => f === from && u === until);

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">Costings</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Paid hours and fuel against the jobs on the work plan &mdash; and what they cost
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={showMoney}
                 onChange={(e) => setShowMoney(e.target.checked)} />
          Show money
        </label>
      </div>

      {/* From / to */}
      <div className="flex flex-wrap items-end gap-3 mt-3">
        <label className="text-xs text-gray-600">
          From
          <input type="date" value={from} onChange={(e) => setFromSafe(e.target.value)}
                 className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-gray-600">
          To
          <input type="date" value={until} onChange={(e) => setUntilSafe(e.target.value)}
                 className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {P.map(([label, f, u]) => (
            <button key={label} onClick={() => { setFrom(f); setUntil(u); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                      activePreset && activePreset[0] === label
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button onClick={load} disabled={loading} className="bg-green-700 hover:bg-green-800 text-xs">
          {loading ? 'Working…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-900">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* the headline numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              ['Paid hours', n1(data.totals.paid_h), `${data.days} day(s)`],
              ['Booked to a job', `${data.totals.pct_allocated}%`,
                `${n1(data.totals.allocated_h)} hrs of ${n1(data.totals.paid_h)}`],
              ['Fuel', `${n1(data.totals.fuel_l)} l`,
                `${n1(data.totals.allocated_fuel_l)} l booked`],
              ['Labour cost', showMoney ? money(data.totals.cost) : '—',
                showMoney ? 'on the jobs booked' : 'hidden'],
            ].map(([label, big, sub]) => (
              <div key={label} className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight">{big}</p>
                <p className="text-[11px] text-gray-500">{sub}</p>
              </div>
            ))}
          </div>

          {/* the honest tile */}
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
            <p className="text-xs text-amber-900">
              <b>Nobody booked {n1(data.unallocated.labour_h)} paid hours
              ({data.unallocated.labour_pct}%)</b>
              {data.unallocated.machine_h ? <>, plus {n1(data.unallocated.machine_h)} machine hours
                and {n1(data.unallocated.fuel_l)} litres on machines nobody booked</> : null}.
              {' '}That is the measure of whether the work plan is being filled in &mdash; it is never
              spread quietly across the jobs.
            </p>
            {data.unallocated.machines && data.unallocated.machines.length > 0 && (
              <p className="text-[11px] text-amber-800 mt-1">
                Ran but not booked: {data.unallocated.machines.slice(0, 8)
                  .map((m) => `${m.name} (${n1(m.litres)} l)`).join(', ')}
                {data.unallocated.machines.length > 8 ? ' …' : ''}
              </p>
            )}
          </div>

          {/* views */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {VIEWS.map(([key, label]) => (
              <button key={key} onClick={() => { setView(key); setOpen({}); }}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                        view === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-x-auto">
            {view === 'person' ? (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-1.5 pr-3">Name</th>
                    <th className="py-1.5 pr-3 text-right">Paid hrs</th>
                    <th className="py-1.5 pr-3 text-right">Booked hrs</th>
                    <th className="py-1.5 pr-3">% booked</th>
                    {showMoney && <th className="py-1.5 pr-3 text-right">£/hr</th>}
                    {showMoney && <th className="py-1.5 pr-3 text-right">Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.name} className="border-b border-gray-100">
                      <td className="py-1.5 pr-3 font-medium text-gray-900">
                        {p.name}
                        {!p.employee_number && (
                          <span className="ml-1.5 text-[10px] text-amber-700">no number</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{n1(p.paid_h)}</td>
                      <td className="py-1.5 pr-3 text-right">{n1(p.booked_h)}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full ${(p.pct_booked || 0) >= 80 ? 'bg-green-600'
                              : (p.pct_booked || 0) >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                                 style={{ width: `${Math.min(p.pct_booked || 0, 100)}%` }} />
                          </div>
                          <span>{p.pct_booked === null ? '—' : `${p.pct_booked}%`}</span>
                        </div>
                      </td>
                      {showMoney && (
                        <td className="py-1.5 pr-3 text-right">
                          {p.rate ? `£${p.rate}` : '—'}
                          {p.rate_basis && p.rate_basis !== 'person' && (
                            <span className="ml-1 text-[10px] text-amber-700">{p.rate_basis}</span>
                          )}
                        </td>
                      )}
                      {showMoney && <td className="py-1.5 pr-3 text-right">{money(p.cost)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-1.5 pr-3">{VIEWS.find(([k]) => k === view)[1]}</th>
                    <th className="py-1.5 pr-3 text-right">Labour hrs</th>
                    <th className="py-1.5 pr-3 text-right">% hrs</th>
                    <th className="py-1.5 pr-3 text-right">Machine hrs</th>
                    <th className="py-1.5 pr-3 text-right">Idle %</th>
                    <th className="py-1.5 pr-3 text-right">Fuel l</th>
                    <th className="py-1.5 pr-3 text-right">% fuel</th>
                    <th className="py-1.5 pr-3 text-right">l/hr</th>
                    {showMoney && <th className="py-1.5 pr-3 text-right">Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <React.Fragment key={r.name}>
                      <tr className={`border-b border-gray-100 ${childKey ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={() => childKey && setOpen((o) => ({ ...o, [r.name]: !o[r.name] }))}>
                        <td className="py-1.5 pr-3 font-medium text-gray-900">
                          {childKey && (
                            <span className="text-gray-400 mr-1">{open[r.name] ? '▾' : '▸'}</span>
                          )}
                          {r.name}
                          {r.estimated && (
                            <span className="ml-1.5 text-[10px] text-amber-700" title="part of this is an even split, not a reading">
                              split
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-right">{n1(r.labour_h)}</td>
                        <td className="py-1.5 pr-3 text-right">{r.pct_hours}%</td>
                        <td className="py-1.5 pr-3 text-right">{n1(r.machine_h)}</td>
                        <td className="py-1.5 pr-3 text-right">{r.idle_pct === null ? '—' : `${r.idle_pct}%`}</td>
                        <td className="py-1.5 pr-3 text-right">{n1(r.fuel_l)}</td>
                        <td className="py-1.5 pr-3 text-right">{r.pct_fuel}%</td>
                        <td className="py-1.5 pr-3 text-right">{r.l_per_h === null ? '—' : r.l_per_h}</td>
                        {showMoney && <td className="py-1.5 pr-3 text-right">{money(r.labour_cost)}</td>}
                      </tr>
                      {childKey && open[r.name] && (r[childKey] || []).map((c) => (
                        <tr key={`${r.name}:${c.name}`} className="border-b border-gray-100 bg-gray-50">
                          <td className="py-1 pr-3 pl-6 text-gray-700">{c.name}</td>
                          <td className="py-1 pr-3 text-right">{n1(c.labour_h)}</td>
                          <td className="py-1 pr-3 text-right text-gray-400">
                            {r.labour_h ? `${Math.round(c.labour_h / r.labour_h * 100)}%` : '—'}
                          </td>
                          <td className="py-1 pr-3 text-right">{n1(c.machine_h)}</td>
                          <td className="py-1 pr-3 text-right">{c.idle_pct === null ? '—' : `${c.idle_pct}%`}</td>
                          <td className="py-1 pr-3 text-right">{n1(c.fuel_l)}</td>
                          <td className="py-1 pr-3 text-right text-gray-400">
                            {r.fuel_l ? `${Math.round(c.fuel_l / r.fuel_l * 100)}%` : '—'}
                          </td>
                          <td className="py-1 pr-3 text-right">{c.l_per_h === null ? '—' : c.l_per_h}</td>
                          {showMoney && <td className="py-1 pr-3 text-right">{money(c.labour_cost)}</td>}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="py-4 text-center text-gray-500">
                      Nothing booked in that span.
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {childKey && rows.length > 0 && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              The percentages are shares of the whole span, so they only add to 100% once
              nothing is left unbooked. Click a row to open it up.
            </p>
          )}

          {/* what is standing in the way */}
          {data.problems && (
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1.5">
              <p className="text-xs font-bold text-gray-900">What is holding the figures back</p>
              {data.rate_card && data.rate_card.period_start ? (
                <p className="text-[11px] text-gray-600">
                  Rates from the pay run {data.rate_card.period_start} to {data.rate_card.period_end}
                  {' · '}{data.rate_card.people_with_own_rate} people have their own £/hr
                  {data.rate_card.blended ? <> · blended £{data.rate_card.blended}/hr for the rest</> : null}
                  {data.rate_card.complete === false && (
                    <span className="text-amber-700"> · that pay run is missing clock days, so the rates read high</span>
                  )}
                </p>
              ) : (
                <p className="text-[11px] text-amber-700">
                  No payroll report uploaded, so there is no cost &mdash; hours and fuel only.
                </p>
              )}
              {data.problems.plan_rows_with_no_employee_number.length > 0 && (
                <p className="text-[11px] text-amber-800">
                  <b>No employee number on the plan for:</b>{' '}
                  {data.problems.plan_rows_with_no_employee_number
                    .map((x) => `${x.name} (${x.half_days})`).join(', ')}
                  {' '}&mdash; nothing can be tied to hours or wages for these.
                </p>
              )}
              {data.problems.machines_on_the_plan_with_no_telematics.length > 0 && (
                <p className="text-[11px] text-gray-600">
                  <b>Booked but no telematics:</b>{' '}
                  {data.problems.machines_on_the_plan_with_no_telematics.join(', ')}
                </p>
              )}
              {showMoney && data.problems.cost_resting_on_a_blended_rate > 0 && (
                <p className="text-[11px] text-gray-600">
                  {money(data.problems.cost_resting_on_a_blended_rate)} of the cost rests on the
                  blended rate rather than a person&rsquo;s own.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
