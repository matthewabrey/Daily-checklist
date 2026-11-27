// Procedures (v7.8) — Manager → Procedures.
// A tile per job (e.g. "Carrot Drilling") holding an ordered list of steps.
// List of tiles → open one to read it → Edit (rename, re-order, add/remove steps),
// Copy to a new tile, or Delete.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Search, Pencil, Copy, Trash2, ArrowUp, ArrowDown, X, Save,
  ListOrdered, Printer, Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

const GREEN = '#7DB82B';
const GREEN_DARK = '#5D8F1C';
const PALE = '#E8F2D5';

const stepId = () => Math.random().toString(36).slice(2, 12);
const blank = () => ({ id: null, title: '', department: '', steps: [{ id: stepId(), text: '' }] });

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) { return ''; }
};

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE_URL}/api/procedures${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Something went wrong');
  return data;
}

// A textarea that grows with its text, so long steps stay readable on a phone.
function AutoText({ value, onChange, onKeyDown, inputRef, placeholder }) {
  const local = useRef(null);
  const ref = inputRef || local;
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [value, ref]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="w-full resize-none overflow-hidden rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  );
}

export default function Procedures() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const by = employee?.name || employee?.employee_number || '';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [departments, setDepartments] = useState([]);

  const [mode, setMode] = useState('list'); // list | view | edit
  const [current, setCurrent] = useState(null); // the saved procedure being viewed
  const [draft, setDraft] = useState(null);     // the copy being edited
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const titleRef = useRef(null);
  const stepRefs = useRef({});
  const focusStep = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('');
      setList(data.procedures || []);
    } catch (e) {
      toast.error("Couldn't load the procedures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/job-lists`)
      .then((r) => r.json())
      .then((d) => setDepartments((d.departments || []).map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean)))
      .catch(() => {});
  }, []);

  // After adding a step, put the cursor in it.
  useEffect(() => {
    if (focusStep.current && stepRefs.current[focusStep.current]) {
      stepRefs.current[focusStep.current].current?.focus();
      focusStep.current = null;
    }
  });

  const deptOptions = useMemo(() => {
    const s = new Set(departments);
    list.forEach((p) => p.department && s.add(p.department));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [departments, list]);

  const usedDepts = useMemo(
    () => [...new Set(list.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [list],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (!q) return true;
      return (p.title || '').toLowerCase().includes(q)
        || (p.department || '').toLowerCase().includes(q)
        || (p.steps || []).some((s) => (s.text || '').toLowerCase().includes(q));
    });
  }, [list, search, dept]);

  // ---------- navigation between list / view / edit ----------
  const confirmLeave = () => !dirty || window.confirm('You have changes that aren’t saved. Leave without saving?');

  const openView = (p) => { setCurrent(p); setMode('view'); window.scrollTo(0, 0); };
  const backToList = () => {
    if (mode === 'edit' && !confirmLeave()) return;
    setMode('list'); setCurrent(null); setDraft(null); setDirty(false);
  };
  const startNew = () => {
    setCurrent(null);
    setDraft(blank());
    setDirty(false);
    setMode('edit');
    setTimeout(() => titleRef.current?.focus(), 50);
  };
  const startEdit = (p) => {
    setDraft({
      id: p.id, title: p.title, department: p.department || '',
      steps: (p.steps && p.steps.length ? p.steps : [{ text: '' }]).map((s) => ({ id: s.id || stepId(), text: s.text })),
    });
    setDirty(false);
    setMode('edit');
  };
  const cancelEdit = () => {
    if (!confirmLeave()) return;
    setDirty(false);
    if (current) { setDraft(null); setMode('view'); } else backToList();
  };

  // ---------- editing ----------
  const patch = (p) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };
  const setStep = (id, text) => patch({ steps: draft.steps.map((s) => (s.id === id ? { ...s, text } : s)) });
  const addStepAfter = (index) => {
    const s = { id: stepId(), text: '' };
    const steps = [...draft.steps];
    steps.splice(index + 1, 0, s);
    focusStep.current = s.id;
    patch({ steps });
  };
  const removeStep = (id) => {
    const steps = draft.steps.filter((s) => s.id !== id);
    patch({ steps: steps.length ? steps : [{ id: stepId(), text: '' }] });
  };
  const moveStep = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    patch({ steps });
  };
  const onStepKey = (e, i) => {
    // Enter starts the next step; Shift+Enter is a new line inside this one.
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addStepAfter(i); }
  };

  const save = async () => {
    if (!draft.title.trim()) { toast.error('Give the procedure a name first'); titleRef.current?.focus(); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ title: draft.title, department: draft.department, steps: draft.steps, by });
      const saved = draft.id
        ? await api(`/${draft.id}`, { method: 'PUT', body })
        : await api('', { method: 'POST', body });
      toast.success(`Saved — ${saved.title}`);
      setDirty(false);
      setDraft(null);
      setCurrent(saved);
      setMode('view');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (p) => {
    try {
      const made = await api(`/${p.id}/copy`, { method: 'POST', body: JSON.stringify({ by }) });
      toast.success('Copied — give the new one its name');
      load();
      setCurrent(made);
      startEdit(made);
      setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 50);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.title}”? This takes it off the list for everyone.`)) return;
    try {
      await api(`/${p.id}?by=${encodeURIComponent(by)}`, { method: 'DELETE' });
      toast.success('Deleted');
      setMode('list'); setCurrent(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const printIt = (p) => {
    const w = window.open('', '_blank');
    if (!w) { toast.error('Allow pop-ups to print'); return; }
    const esc = (t) => String(t || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    w.document.write(`<!doctype html><html><head><title>${esc(p.title)}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;margin:32px;color:#1F1F1D}
      h1{font-family:Georgia,serif;margin:0 0 4px}.k{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${GREEN_DARK};font-weight:800}
      ol{font-size:16px;line-height:1.5;padding-left:28px}li{margin:8px 0;white-space:pre-wrap}
      .f{margin-top:24px;font-size:11px;color:#6B6B66}</style></head><body>
      <div class="k">Abreys Procedure${p.department ? ' · ' + esc(p.department) : ''}</div>
      <h1>${esc(p.title)}</h1>
      <ol>${(p.steps || []).map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>
      <div class="f">Last updated ${esc(fmtDate(p.updated_at))}${p.updated_by ? ' by ' + esc(p.updated_by) : ''}</div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  // ---------- screens ----------
  const Header = ({ title, sub, onBack }) => (
    <div className="flex items-center space-x-4">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[3px]" style={{ color: GREEN_DARK }}>Manager · Procedures</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words" style={{ fontFamily: 'Georgia, serif' }}>{title}</h1>
        {sub && <p className="text-gray-600 mt-1 text-sm">{sub}</p>}
      </div>
    </div>
  );

  if (mode === 'view' && current) {
    const p = current;
    return (
      <div className="space-y-5 max-w-3xl">
        <Header title={p.title} sub={p.department || null} onBack={backToList} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => startEdit(p)} className="text-white" style={{ background: GREEN }}>
            <Pencil className="h-4 w-4 mr-2" />Edit
          </Button>
          <Button variant="outline" onClick={() => copy(p)}><Copy className="h-4 w-4 mr-2" />Copy to a new procedure</Button>
          <Button variant="outline" onClick={() => printIt(p)}><Printer className="h-4 w-4 mr-2" />Print</Button>
          <Button variant="outline" onClick={() => remove(p)} className="text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="h-4 w-4 mr-2" />Delete
          </Button>
        </div>
        <div className="bg-white rounded-2xl p-5 sm:p-6" style={{ boxShadow: '0 2px 10px rgba(31,31,29,.06)' }}>
          {(p.steps || []).length === 0 ? (
            <p className="text-gray-500">No steps yet — press Edit to add them.</p>
          ) : (
            <ol className="space-y-3">
              {p.steps.map((s, i) => (
                <li key={s.id || i} className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center"
                        style={{ background: PALE, color: GREEN_DARK }}>{i + 1}</span>
                  <span className="pt-1 text-gray-900 text-base whitespace-pre-wrap break-words">{s.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Last updated {fmtDate(p.updated_at)}{p.updated_by ? ` by ${p.updated_by}` : ''}
        </p>
      </div>
    );
  }

  if (mode === 'edit' && draft) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Header title={draft.id ? 'Edit procedure' : 'New procedure'} onBack={cancelEdit} />
        <div className="bg-white rounded-2xl p-5 sm:p-6 space-y-4" style={{ boxShadow: '0 2px 10px rgba(31,31,29,.06)' }}>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Name / job</label>
            <Input ref={titleRef} value={draft.title} placeholder="e.g. Carrot Drilling"
                   onChange={(e) => patch({ title: e.target.value })} className="text-base h-11" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Crop / department <span className="font-normal text-gray-500">(optional)</span></label>
            <Input value={draft.department} list="procedure-depts" placeholder="Pick or type"
                   onChange={(e) => patch({ department: e.target.value })} className="text-base h-11" />
            <datalist id="procedure-depts">{deptOptions.map((d) => <option key={d} value={d} />)}</datalist>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-800">Steps, in order</label>
              <span className="text-xs text-gray-500 hidden sm:inline">Enter = next step · Shift+Enter = new line</span>
            </div>
            <div className="space-y-2">
              {draft.steps.map((s, i) => {
                if (!stepRefs.current[s.id]) stepRefs.current[s.id] = { current: null };
                return (
                  <div key={s.id} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-8 h-8 mt-1 rounded-full text-sm font-bold flex items-center justify-center"
                          style={{ background: PALE, color: GREEN_DARK }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <AutoText value={s.text} inputRef={stepRefs.current[s.id]}
                                placeholder={i === 0 ? 'e.g. Check the seed rate is set' : 'Next step'}
                                onChange={(t) => setStep(s.id, t)} onKeyDown={(e) => onStepKey(e, i)} />
                    </div>
                    <div className="flex flex-shrink-0">
                      <button type="button" title="Move up" onClick={() => moveStep(i, -1)} disabled={i === 0}
                              className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" title="Move down" onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1}
                              className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" title="Remove step" onClick={() => removeStep(s.id)}
                              className="p-2 text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="mt-3" onClick={() => addStepAfter(draft.steps.length - 1)}>
              <Plus className="h-4 w-4 mr-2" />Add step
            </Button>
          </div>
        </div>

        <div className="flex gap-2 sticky bottom-2">
          <Button onClick={save} disabled={saving} className="text-white flex-1 sm:flex-none py-6 sm:py-2" style={{ background: GREEN }}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save
          </Button>
          <Button variant="outline" onClick={cancelEdit} className="py-6 sm:py-2 bg-white">Cancel</Button>
        </div>
      </div>
    );
  }

  // ---------- the tiles ----------
  return (
    <div className="space-y-5">
      <Header title="Procedures" sub="Step-by-step checks for each job. Open one to read it, edit it, or copy it to start a new one."
              onBack={() => navigate('/manager')} />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search names and steps"
                 className="pl-9 h-11 text-base bg-white" />
        </div>
        {usedDepts.length > 0 && (
          <select value={dept} onChange={(e) => setDept(e.target.value)}
                  className="h-11 rounded-md border border-gray-300 bg-white px-3 text-base">
            <option value="">All departments</option>
            {usedDepts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <Button onClick={startNew} className="h-11 text-white" style={{ background: GREEN }}>
          <Plus className="h-4 w-4 mr-2" />New procedure
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <button onClick={startNew}
                  className="rounded-2xl border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 p-5 text-left min-h-[120px] flex flex-col items-start justify-center transition-colors">
            <Plus className="h-6 w-6 mb-2" style={{ color: GREEN_DARK }} />
            <span className="font-semibold text-gray-900">New procedure</span>
            <span className="text-xs text-gray-500">Start from blank</span>
          </button>
          {shown.map((p) => (
            <button key={p.id} onClick={() => openView(p)}
                    className="bg-white rounded-2xl p-5 text-left min-h-[120px] flex flex-col hover:ring-2 hover:ring-green-400 transition"
                    style={{ boxShadow: '0 2px 10px rgba(31,31,29,.06)' }}>
              {p.department ? (
                <span className="text-[10px] font-extrabold uppercase tracking-[2px] mb-1" style={{ color: GREEN_DARK }}>{p.department}</span>
              ) : <span className="h-[15px] mb-1" />}
              <span className="text-lg font-bold text-gray-900 break-words" style={{ fontFamily: 'Georgia, serif' }}>{p.title}</span>
              <span className="mt-auto pt-3 flex items-center text-xs text-gray-500">
                <ListOrdered className="h-3.5 w-3.5 mr-1" />
                {(p.steps || []).length} step{(p.steps || []).length === 1 ? '' : 's'}
                <span className="mx-1.5">·</span>{fmtDate(p.updated_at)}
              </span>
            </button>
          ))}
        </div>
      )}
      {!loading && list.length > 0 && shown.length === 0 && (
        <p className="text-gray-500 text-sm">Nothing matches that search.</p>
      )}
    </div>
  );
}
