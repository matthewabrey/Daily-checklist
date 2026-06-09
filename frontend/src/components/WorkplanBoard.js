import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Truck, Wrench, User } from 'lucide-react';
import { useAuth } from '../App';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d;
};
const textOn = (hex) => {
  if (!hex) return '#111827';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
};

// deterministic soft pastel background per manager (matches the editor)
const managerTint = (name, light = 94) => {
  if (!name || !name.trim() || name.trim() === 'Unassigned') return null;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, ${light}%)`;
};
const managerAccent = (name) => {
  if (!name || !name.trim() || name.trim() === 'Unassigned') return '#e5e7eb';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 65%)`;
};

// colored job chip
const Chip = ({ label, cell, colorsById }) => {
  const col = cell?.color_id ? colorsById[cell.color_id] : null;
  if (!cell?.job) {
    return (
      <div className="flex-1 rounded-md bg-gray-100 text-gray-400 text-[11px] px-2 py-1 text-center">
        <span className="block font-semibold text-[9px] text-gray-400">{label}</span>—
      </div>
    );
  }
  return (
    <div
      className="flex-1 rounded-md text-[11px] px-2 py-1 text-center font-medium"
      style={{ background: col ? col.color : '#e5e7eb', color: col ? textOn(col.color) : '#111827' }}
    >
      <span className="block font-semibold text-[9px] opacity-80">{label}</span>
      {cell.job}
    </div>
  );
};

