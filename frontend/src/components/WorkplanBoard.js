import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Truck, Wrench, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

// colored job chip - Mobile optimized
const Chip = ({ label, cell, colorsById, mobile = false }) => {
  const col = cell?.color_id ? colorsById[cell.color_id] : null;
  if (!cell?.job) {
    return (
      <div className={`flex-1 rounded-md bg-gray-100 text-gray-400 ${mobile ? 'text-xs px-2 py-2' : 'text-[11px] px-2 py-1'} text-center`}>
        <span className={`block font-semibold ${mobile ? 'text-[10px]' : 'text-[9px]'} text-gray-400`}>{label}</span>—
      </div>
    );
  }
  return (
    <div
      className={`flex-1 rounded-md ${mobile ? 'text-xs px-2 py-2' : 'text-[11px] px-2 py-1'} text-center font-medium`}
      style={{ background: col ? col.color : '#e5e7eb', color: col ? textOn(col.color) : '#111827' }}
    >
      <span className={`block font-semibold ${mobile ? 'text-[10px]' : 'text-[9px]'} opacity-80`}>{label}</span>
      {cell.job}
    </div>
  );
};

// Mobile-optimized teammate card
const TeammateCard = ({ row, day, colorsById, accent }) => {
  return (
    <div
      className="rounded-lg p-3 bg-white border"
      style={{ borderColor: accent || '#e5e7eb' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-gray-900">{row.employee_name}</span>
        {row.start_time && (
          <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
            <Clock className="h-3 w-3 mr-1" /> {row.start_time}
          </span>
        )}
      </div>
      {(row.vehicle || row.implement) && (
        <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
          {row.vehicle && (
            <span className="inline-flex items-center bg-gray-100 px-2 py-0.5 rounded">
              <Truck className="h-3 w-3 mr-1 text-gray-500" />{row.vehicle}
            </span>
          )}
          {row.implement && (
            <span className="inline-flex items-center bg-gray-100 px-2 py-0.5 rounded">
              <Wrench className="h-3 w-3 mr-1 text-gray-500" />{row.implement}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Chip label="AM" cell={day?.am} colorsById={colorsById} mobile={true} />
        <Chip label="PM" cell={day?.pm} colorsById={colorsById} mobile={true} />
      </div>
      {row.notes && (
        <p className="text-xs text-gray-600 italic mt-2 whitespace-pre-wrap break-words bg-gray-50 p-2 rounded">{row.notes}</p>
      )}
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

  // Normalize function for name matching - remove spaces for flexible matching
  const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '').trim();
  const userName = normalize(currentUserName);

  // Find user's own row (preserve original order from master plan)
  // Use a scoring system to find the best match
  const userRow = userName ? (() => {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const row of data.rows) {
      const day = row.days?.[selectedIdx];
      const hasWork = day && (day.am?.job || day.pm?.job);
      if (!hasWork) continue;
      
      const rowName = normalize(row.employee_name);
      
      // Exact match is best
      if (rowName === userName) {
        return row;
      }
      
      // Score based on how much of the name matches
      let score = 0;
      if (rowName.includes(userName)) {
        score = userName.length / rowName.length; // Prefer when user name is most of row name
      } else if (userName.includes(rowName)) {
        score = rowName.length / userName.length * 0.9; // Slightly lower if row name is partial
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = row;
      }
    }
    
    // Only return match if score is reasonable (at least 50% match)
    return bestScore >= 0.5 ? bestMatch : null;
  })() : null;

  // Get the user's manager
  const userManager = userRow?.manager?.trim() || null;

  // Find teammates (same manager, same day, has work) - preserve original order from master plan
  const isCurrentUser = (rowName) => {
    const normalized = normalize(rowName);
    if (normalized === userName) return true;
    // Check if names are substantially similar (>50% overlap)
    if (normalized.includes(userName)) {
      return userName.length / normalized.length >= 0.5;
    }
    if (userName.includes(normalized)) {
      return normalized.length / userName.length >= 0.5;
    }
    return false;
  };

  const teammates = userManager ? data.rows.filter((row) => {
    if (isCurrentUser(row.employee_name)) return false; // exclude self
    const day = row.days?.[selectedIdx];
    const hasWork = day && (day.am?.job || day.pm?.job);
    if (!hasWork) return false;
    return (row.manager?.trim() || 'Unassigned') === userManager;
  }) : [];

  // For non-personal users (admin viewing), build groups - preserve original order
  const groups = {};
  const rowOrder = {}; // track original order
  data.rows.forEach((row, originalIndex) => {
    if (!row.employee_name) return;
    const day = row.days?.[selectedIdx];
    const hasWork = day && (day.am?.job || day.pm?.job);
    if (!hasWork) return;
    const mgr = (row.manager || 'Unassigned').trim() || 'Unassigned';
    if (!groups[mgr]) groups[mgr] = [];
    groups[mgr].push({ row, day, originalIndex });
    rowOrder[row.employee_name] = originalIndex;
  });
  
  // Sort groups by first member's original index to preserve manager group order
  const groupNames = Object.keys(groups).sort((a, b) => {
    const firstA = groups[a][0]?.originalIndex ?? 999;
    const firstB = groups[b][0]?.originalIndex ?? 999;
    return firstA - firstB;
  });

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

  const userDay = userRow?.days?.[selectedIdx];
  const accent = managerAccent(userManager);
  const tint = managerTint(userManager);

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

      {/* MOBILE: User's personal schedule (prominent display) */}
      {userRow && (
        <div className="p-3 sm:p-4" data-testid="user-schedule-mobile">
          {/* Your Schedule Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-100 p-1.5 rounded-full">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-base sm:text-lg">Your Schedule</span>
              <p className="text-xs text-gray-500">{dayLabel(selected, selectedIdx)}</p>
            </div>
          </div>

          {/* User's own card - prominent */}
          <div 
            className="rounded-xl p-4 mb-4 border-2"
            style={{ 
              background: `linear-gradient(135deg, ${tint || '#f0fdf4'} 0%, #ffffff 100%)`,
              borderColor: accent || '#22c55e'
            }}
            data-testid="user-own-schedule"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <span className="font-bold text-lg text-gray-900">{userRow.employee_name}</span>
              {userRow.start_time && (
                <span className="inline-flex items-center text-base font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg w-fit">
                  <Clock className="h-4 w-4 mr-1.5" /> Start: {userRow.start_time}
                </span>
              )}
            </div>

            {/* Vehicle/Implement info */}
            {(userRow.vehicle || userRow.implement) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {userRow.vehicle && (
                  <span className="inline-flex items-center text-sm bg-white px-3 py-1.5 rounded-lg border">
                    <Truck className="h-4 w-4 mr-1.5 text-gray-500" />{userRow.vehicle}
                  </span>
                )}
                {userRow.implement && (
                  <span className="inline-flex items-center text-sm bg-white px-3 py-1.5 rounded-lg border">
                    <Wrench className="h-4 w-4 mr-1.5 text-gray-500" />{userRow.implement}
                  </span>
                )}
              </div>
            )}

            {/* AM/PM Jobs - larger on mobile */}
            <div className="flex gap-3">
              <Chip label="AM" cell={userDay?.am} colorsById={colorsById} mobile={true} />
              <Chip label="PM" cell={userDay?.pm} colorsById={colorsById} mobile={true} />
            </div>

            {/* Notes */}
            {userRow.notes && (
              <p className="text-sm text-gray-700 mt-3 bg-white/70 p-3 rounded-lg whitespace-pre-wrap break-words">
                {userRow.notes}
              </p>
            )}

            {/* Manager info */}
            {userManager && userManager !== 'Unassigned' && (
              <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200">
                Reporting to <span className="font-medium">{userManager}</span>
              </p>
            )}
          </div>

          {/* Teammates section */}
          {teammates.length > 0 && (
            <div className="mt-4" data-testid="teammates-section">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-purple-100 p-1.5 rounded-full">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <span className="font-semibold text-gray-800 text-sm">Working With You</span>
                  <p className="text-xs text-gray-500">Under {userManager}</p>
                </div>
              </div>
              <div className="space-y-2">
                {teammates.map((row, i) => (
                  <TeammateCard 
                    key={i} 
                    row={row} 
                    day={row.days?.[selectedIdx]} 
                    colorsById={colorsById}
                    accent={accent}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DESKTOP/ADMIN: Full groups view (when no personal schedule or scrolled down) */}
      {!userRow && (
        <div className="p-3 space-y-4 max-h-[28rem] overflow-y-auto">
          {groupNames.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No jobs assigned for this day.</p>
          )}
          {groupNames.map((mgr) => {
            const groupTint = managerTint(mgr);
            const groupAccent = managerAccent(mgr);
            return (
            <div key={mgr}>
              <div className="text-xs font-bold uppercase tracking-wide mb-1.5 border-b pb-1 flex items-center gap-1.5" style={{ color: managerAccent(mgr) }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: groupAccent }} />
                {mgr === 'Unassigned' ? 'Unassigned' : `Reporting to ${mgr}`}
              </div>
              <div className="space-y-2">
                {groups[mgr].map(({ row, day }, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-2.5"
                    style={{
                      background: groupTint || '#ffffff',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderLeftWidth: 4,
                      borderLeftColor: row.group_color || groupAccent,
                    }}
                    data-testid={`wp-board-person-${i}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{row.employee_name}</span>
                        {row.start_time && (
                          <span className="inline-flex items-center text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            <Clock className="h-3.5 w-3.5 mr-1" /> Start: {row.start_time}
                          </span>
                        )}
                      </div>
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
      )}
    </div>
  );
}
