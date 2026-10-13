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
  ['manager', 'Manager'],
  ['team', 'Team'],
  ['person', 'People'],
];

const CHILD_KEYS = {
  dept: ['jobs', 'fields'],
  field: ['crops', 'jobs'],
  job: ['crops', 'fields'],
  machine: ['crops', 'jobs'],
  manager: ['teams', 'crops'],
  team: ['crops', 'jobs'],
  person: ['crops', 'jobs'],
};

const LEVEL_LABEL = {
  crops: 'Crop / Dept',
  jobs: 'Job',
  fields: 'Field',
  teams: 'Team',
};

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

  // One row, then its children indented under it, as deep as the view goes.
  // Percentages at the top level are shares of the whole span; inside an
  // opened row they switch to a share of that row, and the page says so.
  const renderRows = (list, levels, parentPath, depth, parent) => (list || []).flatMap((r) => {
    const path = parentPath ? `${parentPath} \u203a ${r.name}` : r.name;
    const key = levels[0];
    const kids = key ? (r[key] || []) : [];
    const canOpen = kids.length > 0;
    const isOpen = !!open[path];
    const pctH = depth === 0
      ? `${r.pct_hours}%`
      : (parent && parent.labour_h ? `${Math.round(r.labour_h / parent.labour_h * 100)}%` : '\u2014');
    const pctF = depth === 0
      ? `${r.pct_fuel}%`
      : (parent && parent.fuel_l ? `${Math.round(r.fuel_l / parent.fuel_l * 100)}%` : '\u2014');
    const out = [(
      <tr
        key={path}
        className={`border-b border-gray-100 ${depth === 0 ? '' : depth === 1 ? 'bg-gray-50' : 'bg-gray-100'} ${canOpen ? 'cursor-pointer hover:bg-gray-100' : ''}`}
        onClick={() => canOpen && setOpen((o) => ({ ...o, [path]: !o[path] }))}
      >
        <td className={`py-1.5 pr-3 ${depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}
            style={{ paddingLeft: depth * 18 }}>
          {canOpen
            ? <span className="text-gray-400 mr-1">{isOpen ? '\u25be' : '\u25b8'}</span>
            : <span className="inline-block mr-1" style={{ width: depth ? 0 : 10 }} />}
          {r.name}
          {depth > 0 && key && (
            <span className="ml-1.5 text-[10px] text-gray-400">{LEVEL_LABEL[key]}</span>
          )}
          {r.estimated && depth === 0 && (
            <span className="ml-1.5 text-[10px] text-amber-700" title="part of this is an even split, not a reading">
              split
            </span>
          )}
        </td>
        <td className="py-1.5 pr-3 text-right">{n1(r.labour_h)}</td>
        <td className={`py-1.5 pr-3 text-right ${depth ? 'text-gray-400' : ''}`}>{pctH}</td>
        <td className="py-1.5 pr-3 text-right">{n1(r.machine_h)}</td>
        <td className="py-1.5 pr-3 text-right">{r.idle_pct === null ? '\u2014' : `${r.idle_pct}%`}</td>
        <td className="py-1.5 pr-3 text-right">{n1(r.fuel_l)}</td>
        <td className={`py-1.5 pr-3 text-right ${depth ? 'text-gray-400' : ''}`}>{pctF}</td>
        <td className="py-1.5 pr-3 text-right">{r.l_per_h === null ? '\u2014' : r.l_per_h}</td>
        {showMoney && <td className="py-1.5 pr-3 text-right">{money(r.labour_cost)}</td>}
      </tr>
    )];
    if (isOpen && canOpen) {
      out.push(...renderRows(kids, levels.slice(1), path, depth + 1, r));
    }
    return out;
  });
  // Every list opens the same way: Crop/Department, then job. Where the row
  // IS a crop the second level is the job and the third the field; where the
  // row is a job the third level is the field, so you never drill job to job.
  const keys = CHILD_KEYS[view] || [];
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
                    <React.Fragment key={p.name}>
                    <tr className={`border-b border-gray-100 ${(p.crops || []).length ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        onClick={() => (p.crops || []).length && setOpen((o) => ({ ...o, [p.name]: !o[p.name] }))}>
                      <td className="py-1.5 pr-3 font-medium text-gray-900">
                        {(p.crops || []).length
                          ? <span className="text-gray-400 mr-1">{open[p.name] ? '\u25be' : '\u25b8'}</span>
                          : <span className="inline-block mr-1" style={{ width: 10 }} />}
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
                    {open[p.name] && (p.crops || []).map((c) => (
                      <React.Fragment key={`${p.name}:${c.name}`}>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <td className="py-1 pr-3 text-gray-700" style={{ paddingLeft: 18 }}>
                            {c.name}
                            <span className="ml-1.5 text-[10px] text-gray-400">Crop / Dept</span>
                          </td>
                          <td className="py-1 pr-3 text-right text-gray-400">&mdash;</td>
                          <td className="py-1 pr-3 text-right">{n1(c.labour_h)}</td>
                          <td className="py-1 pr-3 text-gray-400">
                            {p.booked_h ? `${Math.round(c.labour_h / p.booked_h * 100)}% of booked` : '\u2014'}
                          </td>
                          {showMoney && <td className="py-1 pr-3 text-right text-gray-400">&mdash;</td>}
                          {showMoney && <td className="py-1 pr-3 text-right">{money(c.labour_cost)}</td>}
                        </tr>
                        {(c.jobs || []).map((j) => (
                          <tr key={`${p.name}:${c.name}:${j.name}`} className="border-b border-gray-100 bg-gray-100">
                            <td className="py-1 pr-3 text-gray-600" style={{ paddingLeft: 36 }}>
                              {j.name}
                              <span className="ml-1.5 text-[10px] text-gray-400">Job</span>
                            </td>
                            <td className="py-1 pr-3 text-right text-gray-400">&mdash;</td>
                            <td className="py-1 pr-3 text-right">{n1(j.labour_h)}</td>
                            <td className="py-1 pr-3 text-gray-400">
                              {c.labour_h ? `${Math.round(j.labour_h / c.labour_h * 100)}% of ${c.name}` : '\u2014'}
                            </td>
                            {showMoney && <td className="py-1 pr-3 text-right text-gray-400">&mdash;</td>}
                            {showMoney && <td className="py-1 pr-3 text-right">{money(j.labour_cost)}</td>}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    </React.Fragment>
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
                  {renderRows(rows, keys, '', 0, null)}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="py-4 text-center text-gray-500">
                      Nothing booked in that span.
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > 0 && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Click any row to open it: <b>Crop / Department</b>, then <b>job</b> inside it.
              The top-level percentages are shares of the whole span, so they only add to
              100% once nothing is left unbooked; inside an opened row they are shares of
              that row.
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