export default function WorkplanBoard() {
  const { employee } = useAuth();
  const currentUserName = employee?.name || '';
  
  const [data, setData] = useState(null);
  const [colors, setColors] = useState([]);
  const [activeDay, setActiveDay] = useState(null); // ISO date

  useEffect(() => {
    const load = async () => {
      try {
        const [wpRes, colorsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/workplan/published`),
          fetch(`${API_BASE_URL}/api/workplan/colors`),
        ]);
        setData(await wpRes.json());
        setColors(await colorsRes.json());
      } catch {
        setData({ week_start: null, rows: [] });
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  if (!data || !data.week_start || !data.rows || data.rows.length === 0) return null;

  const colorsById = Object.fromEntries(colors.map((c) => [c.id, c]));
  const todayISO = toISO(new Date());

  // build day list (only days within the published week, today onwards)
  const dayList = [];
  for (let i = 0; i < 7; i++) {
    const iso = toISO(addDays(data.week_start, i));
    if (iso >= todayISO) dayList.push({ iso, index: i });
  }
  if (dayList.length === 0) return null; // whole published week is in the past

  const selected = activeDay && dayList.find((d) => d.iso === activeDay) ? activeDay : dayList[0].iso;
  const selectedIdx = dayList.find((d) => d.iso === selected).index;

  // rows that have something for the selected day, grouped by manager
  const groups = {};
  data.rows.forEach((row) => {
    if (!row.employee_name) return;
    const day = row.days?.[selectedIdx];
    const hasWork = day && (day.am?.job || day.pm?.job);
    if (!hasWork) return;
    const mgr = (row.manager || 'Unassigned').trim() || 'Unassigned';
    (groups[mgr] = groups[mgr] || []).push({ row, day });
  });
  const groupNames = Object.keys(groups).sort();

  // Find user's assignments (as employee or manager)
  const normalize = (s) => (s || '').toLowerCase().trim();
  const userName = normalize(currentUserName);
  
  const userAssignments = userName ? data.rows.filter((row) => {
    const day = row.days?.[selectedIdx];
    const hasWork = day && (day.am?.job || day.pm?.job);
    if (!hasWork) return false;
    return normalize(row.employee_name).includes(userName) || normalize(row.manager).includes(userName);
  }) : [];

  const isUserEmployee = userAssignments.some(r => normalize(r.employee_name).includes(userName));
  const isUserManager = userAssignments.some(r => normalize(r.manager).includes(userName));

  // Full label for desktop, short for mobile
  const dayLabel = (iso, idx) => {
    const d = new Date(iso + 'T00:00:00');
    const isToday = iso === todayISO;
    const isTomorrow = iso === toISO(addDays(todayISO, 1));
    const prefix = isToday ? 'Today · ' : isTomorrow ? 'Tomorrow · ' : '';
    return `${prefix}${DAY_NAMES[idx]} ${d.getDate()}`;
  };
  
  // Short label for mobile
  const dayLabelShort = (iso, idx) => {
    const d = new Date(iso + 'T00:00:00');
    const isToday = iso === todayISO;
    return isToday ? 'Today' : `${DAY_NAMES[idx]} ${d.getDate()}`;
  };

  return (
    <div className="bg-white border border-green-200 rounded-lg shadow-sm overflow-hidden" data-testid="workplan-board">
      <div className="bg-green-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="font-semibold text-sm">Work Plan</span>
        </div>
        <span className="text-[10px] opacity-80 hidden sm:inline">
          {data.published_at ? `Updated ${new Date(data.published_at).toLocaleDateString()}` : ''}
        </span>
      </div>

      {/* day tabs - scrollable on mobile */}
      <div className="flex gap-1 sm:gap-1.5 overflow-x-auto px-2 sm:px-3 py-1.5 sm:py-2 border-b bg-green-50 scrollbar-hide">
        {dayList.map((d) => (
          <button
            key={d.iso}
            onClick={() => setActiveDay(d.iso)}
            className={`whitespace-nowrap px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-colors flex-shrink-0 ${
              d.iso === selected ? 'bg-green-600 text-white' : 'bg-white text-green-700 border border-green-200'
            }`}
            data-testid={`wp-day-tab-${d.index}`}
          >
            <span className="hidden sm:inline">{dayLabel(d.iso, d.index)}</span>
            <span className="sm:hidden">{dayLabelShort(d.iso, d.index)}</span>
          </button>
        ))}
      </div>

      {/* User's assignments banner */}
      {currentUserName && userAssignments.length > 0 && (
        <div className="mx-3 mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3" data-testid="user-assignments-banner">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-gray-800 text-sm">Your Schedule for Today</span>
            {isUserEmployee && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Employee</span>}
            {isUserManager && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Manager</span>}
          </div>
          <div className="space-y-2">
            {userAssignments.map((row, i) => {
              const day = row.days?.[selectedIdx];
              const tint = managerTint(row.manager);
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg p-2 border"
                  style={{ background: tint || '#f9fafb', borderColor: managerAccent(row.manager) || '#e5e7eb' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{row.employee_name}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2">
                      {row.vehicle && <span className="flex items-center gap-0.5"><Truck className="h-3 w-3" />{row.vehicle}</span>}
                      {row.start_time && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{row.start_time}</span>}
                      {row.notes && <span className="truncate">{row.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Chip label="AM" cell={day?.am} colorsById={colorsById} />
                    <Chip label="PM" cell={day?.pm} colorsById={colorsById} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* groups */}
      <div className="p-3 space-y-4 max-h-[28rem] overflow-y-auto">
        {groupNames.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No jobs assigned for this day.</p>
        )}
        {groupNames.map((mgr) => {
          const tint = managerTint(mgr);
          const accent = managerAccent(mgr);
          return (
          <div key={mgr}>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5 border-b pb-1 flex items-center gap-1.5" style={{ color: managerAccent(mgr) }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              {mgr === 'Unassigned' ? 'Unassigned' : `Reporting to ${mgr}`}
            </div>
            <div className="space-y-2">
              {groups[mgr].map(({ row, day }, i) => (
                <div
                  key={i}
                  className="rounded-lg p-2.5"
                  style={{
                    background: tint || '#ffffff',
                    border: '1px solid rgba(0,0,0,0.06)',
                    borderLeftWidth: 4,
                    borderLeftColor: row.group_color || accent,
                  }}
                  data-testid={`wp-board-person-${i}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm text-gray-900">{row.employee_name}</span>
                    {row.start_time && (
                      <span className="inline-flex items-center text-[11px] text-gray-600">
                        <Clock className="h-3 w-3 mr-0.5" /> {row.start_time}
                      </span>
                    )}
                  </div>
                  {mgr !== 'Unassigned' && (
                    <div className="text-[10px] text-gray-500 mb-1.5">Reporting to {mgr}</div>
                  )}
                  {(row.vehicle || row.implement) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600 mb-1.5">
                      {row.vehicle && (
                        <span className="inline-flex items-center"><Truck className="h-3 w-3 mr-1 text-gray-500" />{row.vehicle}</span>
                      )}
                      {row.implement && (
                        <span className="inline-flex items-center"><Wrench className="h-3 w-3 mr-1 text-gray-500" />{row.implement}</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <Chip label="AM" cell={day.am} colorsById={colorsById} />
                    <Chip label="PM" cell={day.pm} colorsById={colorsById} />
                  </div>
                  {row.notes && (
                    <p className="text-[11px] text-gray-600 italic mt-1.5 whitespace-pre-wrap break-words">{row.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
