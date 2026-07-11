import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Save, Send, Trash2, Copy, Palette, ListPlus,
  ChevronUp, ChevronDown, X, CheckCircle2, ArrowRightToLine, BarChart3, UserX, UserCheck, User, GripVertical, Printer, ArrowDownAZ
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDate = new Date(d);
  dayDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((dayDate - today) / (1000 * 60 * 60 * 24));
  
  let prefix = '';
  if (diffDays === -1) prefix = 'Yesterday · ';
  else if (diffDays === 0) prefix = 'TODAY · ';
  else if (diffDays === 1) prefix = 'Tomorrow · ';
  
  return `${prefix}${DAY_NAMES[i]} ${d.getDate()}`;
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
  const [hiddenDays, setHiddenDays] = useState(new Set()); // day indices to hide (0-6)
  const [activeUsers, setActiveUsers] = useState([]); // other users editing the workplan
  const [draggedRowId, setDraggedRowId] = useState(null); // for drag & drop reordering

  // refs for synchronized scrolling
  const leftTableRef = useRef(null);
  const rightTableRef = useRef(null);
  const isSyncing = useRef(false);

  // Sync row heights between left and right tables (scroll-preserving, no-jolt)
  const syncRowHeights = useCallback(() => {
    const left = leftTableRef.current;
    const right = rightTableRef.current;
    if (!left || !right) return;

    // Preserve scroll positions — resetting heights can clamp scrollTop and cause jumps
    const leftScroll = left.scrollTop;
    const rightScroll = right.scrollTop;

    const leftRows = left.querySelectorAll('tbody tr');
    const rightRows = right.querySelectorAll('tbody tr');

    leftRows.forEach((leftRow, idx) => {
      const rightRow = rightRows[idx];
      if (!rightRow) return;

      leftRow.style.height = 'auto';
      rightRow.style.height = 'auto';

      const maxHeight = Math.max(leftRow.offsetHeight, rightRow.offsetHeight);
      leftRow.style.height = `${maxHeight}px`;
      rightRow.style.height = `${maxHeight}px`;
    });

    // Restore scroll positions before the browser paints
    left.scrollTop = leftScroll;
    right.scrollTop = rightScroll;
  }, []);

  // Run height sync only when row count / visibility changes — not on every keystroke
  useEffect(() => {
    const timer = setTimeout(syncRowHeights, 100);
    return () => clearTimeout(timer);
  }, [rows.length, showLeavers, hiddenDays, loaded, syncRowHeights]);

  // Function to trigger row height sync (called on note input)
  const triggerRowSync = useCallback(() => {
    setTimeout(syncRowHeights, 10);
  }, [syncRowHeights]);

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
        setStaffOptions([...new Set(staff.map((s) => s.name).filter(Boolean))].sort());
        const assets = await assetsRes.json();
        setAssetOptions(
          [...new Set(assets.map((a) => `${a.make} ${a.name}`.trim()))].sort()
        );
        if (wp.week_start) {
          // Auto-advance to current week if saved week is entirely in the past
          const savedWeekEnd = toISO(addDays(wp.week_start, 6));
          const today = toISO(new Date());
          if (savedWeekEnd < today) {
            // Saved week is in the past, start with current week
            setWeekStart(toISO(mondayOf(new Date())));
          } else {
            setWeekStart(wp.week_start);
          }
        }
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

  // ---------- presence tracking ----------
  useEffect(() => {
    if (!employee?.employee_number) return;
    
    const userId = employee.employee_number;
    const userName = employee.name || `Employee ${userId}`;
    
    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/workplan/presence/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, user_name: userName }),
        });
        const data = await res.json();
        setActiveUsers(data.active_users || []);
      } catch (e) {
        console.error('Presence heartbeat failed:', e);
      }
    };
    
    // Send initial heartbeat
    sendHeartbeat();
    
    // Send heartbeat every 15 seconds
    const interval = setInterval(sendHeartbeat, 15000);
    
    // Notify server when leaving
    const handleUnload = () => {
      navigator.sendBeacon(
        `${API_BASE_URL}/api/workplan/presence/leave`,
        JSON.stringify({ user_id: userId, user_name: userName })
      );
    };
    
    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      // Send leave signal on unmount
      fetch(`${API_BASE_URL}/api/workplan/presence/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, user_name: userName }),
      }).catch(() => {});
    };
  }, [employee]);

  // Normalize times like '6:30 Am' to 'HH:mm' for <input type="time">
  const normalizeTime = (t) => {
    if (!t) return '';
    const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!m) return t;
    let h = parseInt(m[1], 10);
    const ampm = (m[3] || '').toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  };

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
    return { ...newRow(), ...r, start_time: normalizeTime(r.start_time), days: normalizedDays };
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

  // ---------- drag & drop row reordering ----------
  const handleDragStart = (e, rowId) => {
    setDraggedRowId(rowId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowId);
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedRowId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetRowId) => {
    e.preventDefault();
    if (!draggedRowId || draggedRowId === targetRowId) return;
    
    setRows((rs) => {
      const draggedIdx = rs.findIndex((r) => r.id === draggedRowId);
      const targetIdx = rs.findIndex((r) => r.id === targetRowId);
      if (draggedIdx === -1 || targetIdx === -1) return rs;
      
      const copy = [...rs];
      const [draggedRow] = copy.splice(draggedIdx, 1);
      copy.splice(targetIdx, 0, draggedRow);
      return copy;
    });
    
    setDraggedRowId(null);
    toast.success('Row moved');
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
  
  // IMPORTANT: Get cell by display index (index in displayRows, not rows)
  // We need to look up the actual row by finding it in displayRows first
  const getCellByIdx = (displayRowIdx, colIdx) => {
    const { dayIndex, period } = colToDay(colIdx);
    const row = displayRows[displayRowIdx];
    return row?.days?.[dayIndex]?.[period] || null;
  };
  const isCellSelected = (rowIdx, colIdx) => selCells.some((c) => c.rowIdx === rowIdx && c.colIdx === colIdx);
  const clearSelection = () => { setSelCells([]); setAnchor(null); };

  // apply a full content {job,color_id} to a list of cells
  // cells contains displayRowIdx values, need to map to actual row IDs
  const applyToCells = (cells, content) =>
    setRows((rs) => {
      // Build a map of row ID -> Set of column indices to update
      const idToColsMap = {};
      cells.forEach((c) => {
        const actualRow = displayRows[c.rowIdx];
        if (actualRow) {
          if (!idToColsMap[actualRow.id]) idToColsMap[actualRow.id] = new Set();
          idToColsMap[actualRow.id].add(c.colIdx);
        }
      });
      return rs.map((r) => {
        if (!idToColsMap[r.id]) return r;
        const cols = idToColsMap[r.id];
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
  // cells contains displayRowIdx values, need to map to actual row IDs
  const patchCells = (cells, patch) =>
    setRows((rs) => {
      // Build a map of row ID -> Set of column indices to update
      const idToColsMap = {};
      cells.forEach((c) => {
        const actualRow = displayRows[c.rowIdx];
        if (actualRow) {
          if (!idToColsMap[actualRow.id]) idToColsMap[actualRow.id] = new Set();
          idToColsMap[actualRow.id].add(c.colIdx);
        }
      });
      return rs.map((r) => {
        if (!idToColsMap[r.id]) return r;
        const cols = idToColsMap[r.id];
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
  // r0, r1 are display row indices - need to convert to actual row IDs
  const fillTile = (r0, r1, c0, c1, srcBox, matrix) => {
    const H = srcBox.r1 - srcBox.r0 + 1;
    const W = srcBox.c1 - srcBox.c0 + 1;
    
    // Build a map of row ID -> { displayIdx, columns to fill }
    const rowFillMap = {};
    for (let dispIdx = r0; dispIdx <= r1; dispIdx++) {
      const actualRow = displayRows[dispIdx];
      if (actualRow) {
        rowFillMap[actualRow.id] = { displayIdx: dispIdx };
      }
    }
    
    const pick = (displayRowIdx, ci) => {
      const h = (((displayRowIdx - srcBox.r0) % H) + H) % H;
      const w = (((ci - srcBox.c0) % W) + W) % W;
      const cell = matrix[h][w];
      return { job: cell.job, color_id: cell.color_id ?? null };
    };
    
    setRows((rs) =>
      rs.map((r) => {
        const fillInfo = rowFillMap[r.id];
        if (!fillInfo) return r;
        const displayIdx = fillInfo.displayIdx;
        
        const days = r.days.map((d, di) => {
          const amCol = di * 2, pmCol = di * 2 + 1;
          let am = d.am, pm = d.pm;
          if (amCol >= c0 && amCol <= c1) am = pick(displayIdx, amCol);
          if (pmCol >= c0 && pmCol <= c1) pm = pick(displayIdx, pmCol);
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
  const openEditorAt = (displayRowIdx, colIdx) => {
    if (!isCellSelected(displayRowIdx, colIdx)) { setSelCells([{ rowIdx: displayRowIdx, colIdx }]); }
    setAnchor({ rowIdx: displayRowIdx, colIdx });
    const { dayIndex, period } = colToDay(colIdx);
    // IMPORTANT: Use displayRows to get the actual row, not rows array
    const actualRow = displayRows[displayRowIdx];
    if (actualRow) {
      setEditingCell({ rowId: actualRow.id, dayIndex, period });
    }
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

  // Print the workplan as displayed on screen
  const printWorkplan = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      return;
    }

    // HTML-escape helper
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Get color by ID
    const getColor = (colorId) => colors.find(c => c.id === colorId)?.color || '#e5e7eb';

    // Build table headers for visible days
    const dayHeaders = visibleDays.map(i => `
      <th colspan="2" style="background:#f3f4f6; padding:4px 8px; border:1px solid #d1d5db; text-align:center; min-width:120px;">
        ${esc(fmtDay(weekStart, i))}
      </th>
    `).join('');

    const amPmHeaders = visibleDays.map(() => `
      <th style="background:#f9fafb; padding:2px 4px; border:1px solid #d1d5db; font-size:10px; min-width:60px;">AM</th>
      <th style="background:#f9fafb; padding:2px 4px; border:1px solid #d1d5db; font-size:10px; min-width:60px;">PM</th>
    `).join('');

    // Build rows
    const tableRows = displayRows.map(row => {
      const tint = row.left ? '#fef2f2' : (row.manager ? managerTint(row.manager) : '#ffffff');
      
      const dayCells = visibleDays.map(i => {
        const day = row.days?.[i] || {};
        const amColor = day.am?.color_id ? getColor(day.am.color_id) : '#f3f4f6';
        const pmColor = day.pm?.color_id ? getColor(day.pm.color_id) : '#f3f4f6';
        return `
          <td style="background:${amColor}; padding:4px; border:1px solid #d1d5db; font-size:11px; min-width:60px; word-wrap:break-word; max-width:100px;">
            ${esc(day.am?.job || '—')}
          </td>
          <td style="background:${pmColor}; padding:4px; border:1px solid #d1d5db; font-size:11px; min-width:60px; word-wrap:break-word; max-width:100px;">
            ${esc(day.pm?.job || '—')}
          </td>
        `;
      }).join('');

      return `
        <tr style="background:${tint}; ${row.left ? 'opacity:0.6;' : ''}">
          <td style="padding:4px 6px; border:1px solid #d1d5db; font-weight:600; font-size:12px; white-space:nowrap;">${esc(row.employee_name)}</td>
          <td style="padding:4px 6px; border:1px solid #d1d5db; font-size:11px; white-space:nowrap;">${esc(row.vehicle)}</td>
          <td style="padding:4px 6px; border:1px solid #d1d5db; font-size:11px; white-space:nowrap;">${esc(row.implement)}</td>
          <td style="padding:4px 6px; border:1px solid #d1d5db; font-size:11px; white-space:nowrap;">${esc(row.manager)}</td>
          <td style="padding:4px 6px; border:1px solid #d1d5db; font-size:11px; font-weight:600; white-space:nowrap;">${esc(row.start_time)}</td>
          <td style="padding:4px 6px; border:1px solid #d1d5db; font-size:10px; max-width:150px; word-wrap:break-word;">${esc(row.notes)}</td>
          ${dayCells}
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Workplan - ${addDays(weekStart, 0).toLocaleDateString()} to ${addDays(weekStart, 6).toLocaleDateString()}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
            h1 { font-size: 16px; margin-bottom: 5px; }
            p { font-size: 12px; color: #666; margin-bottom: 10px; }
            table { border-collapse: collapse; width: 100%; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 4px 6px; }
            th { background: #f3f4f6; font-weight: 600; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h1>Daily Workplan</h1>
          <p>Week: ${addDays(weekStart, 0).toLocaleDateString()} – ${addDays(weekStart, 6).toLocaleDateString()} | Printed: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="min-width:100px;">Employee</th>
                <th rowspan="2" style="min-width:60px;">Vehicle</th>
                <th rowspan="2" style="min-width:60px;">Impl</th>
                <th rowspan="2" style="min-width:80px;">Manager</th>
                <th rowspan="2" style="min-width:50px;">Start</th>
                <th rowspan="2" style="min-width:120px;">Notes</th>
                ${dayHeaders}
              </tr>
              <tr>
                ${amPmHeaders}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    // Note: document.write is safe here because all user content is HTML-escaped via esc()
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.onload = function() {
      setTimeout(function() {
        printWindow.print();
      }, 500);
    };
  };

  const editing =
    editingCell && rows.find((r) => r.id === editingCell.rowId)
      ? {
          row: rows.find((r) => r.id === editingCell.rowId),
          ...editingCell,
        }
      : null;

  // Show relevant days: yesterday + today + 5 future days (within this week's data)
  const todayISO = toISO(new Date());
  const yesterdayISO = toISO(addDays(todayISO, -1));
  
  // Calculate which day indices to show based on today's position in the week
  let availableDays = [];
  for (let i = 0; i < 7; i++) {
    const dayISO = toISO(addDays(weekStart, i));
    // Show: yesterday, today, and up to 5 days in the future
    if (dayISO >= yesterdayISO && dayISO <= toISO(addDays(todayISO, 5))) {
      availableDays.push(i);
    }
  }
  
  // If no days match (viewing old/future weeks), show all days in that week
  if (availableDays.length === 0) availableDays = [0, 1, 2, 3, 4, 5, 6];
  
  const hiddenPast = 7 - availableDays.length;
  
  // Filter out manually hidden days
  const visibleDays = availableDays.filter(i => !hiddenDays.has(i));
  
  const toggleDayVisibility = (dayIndex) => {
    setHiddenDays(prev => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  };

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

  // Synchronized scrolling handlers
  const handleLeftScroll = (e) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (rightTableRef.current) {
      rightTableRef.current.scrollTop = e.target.scrollTop;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  };
  
  const handleRightScroll = (e) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (leftTableRef.current) {
      leftTableRef.current.scrollTop = e.target.scrollTop;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  };

  // Separate active vs left rows — keep stored order stable (no auto-sorting while editing)
  const activeRows = rows.filter(r => !r.left);
  const leftRows = rows.filter(r => r.left);
  const displayRows = showLeavers ? rows : activeRows;

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
    <div className="h-full flex flex-col p-1">
      {/* datalists — filtered for performance */}
      <datalist id="wp-staff">{filteredStaff.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="wp-managers">{filteredManagers.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="wp-assets">{filteredAssets.map((a) => <option key={a} value={a} />)}</datalist>

      {/* Active users warning banner */}
      {activeUsers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-md px-3 py-2 mb-2 flex items-center gap-2" data-testid="active-users-warning">
          <User className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-800">
            <strong>Warning:</strong> {activeUsers.length === 1 
              ? `${activeUsers[0].name} is also editing this workplan` 
              : `${activeUsers.map(u => u.name).join(', ')} are also editing this workplan`
            }. Changes may conflict.
          </span>
        </div>
      )}

      {/* header - compact */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} data-testid="workplan-back-btn" className="h-7 px-2">
            <ArrowLeft className="h-3 w-3 mr-1" /> Home
          </Button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Daily Workplan</h1>
            <p className="text-[10px] text-gray-500">
              {saveState === 'saving' ? 'Saving…' : 'All changes saved'}
              {publishedAt && ` · Published ${new Date(publishedAt).toLocaleString()}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setShowColors(true)} data-testid="manage-colors-btn" className="h-7 px-2 text-xs">
            <Palette className="h-3 w-3 mr-1" /> Colours
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowJobs(true)} data-testid="manage-jobs-btn" className="h-7 px-2 text-xs">
            <ListPlus className="h-3 w-3 mr-1" /> Jobs
          </Button>
          <Button variant="outline" size="sm" onClick={sortByManager} data-testid="sort-manager-btn" className="h-7 px-2 text-xs">
            Sort by Manager
          </Button>
          {selectedRows.size > 0 && (
            <Button variant="outline" size="sm" onClick={copySelectedRows} data-testid="copy-rows-btn" className="h-7 px-2 text-xs border-blue-400 text-blue-600">
              <Copy className="h-3 w-3 mr-1" /> Copy {selectedRows.size}
            </Button>
          )}
          {selectedRows.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearRowSelection} data-testid="clear-selection-btn" className="h-7 px-2 text-xs">
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowLeavers(!showLeavers)} data-testid="toggle-leavers-btn" className="h-7 px-2 text-xs">
            {showLeavers ? 'Hide' : 'Show'} Leavers ({leftRows.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchCosting(costingFrom, costingUntil)} data-testid="costing-btn" className="h-7 px-2 text-xs">
            <BarChart3 className="h-3 w-3 mr-1" /> Costing
          </Button>
          <Button variant="outline" size="sm" onClick={printWorkplan} data-testid="print-btn" className="h-7 px-2 text-xs">
            <Printer className="h-3 w-3 mr-1" /> Print
          </Button>
          <Button onClick={publish} className="bg-green-600 hover:bg-green-700 h-7 px-3 text-xs" size="sm" data-testid="publish-btn">
            <Send className="h-3 w-3 mr-1" /> Publish
          </Button>
        </div>
      </div>

      {/* week controls - compact inline */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(toISO(addDays(weekStart, -7)))} className="h-6 px-2 text-[11px]">
          ← Prev
        </Button>
        <span className="font-medium text-gray-700 text-[11px]">
          {addDays(weekStart, 0).toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(toISO(addDays(weekStart, 7)))} className="h-6 px-2 text-[11px]">
          Next →
        </Button>
        
        {/* Day visibility toggles */}
        <div className="flex items-center gap-0.5 ml-2 border-l pl-2">
          <span className="text-[10px] text-gray-500 mr-1">Days:</span>
          {availableDays.map((i) => (
            <button
              key={i}
              onClick={() => toggleDayVisibility(i)}
              className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                hiddenDays.has(i) 
                  ? 'bg-gray-100 text-gray-400 border-gray-200' 
                  : 'bg-green-100 text-green-700 border-green-300'
              }`}
              title={hiddenDays.has(i) ? `Show ${DAY_NAMES[i]}` : `Hide ${DAY_NAMES[i]}`}
              data-testid={`toggle-day-${i}`}
            >
              {DAY_NAMES[i]}
            </button>
          ))}
          {hiddenDays.size > 0 && (
            <button
              onClick={() => setHiddenDays(new Set())}
              className="text-[10px] text-blue-600 hover:underline ml-1"
            >
              All
            </button>
          )}
        </div>

        {/* Legend inline */}
        {colors.length > 0 && (
          <div className="flex items-center gap-1 ml-2 border-l pl-2">
            {colors.slice(0, 6).map((c) => (
              <span key={c.id} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] border" title={c.name}>
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                {c.name.length > 8 ? c.name.substring(0, 8) + '…' : c.name}
              </span>
            ))}
            {colors.length > 6 && <span className="text-[9px] text-gray-400">+{colors.length - 6}</span>}
          </div>
        )}
        <span className="text-[10px] text-gray-500 ml-2">{activeRows.length} active</span>
        {leftRows.length > 0 && <span className="text-[10px] text-red-400">{leftRows.length} left</span>}
      </div>

      {/* selection toolbar - compact */}
      <div className="flex flex-wrap items-center gap-1 text-[10px] bg-gray-50 border rounded px-2 py-1" data-testid="wp-cell-toolbar">
        {selCells.length > 0 ? (
          <>
            <span className="font-medium text-gray-700">{selCells.length} selected</span>
            <Button size="sm" variant="default" className="h-5 px-2 text-[10px]" onClick={() => anchor && openEditorAt(anchor.rowIdx, anchor.colIdx)} data-testid="cell-setjob-btn">Set job</Button>
            <Button size="sm" variant="outline" className="h-5 px-2 text-[10px]" onClick={copySelected} data-testid="cell-copy-btn">Copy</Button>
            <Button size="sm" variant="outline" className="h-5 px-2 text-[10px]" onClick={pasteSelected} disabled={!clipboard} data-testid="cell-paste-btn">Paste</Button>
            <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px]" onClick={clearSelected} data-testid="cell-clear-btn">Clear</Button>
            <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px]" onClick={clearSelection}>Deselect</Button>
          </>
        ) : selectedDay !== null ? (
          <>
            <span className="text-blue-700 font-medium">Day: {DAY_NAMES[selectedDay]}</span>
            <span className="text-gray-500">Click another day to paste</span>
            <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px]" onClick={() => setSelectedDay(null)}>Cancel</Button>
          </>
        ) : (
          <span className="text-gray-500">Click cell to select · Ctrl+click multi · Shift+click block · Double-click to edit · Day header to copy day</span>
        )}
      </div>

      {/* grid - split layout for fixed left columns and scrollable days */}
      <div className="flex-1 border rounded bg-white overflow-hidden" data-testid="workplan-grid">
        <div className="flex h-full">
          {/* Fixed left columns */}
          <div 
            ref={leftTableRef}
            onScroll={handleLeftScroll}
            className="flex-shrink-0 overflow-y-auto border-r-2 border-gray-300 scrollbar-hide" 
          >
            <table className="text-[11px] border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-100 text-gray-700 text-[10px]">
                  <th className="px-0.5 py-0.5 border w-5 bg-gray-100" title="Drag to reorder"></th>
                  <th className="px-0.5 py-0.5 border w-5 bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedRows.size > 0 && displayRows.every((r) => selectedRows.has(r.id))}
                      onChange={(e) => e.target.checked ? selectAllRows() : clearRowSelection()}
                      className="w-3 h-3 cursor-pointer"
                      title="Select all rows"
                      data-testid="select-all-rows"
                    />
                  </th>
                  <th className="px-0.5 py-0.5 border text-left bg-gray-100" style={{ minWidth: 100 }}>Employee</th>
                  <th className="px-0.5 py-0.5 border text-left bg-gray-100" style={{ minWidth: 70 }}>Vehicle</th>
                  <th className="px-0.5 py-0.5 border text-left bg-gray-100" style={{ minWidth: 60 }}>Impl</th>
                  <th className="px-0.5 py-0.5 border text-left bg-gray-100" style={{ minWidth: 90 }}>
                    <div className="flex items-center gap-1">
                      Mgr
                      <button
                        onClick={sortByManager}
                        className="text-gray-400 hover:text-blue-600"
                        title="Sort rows by manager"
                        data-testid="sort-manager-header-btn"
                      >
                        <ArrowDownAZ className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-0.5 py-0.5 border bg-gray-100" style={{ minWidth: 45 }}>Start</th>
                  <th className="px-0.5 py-0.5 border text-left bg-gray-100" style={{ minWidth: 150 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, rIdx) => {
                  const tint = row.left ? '#fef2f2' : managerTint(row.manager);
                  const isDragging = draggedRowId === row.id;
                  return (
                    <tr 
                      key={row.id} 
                      className={`${row.left ? 'opacity-50' : 'hover:bg-yellow-50'} ${isDragging ? 'opacity-50 bg-blue-100' : ''}`} 
                      data-testid={`wp-row-left-${rIdx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, row.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, row.id)}
                    >
                      <td className="border px-0.5 text-center align-middle cursor-grab active:cursor-grabbing" style={{ background: tint || 'transparent', minHeight: 24 }}>
                        <GripVertical className="h-3 w-3 text-gray-400 mx-auto" />
                      </td>
                      <td className="border px-0.5 text-center align-middle" style={{ background: tint || 'transparent', minHeight: 24 }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.id)}
                          onChange={() => toggleRowSelection(row.id)}
                          className="w-3 h-3 cursor-pointer"
                          data-testid={`wp-select-row-${rIdx}`}
                        />
                      </td>
                      <td className="border px-0.5" style={{ background: tint || '#ffffff' }}>
                        <div className="flex items-center gap-0.5">
                          <input
                            list="wp-staff"
                            value={row.employee_name}
                            onChange={(e) => { setStaffFilter(e.target.value); updateRow(row.id, { employee_name: e.target.value }); }}
                            onFocus={(e) => setStaffFilter(e.target.value)}
                            placeholder="Name"
                            className="flex-1 min-w-0 px-0.5 py-0.5 text-[11px] outline-none bg-transparent"
                            data-testid={`wp-employee-${rIdx}`}
                          />
                          <button
                            onClick={() => updateRow(row.id, { left: !row.left })}
                            className={`shrink-0 px-0.5 rounded text-[8px] font-semibold leading-none ${row.left ? "bg-green-100 text-green-700" : "bg-orange-50 text-orange-500"}`}
                            title={row.left ? "Mark as active" : "Mark as left"}
                            data-testid={`wp-left-${rIdx}`}
                          >
                            {row.left ? '↩' : '✕'}
                          </button>
                        </div>
                      </td>
                      <td className="border px-0.5" style={{ background: tint || 'transparent' }}>
                        <input
                          list="wp-assets"
                          value={row.vehicle}
                          onChange={(e) => { setAssetFilter(e.target.value); updateRow(row.id, { vehicle: e.target.value }); }}
                          onFocus={(e) => setAssetFilter(e.target.value)}
                          placeholder=""
                          className="w-full px-0.5 py-0.5 text-[10px] outline-none bg-transparent"
                          style={{ minWidth: 65 }}
                          data-testid={`wp-vehicle-${rIdx}`}
                        />
                      </td>
                      <td className="border px-0.5" style={{ background: tint || 'transparent' }}>
                        <input
                          list="wp-assets"
                          value={row.implement}
                          onChange={(e) => { setAssetFilter(e.target.value); updateRow(row.id, { implement: e.target.value }); }}
                          onFocus={(e) => setAssetFilter(e.target.value)}
                          placeholder=""
                          className="w-full px-0.5 py-0.5 text-[10px] outline-none bg-transparent"
                          style={{ minWidth: 55 }}
                          data-testid={`wp-implement-${rIdx}`}
                        />
                      </td>
                      <td className="border px-0.5" style={{ background: tint || 'transparent' }}>
                        <input
                          list="wp-managers"
                          value={row.manager}
                          onChange={(e) => { setManagerFilter(e.target.value); updateRow(row.id, { manager: e.target.value }); }}
                          onFocus={(e) => setManagerFilter(e.target.value)}
                          placeholder=""
                          className="w-full px-0.5 py-0.5 text-[10px] outline-none bg-transparent font-medium"
                          style={{ minWidth: 85 }}
                          data-testid={`wp-manager-${rIdx}`}
                        />
                      </td>
                      <td className="border px-0.5" style={{ background: tint || 'transparent' }}>
                        <input
                          type="time"
                          value={row.start_time}
                          onChange={(e) => updateRow(row.id, { start_time: e.target.value })}
                          className="w-full px-0.5 py-0.5 text-[10px] outline-none bg-transparent"
                          style={{ maxWidth: 50 }}
                          data-testid={`wp-start-${rIdx}`}
                        />
                      </td>
                      <td className="border px-0.5 align-top" style={{ background: tint || 'transparent' }}>
                        <textarea
                          value={row.notes}
                          onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                          placeholder="Notes"
                          className="w-full px-0.5 py-0.5 text-[10px] outline-none bg-transparent resize-none leading-tight overflow-visible"
                          style={{ minHeight: 20, minWidth: 180, whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflow: 'hidden', height: 'auto' }}
                          ref={(el) => {
                            if (el && !el.style.height) {
                              el.style.height = 'auto';
                              el.style.height = Math.max(20, el.scrollHeight) + 'px';
                            }
                          }}
                          onInput={(e) => { 
                            e.target.style.height = 'auto'; 
                            e.target.style.height = Math.max(20, e.target.scrollHeight) + 'px'; 
                            triggerRowSync();
                          }}
                          data-testid={`wp-notes-${rIdx}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Scrollable days columns */}
          <div 
            ref={rightTableRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-auto"
          >
            <table className="text-[11px] border-collapse w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-100 text-gray-700 text-[10px]">
                  {visibleDays.map((i) => (
                    <th 
                      key={i} 
                      className={`px-0.5 py-0.5 border text-center cursor-pointer transition-colors ${selectedDay === i ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-gray-100 hover:bg-blue-50'}`}
                      colSpan={2} 
                      style={{ minWidth: 170 }}
                      onClick={() => selectedDay !== null && selectedDay !== i ? copyDayToDay(i) : selectDayColumn(i)}
                      title={selectedDay === null ? 'Click to select this day for copying' : selectedDay === i ? 'Click to deselect' : `Click to paste ${DAY_NAMES[selectedDay]} here`}
                      data-testid={`wp-day-header-${i}`}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        {fmtDay(weekStart, i)}
                        {selectedDay === i && <span className="text-blue-700 text-[8px]">✓</span>}
                      </div>
                    </th>
                  ))}
                  <th className="px-0.5 py-0.5 border w-8 bg-gray-100 text-[9px]">Act</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, rIdx) => {
                  const tint = row.left ? '#fef2f2' : managerTint(row.manager);
                  const isDragging = draggedRowId === row.id;
                  return (
                    <tr 
                      key={row.id} 
                      className={`${row.left ? 'opacity-50' : ''} ${isDragging ? 'opacity-50 bg-blue-100' : ''}`} 
                      data-testid={`wp-row-${rIdx}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, row.id)}
                    >
                      {visibleDays.map((dIdx) => {
                        const day = row.days?.[dIdx] || { am: { job: '', color_id: null }, pm: { job: '', color_id: null } };
                        return (
                          <React.Fragment key={dIdx}>
                            {['am', 'pm'].map((period) => {
                              const cell = day[period] || { job: '', color_id: null };
                              const colIdx = dIdx * 2 + (period === 'pm' ? 1 : 0);
                              const col = cell.color_id ? colors.find((c) => c.id === cell.color_id) : null;
                              const cellBg = col ? col.color : (tint || 'transparent');
                              const cellFg = col ? (textOn(col.color)) : '#111827';
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
                                    minWidth: 80,
                                    maxWidth: 120,
                                    minHeight: 24,
                                    outline: isSel ? '2px solid #2563eb' : inFill ? '2px solid #93c5fd' : 'none',
                                    outlineOffset: '-2px',
                                    boxShadow: isSel ? 'inset 0 0 0 100px rgba(37,99,235,0.10)' : 'none',
                                  }}
                                  onClick={(e) => handleCellClick(rIdx, colIdx, e)}
                                  onDoubleClick={() => openEditorAt(rIdx, colIdx)}
                                  onPointerEnter={() => dragEnter(rIdx, colIdx)}
                                  data-testid={`wp-cell-${rIdx}-${dIdx}-${period}`}
                                >
                                  <div className="px-1 py-0.5 leading-tight text-[10px] whitespace-normal break-words" style={{ minWidth: 75 }}>
                                    {cell.job || ''}
                                  </div>
                                  {isHandleCell && (
                                    <span
                                      onPointerDown={startDragFromSelection}
                                      className="absolute bottom-0 right-0 w-2 h-2 bg-blue-600 border border-white cursor-crosshair"
                                      style={{ transform: 'translate(1px,1px)' }}
                                      title="Drag to fill"
                                      data-testid={`wp-fill-handle-${rIdx}-${dIdx}-${period}`}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      <td className="border px-0.5" style={{ background: tint || 'transparent' }}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => moveRow(row.id, -1)} className="text-gray-400 hover:text-gray-700" title="Move up">
                            <ChevronUp className="h-2.5 w-2.5" />
                          </button>
                          <button onClick={() => deleteRow(row.id)} className="text-red-300 hover:text-red-600" title="Delete row">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                          <button onClick={() => moveRow(row.id, 1)} className="text-gray-400 hover:text-gray-700" title="Move down">
                            <ChevronDown className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Button onClick={addRow} variant="outline" className="w-full h-7 text-xs" data-testid="add-row-btn">
        <Plus className="h-3 w-3 mr-1" /> Add row
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
