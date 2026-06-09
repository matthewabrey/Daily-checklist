import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Save, Send, Trash2, Copy, Palette, ListPlus,
  ChevronUp, ChevronDown, X, CheckCircle2, ArrowRightToLine, BarChart3, UserX, UserCheck, User
} from 'lucide-react';
import { useAuth } from '../App';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d;
};
const fmtDay = (iso, i) => {
  const d = addDays(iso, i);
  return `${DAY_NAMES[i]} ${d.getDate()}`;
};

// ---------- contrast helper ----------
const textOn = (hex) => {
  if (!hex) return '#111827';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
};

// deterministic soft pastel background per manager name
export const managerTint = (name, light = 94) => {
  if (!name || !name.trim()) return null;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, ${light}%)`;
};

const emptyDays = () =>
  Array.from({ length: 7 }, () => ({ am: { job: '', color_id: null }, pm: { job: '', color_id: null } }));

const newRow = () => ({
  id: (crypto?.randomUUID && crypto.randomUUID()) || `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  vehicle: '',
  implement: '',
  employee_name: '',
  manager: '',
  start_time: '06:30',
  notes: '',
  group_color: null,
  left: false,
  days: emptyDays(),
});

export default function WorkplanEditor() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const currentUserName = employee?.name || '';
  
  const [weekStart, setWeekStart] = useState(toISO(mondayOf(new Date())));
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [colors, setColors] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [assetOptions, setAssetOptions] = useState([]);
  const [saveState, setSaveState] = useState('saved'); // saving | saved | idle
  const [publishedAt, setPublishedAt] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [editingCell, setEditingCell] = useState(null); // {rowId, dayIndex, period}
  const [showColors, setShowColors] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [bandPickerRow, setBandPickerRow] = useState(null);
  const [showLeavers, setShowLeavers] = useState(false);
  const [showCosting, setShowCosting] = useState(false);
  const [costingData, setCostingData] = useState(null);
  const [costingFrom, setCostingFrom] = useState('');
  const [costingUntil, setCostingUntil] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set()); // row IDs selected for copy
  const [selectedDay, setSelectedDay] = useState(null); // day index selected for day copy (0-6)

  // excel-like cell selection / clipboard / drag-fill
  const [selCells, setSelCells] = useState([]); // [{rowIdx, colIdx}]
  const [anchor, setAnchor] = useState(null); // {rowIdx, colIdx}
  const [clipboard, setClipboard] = useState(null); // {job, color_id}
  const [dragRect, setDragRect] = useState(null); // {r0,r1,c0,c1}
  const dragRef = useRef({ active: false, start: null, content: null });

  const saveTimer = useRef(null);

  // ---------- initial load ----------
  useEffect(() => {
    (async () => {
      try {
        const [wpRes, jobsRes, colorsRes, staffRes, assetsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/workplan`),
          fetch(`${API_BASE_URL}/api/workplan/jobs`),
          fetch(`${API_BASE_URL}/api/workplan/colors`),
          fetch(`${API_BASE_URL}/api/staff`),
          fetch(`${API_BASE_URL}/api/assets`),
        ]);
        const wp = await wpRes.json();
        setJobs(await jobsRes.json());
        setColors(await colorsRes.json());
        const staff = await staffRes.json();
        setStaffOptions(staff.map((s) => s.name).filter(Boolean).sort());
        const assets = await assetsRes.json();
        setAssetOptions(
          [...new Set(assets.map((a) => `${a.make} ${a.name}`.trim()))].sort()
        );
        if (wp.week_start) setWeekStart(wp.week_start);
        setRows((wp.rows && wp.rows.length ? wp.rows : [newRow()]).map(normalizeRow));
        setPublishedAt(wp.published_at);
      } catch (e) {
        toast.error('Failed to load workplan');
        setRows([newRow()]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const normalizeRow = (r) => {
    // days can be an array [7 items] OR dict {"0": ..., "1": ...} from the backend import
    let normalizedDays;
    if (Array.isArray(r.days) && r.days.length === 7) {
      normalizedDays = r.days.map((d) => ({
        am: { job: d?.am?.job || '', color_id: d?.am?.color_id ?? null, color: d?.am?.color || '' },
        pm: { job: d?.pm?.job || '', color_id: d?.pm?.color_id ?? null, color: d?.pm?.color || '' },
      }));
    } else if (r.days && typeof r.days === 'object' && !Array.isArray(r.days)) {
      normalizedDays = [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const src = r.days[d] || r.days[String(d)] || {};
        return {
          am: { job: src?.am?.job || '', color_id: src?.am?.color_id ?? null, color: src?.am?.color || '' },
          pm: { job: src?.pm?.job || '', color_id: src?.pm?.color_id ?? null, color: src?.pm?.color || '' },
        };
      });
    } else {
      normalizedDays = emptyDays();
    }
    return { ...newRow(), ...r, days: normalizedDays };
  };

  // ---------- autosave ----------
  const persist = useCallback(async (ws, rws) => {
    setSaveState('saving');
    try {
      await fetch(`${API_BASE_URL}/api/workplan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: ws, rows: rws }),
      });
      setSaveState('saved');
    } catch {
      setSaveState('idle');
      toast.error('Auto-save failed');
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(weekStart, rows), 700);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [rows, weekStart, loaded, persist]);

  const colorsById = Object.fromEntries(colors.map((c) => [c.id, c]));

  // ---------- row ops ----------
  const updateRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const updateCell = (rowId, dayIndex, period, patch) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r;
        const days = r.days.map((d, i) =>
          i === dayIndex ? { ...d, [period]: { ...d[period], ...patch } } : d
        );
        return { ...r, days };
      })
    );

  const copyCellAcrossWeek = (rowId, dayIndex, period) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r;
        const src = r.days[dayIndex][period];
        const days = r.days.map((d) => ({ ...d, [period]: { ...src } }));
        return { ...r, days };
      })
    );

  const copyDayAcrossWeek = (rowId, dayIndex) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r;
        const src = r.days[dayIndex];
        const days = r.days.map(() => ({ am: { ...src.am }, pm: { ...src.pm } }));
        return { ...r, days };
      })
    );

  const addRow = () => { clearSelection(); setRows((rs) => [...rs, newRow()]); };
  const duplicateRow = (id) => {
    clearSelection();
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.id === id);
      const clone = { ...JSON.parse(JSON.stringify(rs[idx])), id: newRow().id };
      const copy = [...rs];
      copy.splice(idx + 1, 0, clone);
      return copy;
    });
  };
  const deleteRow = (id) => { clearSelection(); setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs)); };
  const moveRow = (id, dir) => {
    clearSelection();
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.id === id);
      const j = idx + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  };
  const sortByManager = () => {
    clearSelection();
    setRows((rs) => [...rs].sort((a, b) => (a.manager || 'zzz').localeCompare(b.manager || 'zzz')));
  };

  // ---------- row selection & copy ----------
  const toggleRowSelection = (rowId) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };
  const selectAllRows = () => {
    const allIds = new Set(displayRows.map((r) => r.id));
    setSelectedRows(allIds);
  };
  const clearRowSelection = () => setSelectedRows(new Set());
  const copySelectedRows = () => {
    if (selectedRows.size === 0) {
      toast.error('No rows selected');
      return;
    }
    const toCopy = rows.filter((r) => selectedRows.has(r.id));
    const copies = toCopy.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      employee_name: r.employee_name ? `${r.employee_name} (copy)` : '',
    }));
    setRows((rs) => [...rs, ...copies]);
    setSelectedRows(new Set());
    toast.success(`Copied ${copies.length} row(s)`);
  };

  // ---------- day column copy ----------
  const selectDayColumn = (dayIndex) => {
    if (selectedDay === dayIndex) {
      setSelectedDay(null); // deselect if clicking same day
    } else {
      setSelectedDay(dayIndex);
    }
  };
  
  const copyDayToDay = (targetDayIndex) => {
    if (selectedDay === null || selectedDay === targetDayIndex) return;
    
    setRows((rs) => rs.map((r) => {
      const sourceDay = r.days[selectedDay];
      const newDays = [...r.days];
      newDays[targetDayIndex] = {
        am: { ...sourceDay.am },
        pm: { ...sourceDay.pm },
      };
      return { ...r, days: newDays };
    }));
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    toast.success(`Copied ${dayNames[selectedDay]} → ${dayNames[targetDayIndex]} for all rows`);
    setSelectedDay(null);
  };

  // ---------- excel-like cell ops ----------
  const colToDay = (colIdx) => ({ dayIndex: Math.floor(colIdx / 2), period: colIdx % 2 === 0 ? 'am' : 'pm' });
  const getCellByIdx = (rowIdx, colIdx) => {
    const { dayIndex, period } = colToDay(colIdx);
    return rows[rowIdx]?.days?.[dayIndex]?.[period] || null;
  };
  const isCellSelected = (rowIdx, colIdx) => selCells.some((c) => c.rowIdx === rowIdx && c.colIdx === colIdx);
  const clearSelection = () => { setSelCells([]); setAnchor(null); };

  // apply a full content {job,color_id} to a list of cells
  const applyToCells = (cells, content) =>
    setRows((rs) => {
      const map = {};
      cells.forEach((c) => { (map[c.rowIdx] = map[c.rowIdx] || new Set()).add(c.colIdx); });
      return rs.map((r, ri) => {
        if (!map[ri]) return r;
        const cols = map[ri];
        const days = r.days.map((d, di) => {
          const amCol = di * 2, pmCol = di * 2 + 1;
          let nd = d;
          if (cols.has(amCol)) nd = { ...nd, am: { job: content.job, color_id: content.color_id ?? null } };
          if (cols.has(pmCol)) nd = { ...nd, pm: { job: content.job, color_id: content.color_id ?? null } };
          return nd;
        });
        return { ...r, days };
      });
    });

  // merge a partial patch ({job} or {color_id}) into a list of cells
  const patchCells = (cells, patch) =>
    setRows((rs) => {
      const map = {};
      cells.forEach((c) => { (map[c.rowIdx] = map[c.rowIdx] || new Set()).add(c.colIdx); });
      return rs.map((r, ri) => {
        if (!map[ri]) return r;
        const cols = map[ri];
        const days = r.days.map((d, di) => {
          const amCol = di * 2, pmCol = di * 2 + 1;
          let nd = d;
          if (cols.has(amCol)) nd = { ...nd, am: { ...nd.am, ...patch } };
          if (cols.has(pmCol)) nd = { ...nd, pm: { ...nd.pm, ...patch } };
          return nd;
        });
        return { ...r, days };
      });
    });

  // tile a source block (matrix of {job,color_id}) across a target rectangle
  const fillTile = (r0, r1, c0, c1, srcBox, matrix) => {
    const H = srcBox.r1 - srcBox.r0 + 1;
    const W = srcBox.c1 - srcBox.c0 + 1;
    const pick = (ri, ci) => {
      const h = (((ri - srcBox.r0) % H) + H) % H;
      const w = (((ci - srcBox.c0) % W) + W) % W;
      const cell = matrix[h][w];
      return { job: cell.job, color_id: cell.color_id ?? null };
    };
    setRows((rs) =>
      rs.map((r, ri) => {
        if (ri < r0 || ri > r1) return r;
        const days = r.days.map((d, di) => {
          const amCol = di * 2, pmCol = di * 2 + 1;
          let am = d.am, pm = d.pm;
          if (amCol >= c0 && amCol <= c1) am = pick(ri, amCol);
          if (pmCol >= c0 && pmCol <= c1) pm = pick(ri, pmCol);
          return { ...d, am, pm };
        });
        return { ...r, days };
      })
    );
  };

  const copySelected = () => {
    if (!anchor) return;
    const c = getCellByIdx(anchor.rowIdx, anchor.colIdx);
    if (c) { setClipboard({ job: c.job, color_id: c.color_id }); toast.success('Cell copied'); }
  };
  const pasteSelected = () => { if (clipboard && selCells.length) applyToCells(selCells, clipboard); };
  const clearSelected = () => { if (selCells.length) applyToCells(selCells, { job: '', color_id: null }); };

  const handleCellClick = (rowIdx, colIdx, e) => {
    const meta = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    if (meta) {
      setSelCells((prev) =>
        prev.some((c) => c.rowIdx === rowIdx && c.colIdx === colIdx)
          ? prev.filter((c) => !(c.rowIdx === rowIdx && c.colIdx === colIdx))
          : [...prev, { rowIdx, colIdx }]
      );
      setAnchor({ rowIdx, colIdx });
    } else if (shift && anchor) {
      const r0 = Math.min(anchor.rowIdx, rowIdx), r1 = Math.max(anchor.rowIdx, rowIdx);
      const c0 = Math.min(anchor.colIdx, colIdx), c1 = Math.max(anchor.colIdx, colIdx);
      const cells = [];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells.push({ rowIdx: r, colIdx: c });
      setSelCells(cells);
    } else if (selCells.length > 1 && isCellSelected(rowIdx, colIdx)) {
      // keep an existing multi-selection (so a double-click can edit them all); just move the anchor
      setAnchor({ rowIdx, colIdx });
    } else {
      setSelCells([{ rowIdx, colIdx }]);
      setAnchor({ rowIdx, colIdx });
    }
  };
  const openEditorAt = (rowIdx, colIdx) => {
    if (!isCellSelected(rowIdx, colIdx)) { setSelCells([{ rowIdx, colIdx }]); }
    setAnchor({ rowIdx, colIdx });
    const { dayIndex, period } = colToDay(colIdx);
    setEditingCell({ rowId: rows[rowIdx].id, dayIndex, period });
  };
  // from the cell editor: apply to all selected cells when >1 selected, else just the editing cell
  const applyEditorValue = (patch) => {
    if (selCells.length > 1) patchCells(selCells, patch);
    else if (editingCell) updateCell(editingCell.rowId, editingCell.dayIndex, editingCell.period, patch);
  };
  // bounding box of the current selection (the source block for drag-fill)
  const selBox = selCells.length
    ? {
        r0: Math.min(...selCells.map((c) => c.rowIdx)),
        r1: Math.max(...selCells.map((c) => c.rowIdx)),
        c0: Math.min(...selCells.map((c) => c.colIdx)),
        c1: Math.max(...selCells.map((c) => c.colIdx)),
      }
    : null;
  const buildMatrix = (box) => {
    const m = [];
    for (let r = box.r0; r <= box.r1; r++) {
      const rowArr = [];
      for (let c = box.c0; c <= box.c1; c++) {
        const cell = getCellByIdx(r, c);
        rowArr.push(cell ? { job: cell.job, color_id: cell.color_id } : { job: '', color_id: null });
      }
      m.push(rowArr);
    }
    return m;
  };
  // start dragging the whole selected block from its bottom-right handle
  const startDragFromSelection = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selBox) return;
    dragRef.current = { active: true, src: selBox, matrix: buildMatrix(selBox) };
    setDragRect({ ...selBox });
  };
  const dragEnter = (rowIdx, colIdx) => {
    if (!dragRef.current.active) return;
    const s = dragRef.current.src;
    setDragRect({
      r0: Math.min(s.r0, rowIdx), r1: Math.max(s.r1, rowIdx),
      c0: Math.min(s.c0, colIdx), c1: Math.max(s.c1, colIdx),
    });
  };

  // keyboard copy/paste/clear
  useEffect(() => {
    const onKey = (e) => {
      if (editingCell || showColors || showJobs || bandPickerRow || !selCells.length) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelected(); }
      else if (meta && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSelected(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearSelected(); }
      else if (e.key === 'Escape') { clearSelection(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // finish drag-fill on pointer release
  useEffect(() => {
    const onUp = () => {
      const dr = dragRef.current;
      if (dr.active && dragRect && dr.matrix) {
        fillTile(dragRect.r0, dragRect.r1, dragRect.c0, dragRect.c1, dr.src, dr.matrix);
      }
      dragRef.current = { active: false, src: null, matrix: null };
      setDragRect(null);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [dragRect]);

  // ---------- publish ----------
  const publish = async () => {
    await persist(weekStart, rows);
    try {
      const res = await fetch(`${API_BASE_URL}/api/workplan/publish`, { method: 'POST' });
      const data = await res.json();
      setPublishedAt(data.published_at);
      toast.success('Workplan published to the home screen');
    } catch {
      toast.error('Publish failed');
    }
  };

  const editing =
    editingCell && rows.find((r) => r.id === editingCell.rowId)
      ? {
          row: rows.find((r) => r.id === editingCell.rowId),
          ...editingCell,
        }
      : null;

  // hide days that have already passed (kept in data for costing, just not shown)
  const todayISO = toISO(new Date());
  let visibleDays = [0, 1, 2, 3, 4, 5, 6].filter((i) => toISO(addDays(weekStart, i)) >= todayISO);
  if (visibleDays.length === 0) visibleDays = [0, 1, 2, 3, 4, 5, 6];
  const hiddenPast = 7 - visibleDays.length;

  const inRect = (ri, ci) => dragRect && ri >= dragRect.r0 && ri <= dragRect.r1 && ci >= dragRect.c0 && ci <= dragRect.c1;

  // Filtered datalist options (max 30 to avoid slow rendering)
  const filteredStaff = staffFilter
    ? staffOptions.filter(s => s.toLowerCase().includes(staffFilter.toLowerCase())).slice(0, 30)
    : staffOptions.slice(0, 30);

  const filteredManagers = managerFilter
    ? staffOptions.filter(s => s.toLowerCase().includes(managerFilter.toLowerCase())).slice(0, 30)
    : staffOptions.slice(0, 30);

  const filteredAssets = assetFilter
    ? assetOptions.filter(a => a.toLowerCase().includes(assetFilter.toLowerCase())).slice(0, 30)
    : assetOptions.slice(0, 30);

  // Separate active vs left rows, with current user's rows first
  const activeRows = rows.filter(r => !r.left);
  const leftRows = rows.filter(r => r.left);
  
  // Sort function to put current user's rows first (as employee or manager)
  const sortWithUserFirst = (rowList) => {
    if (!currentUserName) return rowList;
    const normalize = (s) => (s || '').toLowerCase().trim();
    const userName = normalize(currentUserName);
    
    return [...rowList].sort((a, b) => {
      const aIsUser = normalize(a.employee_name).includes(userName) || normalize(a.manager).includes(userName);
      const bIsUser = normalize(b.employee_name).includes(userName) || normalize(b.manager).includes(userName);
      
      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;
      return 0; // keep original order for non-user rows
    });
  };
  
  const displayRows = sortWithUserFirst(showLeavers ? rows : activeRows);
  
  // Check if current user has any rows
  const userRows = currentUserName ? displayRows.filter(r => {
    const normalize = (s) => (s || '').toLowerCase().trim();
    const userName = normalize(currentUserName);
    return normalize(r.employee_name).includes(userName) || normalize(r.manager).includes(userName);
  }) : [];

  const fetchCosting = async (from, until) => {
    try {
      let url = `${API_BASE_URL}/api/workplan/costing`;
      const params = [];
      if (from) params.push(`from_date=${from}`);
      if (until) params.push(`until_date=${until}`);
      if (params.length) url += `?${params.join('&')}`;
      const res = await fetch(url);
      setCostingData(await res.json());
      setShowCosting(true);
    } catch { toast.error('Failed to load costing'); }
  };

  return (
    <div className="space-y-4">
      {/* datalists — filtered for performance */}
      <datalist id="wp-staff">{filteredStaff.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="wp-managers">{filteredManagers.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="wp-assets">{filteredAssets.map((a) => <option key={a} value={a} />)}</datalist>

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} data-testid="workplan-back-btn">
            <ArrowLeft className="h-4 w-4 mr-1" /> Home
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Daily Workplan</h1>
            <p className="text-xs text-gray-500">
              {saveState === 'saving' ? 'Saving…' : 'All changes saved'}
              {publishedAt && ` · Published ${new Date(publishedAt).toLocaleString()}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowColors(true)} data-testid="manage-colors-btn">
            <Palette className="h-4 w-4 mr-1" /> Colours
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowJobs(true)} data-testid="manage-jobs-btn">
            <ListPlus className="h-4 w-4 mr-1" /> Jobs
          </Button>
          <Button variant="outline" size="sm" onClick={sortByManager} data-testid="sort-manager-btn">
            Sort by Manager
          </Button>
          {selectedRows.size > 0 && (
            <Button variant="outline" size="sm" onClick={copySelectedRows} data-testid="copy-rows-btn" className="border-blue-400 text-blue-600">
              <Copy className="h-4 w-4 mr-1" /> Copy {selectedRows.size} Row{selectedRows.size > 1 ? 's' : ''}
            </Button>
          )}
          {selectedRows.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearRowSelection} data-testid="clear-selection-btn">
              Clear Selection
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowLeavers(!showLeavers)} data-testid="toggle-leavers-btn">
            {showLeavers ? 'Hide' : 'Show'} Leavers ({leftRows.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchCosting(costingFrom, costingUntil)} data-testid="costing-btn">
            <BarChart3 className="h-4 w-4 mr-1" /> Costing
          </Button>
          <Button onClick={publish} className="bg-green-600 hover:bg-green-700" size="sm" data-testid="publish-btn">
            <Send className="h-4 w-4 mr-1" /> Publish to Home
          </Button>
        </div>
      </div>

      {/* week controls */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(toISO(addDays(weekStart, -7)))}>
          ← Prev week
        </Button>
        <span className="font-medium text-gray-700">
          Week of {addDays(weekStart, 0).toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(toISO(addDays(weekStart, 7)))}>
          Next week →
        </Button>
      </div>

      {/* legend */}
      {colors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Areas / crops:</span>
          {colors.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border">
              <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
          <span className="text-gray-400 ml-2">|</span>
          <span className="text-gray-500">{activeRows.length} active</span>
          {leftRows.length > 0 && <span className="text-red-400">{leftRows.length} leavers</span>}
        </div>
      )}

      {/* selection toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs bg-gray-50 border rounded-md px-3 py-1.5" data-testid="wp-cell-toolbar">
        {selCells.length > 0 ? (
          <>
            <span className="font-medium text-gray-700">{selCells.length} cell{selCells.length > 1 ? 's' : ''} selected</span>
            <Button size="sm" variant="default" className="h-7" onClick={() => anchor && openEditorAt(anchor.rowIdx, anchor.colIdx)} data-testid="cell-setjob-btn">Set job / colour</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={copySelected} data-testid="cell-copy-btn">Copy</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={pasteSelected} disabled={!clipboard} data-testid="cell-paste-btn">Paste</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={clearSelected} data-testid="cell-clear-btn">Clear</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={clearSelection}>Deselect</Button>
            <span className="text-gray-400 hidden sm:inline">· Ctrl/⌘+click adds cells · drag the blue corner to copy the whole selection across · double-click to set job &amp; colour for all</span>
          </>
        ) : selectedDay !== null ? (
          <>
            <span className="text-blue-700 font-medium">Day selected: {DAY_NAMES[selectedDay]}</span>
            <span className="text-gray-500 ml-2">Click another day header to paste, or</span>
            <Button size="sm" variant="ghost" className="h-7 text-gray-500" onClick={() => setSelectedDay(null)}>Cancel</Button>
          </>
        ) : (
          <span className="text-gray-500">Tip: click a cell to select. <b>Ctrl/⌘+click</b> picks several · <b>Shift+click</b> selects a block · <b>drag the blue corner</b> to copy the selection across · <b>double-click</b> to set job &amp; colour. <b>Click a day header</b> to copy entire day.</span>
        )}
        {hiddenPast > 0 && <span className="ml-auto text-gray-400">{hiddenPast} past day{hiddenPast > 1 ? 's' : ''} hidden (kept for costing)</span>}
      </div>

      {/* grid */}
      <div className="overflow-auto border rounded-lg bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }} data-testid="workplan-grid">
        <table className="text-xs border-collapse" style={{ minWidth: 1100 }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-100 text-gray-700">
              <th className="p-1 border w-8 bg-gray-100">
                <input
                  type="checkbox"
                  checked={selectedRows.size > 0 && displayRows.every((r) => selectedRows.has(r.id))}
                  onChange={(e) => e.target.checked ? selectAllRows() : clearRowSelection()}
                  className="w-4 h-4 cursor-pointer"
                  title="Select all rows"
                  data-testid="select-all-rows"
                />
              </th>
              <th className="p-2 border text-left sticky left-0 bg-gray-100 z-30" style={{ minWidth: 130 }}>Employee</th>
              <th className="p-2 border text-left bg-gray-100" style={{ minWidth: 120 }}>Vehicle</th>
              <th className="p-2 border text-left bg-gray-100" style={{ minWidth: 120 }}>Implement</th>
              <th className="p-2 border text-left bg-gray-100" style={{ minWidth: 110 }}>Manager</th>
              <th className="p-2 border bg-gray-100" style={{ minWidth: 70 }}>Start</th>
              <th className="p-2 border text-left bg-gray-100" style={{ minWidth: 200 }}>Field &amp; Notes</th>
              {visibleDays.map((i) => (
                <th 
                  key={i} 
                  className={`p-1 border text-center cursor-pointer transition-colors ${selectedDay === i ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-gray-100 hover:bg-blue-50'}`}
                  colSpan={2} 
                  style={{ minWidth: 200 }}
                  onClick={() => selectedDay !== null && selectedDay !== i ? copyDayToDay(i) : selectDayColumn(i)}
                  title={selectedDay === null ? 'Click to select this day for copying' : selectedDay === i ? 'Click to deselect' : `Click to paste ${DAY_NAMES[selectedDay]} here`}
                  data-testid={`wp-day-header-${i}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {fmtDay(weekStart, i)}
                    {selectedDay !== null && selectedDay !== i && (
                      <span className="text-blue-600 text-[10px] font-normal">← paste</span>
                    )}
                    {selectedDay === i && (
                      <span className="text-blue-700 text-[10px] font-semibold">✓ selected</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1 border w-8 bg-gray-100"></th>
            </tr>
            <tr className="bg-gray-50 text-[10px] text-gray-500">
              <th className="border bg-gray-50"></th>
              <th className="border sticky left-0 bg-gray-50 z-30"></th>
              <th className="border bg-gray-50"></th>
              <th className="border bg-gray-50"></th>
              <th className="border bg-gray-50"></th>
              <th className="border bg-gray-50"></th>
              <th className="border bg-gray-50"></th>
              {visibleDays.map((i) => (
                <React.Fragment key={i}>
                  <th className="border p-0.5 bg-gray-50">AM</th>
                  <th className="border p-0.5 bg-gray-50">PM</th>
                </React.Fragment>
              ))}
              <th className="border bg-gray-50"></th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rIdx) => {
              const tint = row.left ? '#fef2f2' : managerTint(row.manager);
              return (
              <tr key={row.id} className={row.left ? 'opacity-50' : 'hover:bg-yellow-50'} data-testid={`wp-row-${rIdx}`}>
                {/* row selection checkbox */}
                <td className="border p-1 text-center align-middle" style={{ background: tint || 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={() => toggleRowSelection(row.id)}
                    className="w-4 h-4 cursor-pointer"
                    data-testid={`wp-select-row-${rIdx}`}
                  />
                </td>
                {/* employee */}
                <td className="border p-0.5 sticky left-0 z-10" style={{ background: tint || '#ffffff' }}>
                  <div className="flex items-center gap-0.5">
                    <input
                      list="wp-staff"
                      value={row.employee_name}
                      onChange={(e) => { setStaffFilter(e.target.value); updateRow(row.id, { employee_name: e.target.value }); }}
                      onFocus={(e) => setStaffFilter(e.target.value)}
                      placeholder="Name"
                      className="flex-1 min-w-0 px-1 py-1 text-xs outline-none bg-transparent"
                      data-testid={`wp-employee-${rIdx}`}
                    />
                    <button
                      onClick={() => updateRow(row.id, { left: !row.left })}
                      className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-semibold leading-none ${row.left ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300" : "bg-orange-50 text-orange-500 hover:bg-orange-100 border border-orange-200"}`}
                      title={row.left ? "Mark as active" : "Mark as left"}
                      data-testid={`wp-left-${rIdx}`}
                    >
                      {row.left ? '↩ Active' : '✕ Left'}
                    </button>
                  </div>
                </td>
                {/* vehicle */}
                <td className="border p-0.5" style={{ background: tint || 'transparent' }}>
                  <input
                    list="wp-assets"
                    value={row.vehicle}
                    onChange={(e) => { setAssetFilter(e.target.value); updateRow(row.id, { vehicle: e.target.value }); }}
                    onFocus={(e) => setAssetFilter(e.target.value)}
                    placeholder="Vehicle"
                    className="w-full px-1 py-1 text-xs outline-none bg-transparent"
                    data-testid={`wp-vehicle-${rIdx}`}
                  />
                </td>
                {/* implement */}
                <td className="border p-0.5" style={{ background: tint || 'transparent' }}>
                  <input
                    list="wp-assets"
                    value={row.implement}
                    onChange={(e) => { setAssetFilter(e.target.value); updateRow(row.id, { implement: e.target.value }); }}
                    onFocus={(e) => setAssetFilter(e.target.value)}
                    placeholder="Implement"
                    className="w-full px-1 py-1 text-xs outline-none bg-transparent"
                    data-testid={`wp-implement-${rIdx}`}
                  />
                </td>
                {/* manager */}
                <td className="border p-0.5" style={{ background: tint || 'transparent' }}>
                  <input
                    list="wp-managers"
                    value={row.manager}
                    onChange={(e) => { setManagerFilter(e.target.value); updateRow(row.id, { manager: e.target.value }); }}
                    onFocus={(e) => setManagerFilter(e.target.value)}
                    placeholder="Manager"
                    className="w-full px-1 py-1 text-xs outline-none bg-transparent font-medium"
                    data-testid={`wp-manager-${rIdx}`}
                  />
                </td>
                {/* start time with copy-down */}
                <td className="border p-0.5 relative group/time" style={{ background: tint || 'transparent' }}>
                  <div className="flex items-center">
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) => updateRow(row.id, { start_time: e.target.value })}
                      className="w-full px-1 py-1 text-xs outline-none bg-transparent"
                      data-testid={`wp-start-${rIdx}`}
                    />
                    {row.start_time && (
                      <button
                        onClick={() => {
                          const idx = displayRows.findIndex(r => r.id === row.id);
                          if (idx < 0) return;
                          const below = displayRows.slice(idx + 1);
                          below.forEach(r => updateRow(r.id, { start_time: row.start_time }));
                          toast.success(`Copied ${row.start_time} to ${below.length} rows below`);
                        }}
                        className="opacity-0 group-hover/time:opacity-100 text-blue-400 hover:text-blue-700 ml-0.5 shrink-0 transition-opacity"
                        title={`Copy ${row.start_time} to all rows below`}
                        data-testid={`wp-time-copy-down-${rIdx}`}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
                {/* notes - expandable, always shows full text */}
                <td className="border p-0.5 align-top" style={{ background: tint || 'transparent' }}>
                  <textarea
                    value={row.notes}
                    onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                    rows={1}
                    placeholder="Field / detail"
                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                    className="w-full px-1 py-1 text-xs outline-none bg-transparent resize-none overflow-hidden leading-snug whitespace-pre-wrap break-words"
                    style={{ minHeight: 28 }}
                    data-testid={`wp-notes-${rIdx}`}
                  />
                </td>
                {/* day cells */}
                {visibleDays.map((dIdx) => (
                  <React.Fragment key={dIdx}>
                    {['am', 'pm'].map((period) => {
                      const colIdx = dIdx * 2 + (period === 'pm' ? 1 : 0);
                      const cell = row.days[dIdx][period];
                      const col = cell.color_id ? colorsById[cell.color_id] : null;
                      const cellBg = col ? col.color : (cell.color || 'transparent');
                      const cellFg = (col || cell.color) ? textOn(col ? col.color : cell.color) : '#374151';
                      const isSel = isCellSelected(rIdx, colIdx);
                      const isHandleCell = selBox && rIdx === selBox.r1 && colIdx === selBox.c1;
                      const inFill = inRect(rIdx, colIdx);
                      return (
                        <td
                          key={period}
                          className="border p-0 cursor-pointer text-center relative select-none"
                          style={{
                            background: cellBg,
                            color: cellFg,
                            minWidth: 100,
                            outline: isSel ? '2px solid #2563eb' : inFill ? '2px solid #93c5fd' : 'none',
                            outlineOffset: '-2px',
                            boxShadow: isSel ? 'inset 0 0 0 100px rgba(37,99,235,0.10)' : 'none',
                          }}
                          onClick={(e) => handleCellClick(rIdx, colIdx, e)}
                          onDoubleClick={() => openEditorAt(rIdx, colIdx)}
                          onPointerEnter={() => dragEnter(rIdx, colIdx)}
                          data-testid={`wp-cell-${rIdx}-${dIdx}-${period}`}
                        >
                          <div className="px-1 py-2 leading-tight text-xs" style={{ minWidth: 90 }}>
                            {cell.job || ''}
                          </div>
                          {isHandleCell && (
                            <span
                              onPointerDown={startDragFromSelection}
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-600 border border-white cursor-crosshair"
                              style={{ transform: 'translate(1px,1px)' }}
                              title="Drag to fill / copy across"
                              data-testid={`wp-fill-handle-${rIdx}-${dIdx}-${period}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </React.Fragment>
                ))}
                {/* row actions */}
                <td className="border p-0.5">
                  <div className="flex flex-col items-center gap-0.5">
                    <button onClick={() => moveRow(row.id, -1)} className="text-gray-400 hover:text-gray-700" title="Move up">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => duplicateRow(row.id)} className="text-blue-400 hover:text-blue-700" title="Duplicate row">
                      <Copy className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteRow(row.id)} className="text-red-400 hover:text-red-700" title="Delete row" data-testid={`wp-delete-${rIdx}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveRow(row.id, 1)} className="text-gray-400 hover:text-gray-700" title="Move down">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button onClick={addRow} variant="outline" className="w-full" data-testid="add-row-btn">
        <Plus className="h-4 w-4 mr-1" /> Add person / row
      </Button>

      {/* cell editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditingCell(null)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selCells.length > 1
                    ? `Set job & colour for ${selCells.length} selected cells`
                    : `${editing.row.employee_name || 'Row'} — ${fmtDay(weekStart, editing.dayIndex)} ${editing.period.toUpperCase()}`}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Job{selCells.length > 1 ? ' (applies to all selected)' : ''}</label>
                  <input
                    list="wp-jobs-dl"
                    value={editing.row.days[editing.dayIndex][editing.period].job}
                    onChange={(e) => applyEditorValue({ job: e.target.value })}
                    placeholder="Type or pick a job"
                    className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
                    data-testid="cell-job-input"
                  />
                  <datalist id="wp-jobs-dl">
                    {jobs.map((j) => <option key={j.id} value={j.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Area / Crop colour{selCells.length > 1 ? ' (applies to all selected)' : ''}</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      onClick={() => applyEditorValue({ color_id: null })}
                      className={`px-2 py-1 rounded-md border text-xs ${!editing.row.days[editing.dayIndex][editing.period].color_id ? 'ring-2 ring-gray-400' : ''}`}
                    >
                      None
                    </button>
                    {colors.map((c) => {
                      const active = editing.row.days[editing.dayIndex][editing.period].color_id === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => applyEditorValue({ color_id: c.id })}
                          className={`px-2 py-1 rounded-md text-xs ${active ? 'ring-2 ring-offset-1 ring-gray-700' : ''}`}
                          style={{ background: c.color, color: textOn(c.color) }}
                          data-testid={`cell-color-${c.name}`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { copyCellAcrossWeek(editing.rowId, editing.dayIndex, editing.period); toast.success(`Copied ${editing.period.toUpperCase()} across the week`); }}
                    data-testid="copy-period-week-btn"
                  >
                    <ArrowRightToLine className="h-4 w-4 mr-1" /> Copy this {editing.period.toUpperCase()} to whole week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { copyDayAcrossWeek(editing.rowId, editing.dayIndex); toast.success('Copied this day (AM+PM) across the week'); }}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Copy whole day (AM+PM) to week
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => { updateCell(editing.rowId, editing.dayIndex, editing.period, { job: '', color_id: null }); }}
                >
                  Clear
                </Button>
                <Button onClick={() => setEditingCell(null)} data-testid="cell-done-btn">Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* band colour picker */}
      <Dialog open={!!bandPickerRow} onOpenChange={(o) => !o && setBandPickerRow(null)}>
        <DialogContent className="max-w-xs" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Group colour band</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 -mt-2">Colour-code people working under the same manager/estate.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { updateRow(bandPickerRow, { group_color: null }); setBandPickerRow(null); }}
              className="px-2 py-1 rounded-md border text-xs"
            >
              None
            </button>
            {colors.map((c) => (
              <button
                key={c.id}
                onClick={() => { updateRow(bandPickerRow, { group_color: c.color }); setBandPickerRow(null); }}
                className="px-3 py-2 rounded-md text-xs"
                style={{ background: c.color, color: textOn(c.color) }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Costing breakdown */}
      <Dialog open={showCosting} onOpenChange={(o) => !o && setShowCosting(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Workplan Costing Breakdown</DialogTitle></DialogHeader>
          
          {/* Date range selector */}
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">From:</label>
              <input
                type="date"
                value={costingFrom}
                onChange={(e) => setCostingFrom(e.target.value)}
                className="text-xs border rounded px-2 py-1.5"
                data-testid="costing-from-date"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Until:</label>
              <input
                type="date"
                value={costingUntil}
                onChange={(e) => setCostingUntil(e.target.value)}
                className="text-xs border rounded px-2 py-1.5"
                data-testid="costing-until-date"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchCosting(costingFrom, costingUntil)} data-testid="costing-refresh-btn">
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCostingFrom(''); setCostingUntil(''); fetchCosting('', ''); }} className="text-xs text-gray-500">
              Clear dates
            </Button>
            {costingData?.weeks_included && (
              <span className="text-xs text-gray-400 ml-auto">{costingData.weeks_included} week(s)</span>
            )}
          </div>
          {costingData && (
            <div className="space-y-6">
              {/* Active staff - Combined Area + Job breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Staff — Time by Area / Crop + Job</h3>
                <p className="text-xs text-gray-400 mb-3">Total: {costingData.total_cells * 6} hours ({costingData.total_cells} half-days)</p>
                {costingData.combined_breakdown?.length > 0 ? (
                  <div className="space-y-1.5">
                    {costingData.combined_breakdown.map((c) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="text-xs w-48 truncate font-medium" title={c.name}>
                          <span className="text-green-700">{c.area}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          <span className="text-gray-700">{c.job}</span>
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div className="h-full rounded-full bg-green-500 flex items-center pl-2" style={{ width: `${Math.max(c.percent, 3)}%` }}>
                            <span className="text-[10px] font-bold text-white">{c.percent}%</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-20 text-right">{c.count * 6}hrs</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">No assigned cells yet</p>}
              </div>

              {/* Leavers costing (if any) */}
              {costingData.left_total_cells > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Leavers — Historic Cost Data ({costingData.left_total_cells * 6} hours)</h3>
                  {costingData.left_combined_breakdown?.length > 0 && (
                    <div className="space-y-1">
                      {costingData.left_combined_breakdown.map((c) => (
                        <div key={c.name} className="flex items-center gap-2">
                          <span className="text-xs w-48 truncate">
                            <span className="text-orange-600">{c.area}</span>
                            <span className="text-gray-400 mx-1">·</span>
                            <span className="text-gray-600">{c.job}</span>
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(c.percent, 2)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-20 text-right">{c.percent}% ({c.count * 6}hrs)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowCosting(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageColors open={showColors} onClose={() => setShowColors(false)} colors={colors} setColors={setColors} />
      <ManageJobs open={showJobs} onClose={() => setShowJobs(false)} jobs={jobs} setJobs={setJobs} />
    </div>
  );
}

// ---------- Manage Colours dialog ----------
function ManageColors({ open, onClose, colors, setColors }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#16a34a');

  const add = async () => {
    if (!name.trim()) return;
    const res = await fetch(`${API_BASE_URL}/api/workplan/colors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    const c = await res.json();
    setColors((cs) => [...cs, c]);
    setName('');
  };
  const remove = async (id) => {
    await fetch(`${API_BASE_URL}/api/workplan/colors/${id}`, { method: 'DELETE' });
    setColors((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Area / Crop Colours</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500 -mt-2">Used to colour-code AM/PM jobs so you can track cost by crop/area.</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {colors.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded-md px-2 py-1.5">
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded" style={{ background: c.color }} /> {c.name}
              </span>
              <button onClick={() => remove(c.id)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 pt-2 border-t">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border" data-testid="new-color-swatch" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Crop / area name" className="flex-1" data-testid="new-color-name" />
          <Button onClick={add} size="sm" data-testid="add-color-btn"><Plus className="h-4 w-4" /></Button>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Manage Jobs dialog ----------
function ManageJobs({ open, onClose, jobs, setJobs }) {
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    const res = await fetch(`${API_BASE_URL}/api/workplan/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    setJobs((js) => [...js, j]);
    setName('');
  };
  const remove = async (id) => {
    await fetch(`${API_BASE_URL}/api/workplan/jobs/${id}`, { method: 'DELETE' });
    setJobs((js) => js.filter((j) => j.id !== id));
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Jobs List</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New job name" className="flex-1" data-testid="new-job-name" />
          <Button onClick={add} size="sm" data-testid="add-job-btn"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pt-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between border rounded-md px-2 py-1 text-xs">
              <span className="truncate">{j.name}</span>
              <button onClick={() => remove(j.id)} className="text-red-400 hover:text-red-600 shrink-0"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
