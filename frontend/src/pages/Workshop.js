import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Wrench, ClipboardCheck, Package, ScanLine, ArrowLeft, X, Camera, Plus, Trash2,
  CheckCircle2, AlertTriangle, Loader2, RefreshCw, User, Flag,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import QRScanner from '../components/QRScanner';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

// Workshop (v7.5): pre-service checks -> engineer review -> job card -> parts -> signed service sheet

const W = `${API_BASE_URL}/api/workshop`;
const get = async (path) => {
  const r = await fetch(`${W}${path}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `Error ${r.status}`);
  return r.json();
};
const post = async (path, body) => {
  const r = await fetch(`${W}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `Error ${r.status}`);
  return data;
};

const STATUS = {
  not_checked: ['Not checked', 'bg-gray-100 text-gray-500', 'border-l-gray-300'],
  awaiting_review: ['Awaiting review', 'bg-red-50 text-red-700', 'border-l-red-500'],
  draft: ['Review started', 'bg-orange-50 text-orange-700', 'border-l-orange-400'],
  waiting_parts: ['Waiting on parts', 'bg-blue-50 text-blue-700', 'border-l-blue-500'],
  ready: ['Ready to service', 'bg-amber-50 text-amber-700', 'border-l-amber-500'],
  in_progress: ['In workshop', 'bg-purple-50 text-purple-700', 'border-l-purple-500'],
  signed_off: ['Signed off', 'bg-green-50 text-green-700', 'border-l-green-600'],
};
const FILTERS = ['all', 'awaiting_review', 'draft', 'waiting_parts', 'ready', 'in_progress', 'signed_off', 'not_checked'];
const PART_STATUSES = ['To order', 'Ordered', 'Arrived', 'In stock', 'Fitted'];
const TAG_SHORT = {
  bear: 'Bearings', leak: 'Leaks', chain: 'Chain guard', pto: 'PTO guard', guard: 'Guards', batt: 'Battery',
  axle: 'Axles', stop: 'Stop/shut-down', drum: 'Drum', turn: 'Turn motor', hyd: 'Hydraulics', wheel: 'Wheels',
  frame: 'Frame/pins', elec: 'Electrics', rd: 'Raindancer', serial: 'Serial no.', other: 'Other',
};

const Pill = ({ status }) => {
  const [label, cls] = STATUS[status] || [status, 'bg-gray-100'];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span>;
};
const Kicker = ({ children }) => <div className="text-[11px] font-extrabold uppercase tracking-[3px] text-[#5D8F1C]">{children}</div>;
const Box = ({ children, className = '' }) => <div className={`bg-white rounded-2xl shadow-[0_2px_10px_rgba(31,31,29,.06)] p-4 ${className}`}>{children}</div>;
const shortName = (n) => (n || '').replace(/^(\S+)\s.*$/, '$1');
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtTime = (s) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const machineLabel = (name) => {
  const first = shortName(name);
  return /^\d+$/.test(first) ? `No. ${first}` : first;
};

export default function Workshop() {
  const { employee } = useAuth();
  const me = employee?.employee_number;
  const [view, setView] = useState('review');
  const [group, setGroup] = useState(null);
  const [openAsset, setOpenAsset] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const onScan = async (code) => {
    setScanning(false);
    try {
      const r = await get(`/scan?code=${encodeURIComponent(code)}`);
      setOpenAsset(r.asset_id);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="-mx-2 sm:mx-0" data-testid="workshop-page">
      <div className="bg-[#1F1F1D] text-white rounded-none sm:rounded-2xl px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[3px] text-[#A5CE8C]">Workshop</div>
            <h1 className="font-serif text-2xl font-bold">Servicing</h1>
            <p className="text-sm text-gray-300">Pre-service checks → review → parts → signed service sheet</p>
          </div>
          <Button onClick={() => setScanning(true)} className="bg-[#7DB82B] hover:bg-[#5D8F1C] text-white shrink-0" data-testid="workshop-scan">
            <ScanLine className="h-4 w-4" /> Scan machine
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto mt-3">
          {[['review', 'Review', ClipboardCheck], ['jobs', 'My jobs', Wrench], ['parts', 'Parts to order', Package]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => { setView(v); if (v !== 'review') setGroup(null); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-[3px] whitespace-nowrap ${view === v ? 'text-white border-[#7DB82B]' : 'text-gray-400 border-transparent'}`}
              data-testid={`workshop-tab-${v}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-4 px-2 sm:px-0">
        {view === 'review' && !group && <Overview onPick={setGroup} refreshKey={refreshKey} />}
        {view === 'review' && group && <GroupView gkey={group} me={me} onBack={() => setGroup(null)} onOpen={setOpenAsset} refreshKey={refreshKey} refresh={refresh} />}
        {view === 'jobs' && <MyJobs me={me} onOpen={setOpenAsset} refreshKey={refreshKey} />}
        {view === 'parts' && <Parts me={me} onOpen={setOpenAsset} refreshKey={refreshKey} />}
      </div>

      {openAsset && <MachinePanel assetId={openAsset} me={me} onClose={() => { setOpenAsset(null); refresh(); }} />}
      {scanning && <QRScanner onScan={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ machine-type tiles
function Overview({ onPick, refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => { get('/overview').then(setData).catch((e) => toast.error(e.message)); }, [refreshKey]);
  if (!data) return <Loading />;
  if (!data.groups.length) return <Box><p className="text-gray-600">No pre-service checks yet. Once checks come in, each machine type gets its own tile here.</p></Box>;
  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">Pick a machine type. Each one shows the checks from its current service round.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.groups.map((g) => {
          const toReview = (g.counts.awaiting_review || 0) + (g.counts.draft || 0);
          return (
            <button key={g.key} onClick={() => onPick(g.key)} className="text-left" data-testid={`workshop-group-${g.key}`}>
              <Box className="hover:-translate-y-0.5 transition-transform">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-serif text-xl font-bold">{g.label}</div>
                    <div className="text-xs text-gray-500">{g.makes.join(', ')} · {g.machines} machines</div>
                  </div>
                  {toReview > 0 && <span className="rounded-full bg-red-50 text-red-700 text-xs font-bold px-2 py-1">{toReview} to review</span>}
                </div>
                <div className="text-xs text-gray-500 mt-2">Round: <b>{g.round.name}</b>{g.round.default ? '' : ` · since ${fmtDate(g.round.started_at)}`}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {['waiting_parts', 'ready', 'in_progress', 'signed_off', 'not_checked'].filter((s) => g.counts[s]).map((s) => (
                    <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[s][1]}`}>{STATUS[s][0]} · {g.counts[s]}</span>
                  ))}
                </div>
              </Box>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ one machine type
function GroupView({ gkey, me, onBack, onOpen, refreshKey, refresh }) {
  const [data, setData] = useState(null);
  const [sub, setSub] = useState('board');
  const [filter, setFilter] = useState('all');
  const [roundForm, setRoundForm] = useState(false);
  const [roundName, setRoundName] = useState('');
  const load = useCallback(() => get(`/group/${encodeURIComponent(gkey)}`).then(setData).catch((e) => toast.error(e.message)), [gkey]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (!data) return <Loading />;

  const counts = {};
  data.machines.forEach((m) => { counts[m.status] = (counts[m.status] || 0) + 1; });
  const order = ['awaiting_review', 'draft', 'ready', 'in_progress', 'waiting_parts', 'signed_off', 'not_checked'];
  const shown = data.machines.filter((m) => filter === 'all' || m.status === filter)
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const problems = data.machines.reduce((a, m) => a + (m.status === 'awaiting_review' || m.status === 'draft' ? m.problems : 0), 0);

  const startRound = async () => {
    try {
      await post('/rounds', { employee_number: me, group_key: gkey, name: roundName });
      toast.success(`New round started: ${roundName}`);
      setRoundForm(false); setRoundName(''); refresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-600 mb-2"><ArrowLeft className="h-4 w-4" /> All machine types</button>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">{gkey}</h2>
          <div className="text-sm text-gray-600">
            <Flag className="inline h-3.5 w-3.5 mr-1" />Round: <b>{data.round.name}</b>
            {data.round.default ? ' (no round started yet)' : ` · started ${fmtDate(data.round.started_at)} by ${data.round.started_by?.name}`}
          </div>
        </div>
        {!roundForm && <Button variant="outline" size="sm" onClick={() => setRoundForm(true)}>Start a new round</Button>}
      </div>
      {roundForm && (
        <Box className="mb-3">
          <p className="text-sm text-gray-600 mb-2">A new round starts today. The board will then only show checks done from today on; everything earlier stays in each machine's history. Open job cards carry on as they are.</p>
          <div className="flex gap-2">
            <Input value={roundName} onChange={(e) => setRoundName(e.target.value)} placeholder={`e.g. ${gkey}s winter 2026/27`} />
            <Button onClick={startRound} disabled={!roundName.trim()} className="bg-[#7DB82B] hover:bg-[#5D8F1C]">Start</Button>
            <Button variant="ghost" onClick={() => setRoundForm(false)}>Cancel</Button>
          </div>
        </Box>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Stat n={data.machines.length - (counts.not_checked || 0)} l={`of ${data.machines.length} checked`} />
        <Stat n={(counts.awaiting_review || 0) + (counts.draft || 0)} l="awaiting review" c="text-red-700" />
        <Stat n={problems} l="problems to review" c="text-orange-700" />
        <Stat n={counts.signed_off || 0} l="signed off" c="text-green-700" />
      </div>

      <div className="flex gap-2 mb-3">
        {[['board', 'Machines'], ['summary', 'Same fault across machines']].map(([v, l]) => (
          <button key={v} onClick={() => setSub(v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${sub === v ? 'bg-[#1F1F1D] text-white' : 'bg-white border'}`}>{l}</button>
        ))}
      </div>

      {sub === 'board' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FILTERS.filter((f) => f === 'all' || counts[f]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs ${filter === f ? 'bg-[#1F1F1D] text-white border-[#1F1F1D]' : 'bg-white'}`}>
                {f === 'all' ? 'All' : STATUS[f][0]} · {f === 'all' ? data.machines.length : counts[f]}
              </button>
            ))}
          </div>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((m) => (
              <button key={m.asset_id} onClick={() => onOpen(m.asset_id)} className="text-left" data-testid="workshop-machine-card">
                <div className={`bg-white rounded-xl shadow-sm p-3 border-l-[5px] ${STATUS[m.status][2]} h-full`}>
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-serif text-lg font-bold">{machineLabel(m.name)}</span><Pill status={m.status} />
                  </div>
                  <div className="text-xs text-gray-500 truncate">{m.name}</div>
                  {m.status !== 'not_checked' && (
                    <>
                      <div className="flex justify-between text-xs mt-1.5">
                        <span><b>{m.problems}</b> problem{m.problems === 1 ? '' : 's'}</span>
                        <span className="text-gray-500">{shortName(m.checked_by)} · {fmtDate(m.checked_at)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.tags.filter((t) => t !== 'serial').slice(0, 4).map((t) => <span key={t} className="bg-[#E8F2D5] text-[#5D8F1C] rounded px-1.5 text-[11px] font-semibold">{TAG_SHORT[t] || t}</span>)}
                      </div>
                      {m.job_no && <div className="text-[11px] text-gray-500 mt-1">{m.job_no}{m.assigned_to ? ` · ${m.assigned_to.name}` : ''}</div>}
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {sub === 'summary' && <Summary data={data} me={me} onOpen={onOpen} reload={load} />}
    </div>
  );
}

const Stat = ({ n, l, c = '' }) => (
  <Box className="!p-3"><div className={`font-serif text-2xl font-bold ${c}`}>{n}</div><div className="text-xs text-gray-500">{l}</div></Box>
);

function Summary({ data, me, onOpen, reload }) {
  const [adding, setAdding] = useState(null);
  const [form, setForm] = useState({ name: '', part_no: '', qty: 1 });
  const add = async (s) => {
    try {
      const r = await post('/bulk-part', { employee_number: me, group_key: data.group, tag: s.tag, ...form, qty: Number(form.qty) || 1 });
      toast.success(`${form.name} added to ${r.added} review(s). It goes onto Parts to order when each machine is marked Reviewed.`);
      setAdding(null); reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div>
      <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm mb-3">
        <b>Same fault, many machines.</b> Read this before going through machines one at a time. You can add a part to every machine with that fault in one go. It lands in each machine's review, to check and adjust there. Only machines not yet reviewed are counted.
      </div>
      {data.marked_ok_with_fault > 0 && (
        <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-sm mb-3">
          <b>{data.marked_ok_with_fault} items were ticked OK but had a fault written next to them.</b> They are included here and in each review so nothing gets missed.
        </div>
      )}
      <Box className="!p-0 overflow-hidden">
        {data.summary.length === 0 && <p className="p-4 text-gray-500 text-sm">Nothing waiting for review.</p>}
        {data.summary.map((s) => (
          <div key={s.tag} className="border-b last:border-0 p-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-3">
                <span className="font-serif text-2xl font-bold w-8 text-center">{s.machines.length}</span>
                <div>
                  <div className="font-semibold">{s.label}</div>
                  {!s.part && <div className="text-xs text-gray-500">A check or admin job, so no part to order</div>}
                </div>
              </div>
              {s.part && adding !== s.tag && (
                <Button variant="outline" size="sm" onClick={() => { setAdding(s.tag); setForm({ name: s.part, part_no: '', qty: 1 }); }}>
                  <Plus className="h-3.5 w-3.5" /> Add a part to all {s.machines.length}
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.machines.map((m) => (
                <button key={m.asset_id} onClick={() => onOpen(m.asset_id)} className="rounded-md border bg-[#F6F4EE] px-2 py-0.5 text-xs hover:bg-[#E8F2D5]">{shortName(m.name)}</button>
              ))}
            </div>
            {adding === s.tag && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-[2fr_1fr_80px_auto_auto] gap-2 items-end">
                <Labeled l="Part"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Labeled>
                <Labeled l="Part no."><Input value={form.part_no} onChange={(e) => setForm({ ...form, part_no: e.target.value })} /></Labeled>
                <Labeled l="Qty each"><Input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Labeled>
                <Button onClick={() => add(s)} disabled={!form.name.trim()} className="bg-[#7DB82B] hover:bg-[#5D8F1C]">Add to {s.machines.length}</Button>
                <Button variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
              </div>
            )}
          </div>
        ))}
      </Box>
    </div>
  );
}

const Labeled = ({ l, children }) => <div><label className="block text-xs font-semibold text-gray-500 mb-0.5">{l}</label>{children}</div>;
const Loading = () => <div className="flex items-center gap-2 text-gray-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

// ------------------------------------------------------------------ the machine: review / job card / sign-off
function MachinePanel({ assetId, me, onClose }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => get(`/machine/${assetId}`).then(setData).catch((e) => { toast.error(e.message); onClose(); }), [assetId, onClose]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  const job = data?.job;
  const steps = { not_checked: 0, awaiting_review: 1, draft: 1, waiting_parts: 2, ready: 3, in_progress: 3, signed_off: 4 }[data?.status] || 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-[#F6F4EE] h-full overflow-y-auto" data-testid="workshop-machine-panel">
        <div className="sticky top-0 z-10 bg-[#1F1F1D] text-white p-4">
          <button onClick={onClose} className="absolute right-3 top-3 p-1" aria-label="Close"><X className="h-6 w-6" /></button>
          {!data ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <div className="text-[11px] font-extrabold uppercase tracking-[3px] text-[#A5CE8C]">{data.group}{job?.job_no ? ` · Job card ${job.job_no}` : ''}</div>
              <div className="flex items-center gap-2 pr-8"><h2 className="font-serif text-2xl font-bold">{machineLabel(data.asset.name)}</h2><Pill status={data.status} /></div>
              <div className="text-sm text-gray-300">{data.asset.name}</div>
              <div className="flex gap-1 mt-3">{[0, 1, 2, 3].map((i) => <div key={i} className={`flex-1 h-1.5 rounded ${i < steps ? 'bg-[#7DB82B]' : 'bg-gray-600'}`} />)}</div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1"><span>Checked</span><span>Reviewed</span><span>Parts in</span><span>Signed off</span></div>
            </>
          )}
        </div>
        {data && (
          <div className="p-4 space-y-4">
            {data.status === 'not_checked' && !job && <Box><p className="text-gray-600">No pre-service check on this machine in the current round.</p></Box>}
            {(!job || job.status === 'draft') && data.findings.length > 0 && <ReviewEditor data={data} me={me} reload={load} />}
            {job && job.status !== 'draft' && <JobCard data={data} me={me} reload={load} />}
            <History data={data} />
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewEditor({ data, me, reload }) {
  const job = data.job;
  const [dec, setDec] = useState(() => Object.fromEntries(data.findings.map((f) => [f.key, f.decision || null])));
  const [com, setCom] = useState(() => Object.fromEntries(data.findings.map((f) => [f.key, f.comment || ''])));
  const [parts, setParts] = useState(() => (job?.parts || []).map((p) => ({ ...p })));
  const [staff, setStaff] = useState([]);
  const [assign, setAssign] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { get('/staff').then(setStaff).catch(() => {}); }, []);

  const undecided = data.findings.filter((f) => !dec[f.key]).length;
  const addPart = (key, p) => {
    setParts((ps) => [...ps, { ...p, finding_key: key }]);
    if (key && !dec[key]) setDec((d) => ({ ...d, [key]: 'fix' }));
  };
  const save = async (action) => {
    setBusy(true);
    try {
      const r = await post('/review', { employee_number: me, asset_id: data.asset.id, decisions: dec, comments: com, parts, action, assign_to: assign || null });
      if (action === 'review') toast.success(`Job card ${r.job_no} created${r.parts.length ? ` · ${r.parts.length} part line(s) sent to Parts to order` : ''}`);
      else toast.success('Draft saved');
      reload();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <Box>
      <Kicker>1 · Engineer review</Kicker>
      <p className="text-sm text-gray-600 mt-1 mb-3">
        Checked by {[...new Set(data.checks.map((c) => c.by))].join(', ')} ({data.checks.map((c) => fmtDate(c.at)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}).
        For each problem: decide what to do, add a comment for whoever services it, and add any parts needed.
        {job?.draft_by && <> Draft last saved by {job.draft_by.name}.</>}
      </p>
      {data.findings.map((f) => (
        <div key={f.key} className={`rounded-xl border bg-white p-3 mb-2 ${f.marked_ok ? 'border-dashed border-amber-400' : ''}`}>
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-sm">{f.section}</span>
            {f.photos > 0 && <span className="text-xs text-gray-500 flex items-center gap-1"><Camera className="h-3 w-3" />{f.photos}</span>}
          </div>
          <div className="my-1">{f.text}</div>
          {f.marked_ok && <div className="text-xs font-bold text-amber-700 mb-1">Ticked OK on the check, but a fault was written</div>}
          <div className="text-[11px] text-gray-500 mb-2">{f.checked_by} · {fmtDate(f.checked_at)}</div>
          <Decision value={dec[f.key]} onChange={(v) => setDec((d) => ({ ...d, [f.key]: d[f.key] === v ? null : v }))} />
          <div className="mt-2">
            <label className="block text-xs font-semibold text-gray-500 mb-0.5">Engineer's comment</label>
            <Textarea rows={2} value={com[f.key]} onChange={(e) => setCom((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder="e.g. Known issue, bearing seized last season, carry a spare" />
          </div>
          <PartList parts={parts} fkey={f.key} onRemove={(p) => setParts((ps) => ps.filter((x) => x !== p))} />
          <PartAdder onAdd={(p) => addPart(f.key, p)} />
        </div>
      ))}
      <div className="rounded-xl border bg-white p-3 mb-3">
        <div className="font-semibold text-sm">Other parts for this machine</div>
        <PartList parts={parts} fkey={null} onRemove={(p) => setParts((ps) => ps.filter((x) => x !== p))} />
        <PartAdder onAdd={(p) => addPart(null, p)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        <Labeled l="Give the job to (optional)">
          <select className="w-full border rounded-md h-9 px-2 bg-white" value={assign} onChange={(e) => setAssign(e.target.value)}>
            <option value="">Anyone: goes on the Ready list</option>
            {staff.map((s) => <option key={s.employee_number} value={s.employee_number}>{s.name}</option>)}
          </select>
        </Labeled>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => save('review')} disabled={busy || undecided > 0} className="bg-[#7DB82B] hover:bg-[#5D8F1C]" data-testid="workshop-reviewed">
          <CheckCircle2 className="h-4 w-4" /> Reviewed: create job card
        </Button>
        <Button variant="outline" onClick={() => save('draft')} disabled={busy}>Save draft</Button>
        <span className="text-xs text-gray-500">
          {undecided ? `${undecided} problem(s) still need Fix now / Monitor / No action.` : 'You will be recorded as the reviewer.'}
        </span>
      </div>
    </Box>
  );
}

const Decision = ({ value, onChange, disabled }) => (
  <div className="inline-flex rounded-lg border overflow-hidden">
    {[['fix', 'Fix now', 'bg-red-600'], ['monitor', 'Monitor', 'bg-amber-600'], ['none', 'No action', 'bg-gray-600']].map(([v, l, on]) => (
      <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)}
        className={`px-3 py-1.5 text-xs font-semibold border-r last:border-r-0 ${value === v ? `${on} text-white` : 'bg-white text-gray-700'}`}>{l}</button>
    ))}
  </div>
);

function PartList({ parts, fkey, onRemove, showStatus }) {
  const mine = parts.filter((p) => (p.finding_key || null) === fkey);
  if (!mine.length) return null;
  return mine.map((p, i) => (
    <div key={p.id || i} className="flex items-center justify-between gap-2 bg-blue-50 rounded-lg px-3 py-1.5 mt-2 text-sm">
      <span><b>{p.name}</b>{p.part_no && <span className="text-gray-500"> · {p.part_no}</span>} × {p.qty}</span>
      {showStatus
        ? <span className={`text-xs font-bold ${['In stock', 'Fitted'].includes(p.status) ? 'text-green-700' : 'text-blue-700'}`}>{p.status}</span>
        : <button onClick={() => onRemove(p)} className="text-gray-500 hover:text-red-600" aria-label="Remove part"><Trash2 className="h-4 w-4" /></button>}
    </div>
  ));
}

function PartAdder({ onAdd }) {
  const [p, setP] = useState({ name: '', part_no: '', qty: 1 });
  const add = () => { if (!p.name.trim()) return; onAdd({ name: p.name.trim(), part_no: p.part_no.trim(), qty: Number(p.qty) || 1 }); setP({ name: '', part_no: '', qty: 1 }); };
  const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  return (
    <div className="grid grid-cols-[1fr_1fr] sm:grid-cols-[2fr_1fr_70px_auto] gap-2 mt-2 items-end">
      <Labeled l="Part needed"><Input value={p.name} onKeyDown={enter} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Small wheel bearing" /></Labeled>
      <Labeled l="Part no."><Input value={p.part_no} onKeyDown={enter} onChange={(e) => setP({ ...p, part_no: e.target.value })} /></Labeled>
      <Labeled l="Qty"><Input type="number" min="1" value={p.qty} onChange={(e) => setP({ ...p, qty: e.target.value })} /></Labeled>
      <Button variant="outline" onClick={add} disabled={!p.name.trim()}><Plus className="h-4 w-4" /> Add part</Button>
    </div>
  );
}

function JobCard({ data, me, reload }) {
  const job = data.job;
  const signed = job.status === 'signed_off';
  const [done, setDone] = useState(() => new Set(job.done || job.sheet?.done || []));
  const [work, setWork] = useState('');
  const [hours, setHours] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef(null);

  useEffect(() => { if (signed) get(`/job/${job.id}/sheet`).then((j) => setSheet(j.sheet)).catch(() => {}); }, [signed, job.id]);

  const fixes = job.findings.filter((f) => f.decision === 'fix');
  const monitors = job.findings.filter((f) => f.decision === 'monitor');
  const mine = job.assigned_to?.employee_number === me;
  const waiting = job.parts.filter((p) => !['In stock', 'Fitted'].includes(p.status)).length;

  const toggle = async (key) => {
    const n = new Set(done); n.has(key) ? n.delete(key) : n.add(key); setDone(n);
    try { await post(`/job/${job.id}/progress`, { employee_number: me, done: [...n] }); } catch (e) { toast.error(e.message); }
  };
  const take = async () => {
    try { await post(`/job/${job.id}/take`, { employee_number: me }); toast.success(`${job.job_no} is now yours`); reload(); } catch (e) { toast.error(e.message); }
  };
  const signOff = async () => {
    const sig = sigRef.current?.data();
    if (!sig) { toast.error('Please sign in the box before signing off'); return; }
    setBusy(true);
    try {
      await post(`/job/${job.id}/sign`, { employee_number: me, done: [...done], work, hours: hours ? Number(hours) : null, next_due: nextDue || null, signature: sig });
      toast.success(`${job.job_no} signed off`); reload();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <>
      <Box>
        <Kicker>1 · Review</Kicker>
        <div className="mt-2 rounded-lg bg-[#E8F2D5] text-[#5D8F1C] font-semibold p-3 text-sm">
          <CheckCircle2 className="inline h-4 w-4 mr-1" />Reviewed by {job.reviewed_by?.name}, {fmtTime(job.reviewed_at)}. Job card {job.job_no}.
        </div>
      </Box>
      <Box>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <Kicker>2 · Job card {job.job_no}</Kicker>
          {!signed && (job.assigned_to
            ? <span className="text-sm flex items-center gap-1"><User className="h-4 w-4" /> {mine ? 'Your job' : job.assigned_to.name}</span>
            : <Button size="sm" onClick={take} className="bg-[#1F1F1D]" data-testid="workshop-take">Take this job</Button>)}
        </div>
        {!signed && job.assigned_to && !mine && <Button size="sm" variant="outline" className="mt-2" onClick={take}>Take it over</Button>}
        {waiting > 0 && !signed && <div className="mt-2 text-sm text-blue-700 flex items-center gap-1"><Package className="h-4 w-4" /> Waiting on {waiting} part line(s)</div>}

        <h3 className="font-serif font-bold mt-3 mb-1">To fix</h3>
        {fixes.length === 0 && <p className="text-sm text-gray-500">Nothing marked Fix now.</p>}
        {fixes.map((f) => (
          <div key={f.key} className="rounded-xl border bg-white p-3 mb-2">
            <label className="flex gap-2 items-start cursor-pointer">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={done.has(f.key)} disabled={signed} onChange={() => toggle(f.key)} />
              <span><b>{f.section}:</b> {f.text}</span>
            </label>
            {f.comment && <div className="mt-2 rounded-md border-l-[3px] border-[#7DB82B] bg-[#E8F2D5] px-3 py-1.5 text-sm"><b>{job.reviewed_by?.name}:</b> {f.comment}</div>}
            <PartList parts={job.parts} fkey={f.key} showStatus />
          </div>
        ))}
        {job.parts.some((p) => !p.finding_key) && (
          <div className="rounded-xl border bg-white p-3 mb-2"><div className="font-semibold text-sm">Other parts</div><PartList parts={job.parts} fkey={null} showStatus /></div>
        )}
        {monitors.length > 0 && (
          <>
            <h3 className="font-serif font-bold mt-3 mb-1">Keep an eye on</h3>
            {monitors.map((f) => (
              <div key={f.key} className="border-l-[3px] border-amber-500 pl-3 mb-2 text-sm">
                {f.section}: {f.text}{f.comment && <div className="italic text-gray-600">{f.comment}</div>}
              </div>
            ))}
          </>
        )}
      </Box>

      <Box>
        <Kicker>3 · Service sheet</Kicker>
        {signed ? (
          <div className="mt-2">
            <div className="rounded-lg bg-[#E8F2D5] text-[#5D8F1C] font-semibold p-3 text-sm mb-2">
              <CheckCircle2 className="inline h-4 w-4 mr-1" />Signed off by {job.sheet?.signed_by?.name}, {fmtTime(job.sheet?.signed_at)}
            </div>
            {sheet?.work && <p className="text-sm"><b>Work done:</b> {sheet.work}</p>}
            <p className="text-sm"><b>Labour:</b> {sheet?.hours ?? '–'} hrs · <b>Next service due:</b> {sheet?.next_due || '–'}</p>
            {sheet?.signature && <img src={sheet.signature} alt="Signature" className="mt-2 max-w-[260px] border rounded-lg bg-white" />}
            <p className="text-xs text-gray-500 mt-2">Locked. Also saved to this machine's Service History.</p>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-600">Tick off each job above as it's done, then fill this in and sign.</p>
            <Labeled l="Work done / notes"><Textarea rows={3} value={work} onChange={(e) => setWork(e.target.value)} placeholder="e.g. Replaced small wheel bearing, refitted chain guard, checked axle bolts" /></Labeled>
            <div className="grid grid-cols-2 gap-2">
              <Labeled l="Labour hours"><Input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} /></Labeled>
              <Labeled l="Next service due"><Input type="month" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Labeled>
            </div>
            {done.size < fixes.length && <div className="text-sm text-amber-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {fixes.length - done.size} job(s) not ticked. They will show as NOT done on the sheet.</div>}
            <Labeled l="Signature"><SignaturePad padRef={sigRef} /></Labeled>
            <Button onClick={signOff} disabled={busy} className="bg-[#1F1F1D]" data-testid="workshop-sign">Sign off: machine complete</Button>
          </div>
        )}
      </Box>
    </>
  );
}

function History({ data }) {
  const earlier = (data.history || []).filter((h) => h.job_no !== data.job?.job_no);
  if (!earlier.length) return null;
  return (
    <Box>
      <Kicker>Earlier job cards</Kicker>
      {earlier.map((h) => (
        <div key={h.job_no} className="border-l-[3px] border-[#A5CE8C] pl-3 mt-2 text-sm">
          <b>{h.job_no}</b> · {h.round_name} · signed by {h.sheet?.signed_by?.name} {fmtDate(h.sheet?.signed_at)}
          {h.sheet?.work && <div className="text-gray-600">{h.sheet.work}</div>}
        </div>
      ))}
    </Box>
  );
}

// Finger / mouse signature, returns a PNG data URL (or null if nothing drawn)
const SignaturePad = ({ padRef }) => {
  const canvas = useRef(null);
  const state = useRef({ drawing: false, ink: false });
  useEffect(() => {
    const c = canvas.current; const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = r.height * 2;
    const x = c.getContext('2d'); x.scale(2, 2); x.lineWidth = 2; x.lineCap = 'round'; x.strokeStyle = '#1F1F1D';
    const pos = (e) => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const down = (e) => { state.current.drawing = true; x.beginPath(); x.moveTo(...pos(e)); c.setPointerCapture?.(e.pointerId); };
    const move = (e) => { if (!state.current.drawing) return; x.lineTo(...pos(e)); x.stroke(); state.current.ink = true; };
    const up = () => { state.current.drawing = false; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointerleave', up);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointerleave', up); };
  }, []);
  if (padRef) padRef.current = { data: () => (state.current.ink ? canvas.current.toDataURL('image/png') : null) };
  const clear = () => { const c = canvas.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); state.current.ink = false; };
  return (
    <div>
      <canvas ref={canvas} className="w-full h-32 border border-dashed border-gray-400 rounded-lg bg-white touch-none" data-testid="workshop-signature" />
      <button type="button" onClick={clear} className="text-xs text-gray-600 underline mt-1">Clear signature</button>
    </div>
  );
};

// ------------------------------------------------------------------ mechanic's list
function MyJobs({ me, onOpen, refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => { get(`/my-jobs?employee_number=${encodeURIComponent(me || '')}`).then(setData).catch((e) => toast.error(e.message)); }, [me, refreshKey]);
  if (!data) return <Loading />;
  const Section = ({ title, jobs, note, dim }) => (
    <div className="mb-5">
      <h3 className="font-serif text-lg font-bold">{title} <span className="text-gray-400 text-base">· {jobs.length}</span></h3>
      {note && <p className="text-xs text-gray-500 mb-1">{note}</p>}
      {jobs.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-1">
          {jobs.map((j) => (
            <button key={j.id} onClick={() => onOpen(j.asset_id)} className={`text-left ${dim ? 'opacity-60' : ''}`} data-testid="workshop-job">
              <div className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between"><span className="font-serif font-bold">{machineLabel(j.asset_name)}</span><span className="text-xs text-gray-500">{j.job_no}</span></div>
                <div className="text-xs text-gray-500 truncate">{j.group_key} · {j.asset_name}</div>
                <div className="text-sm mt-1">{j.fix_count} job{j.fix_count === 1 ? '' : 's'} to do{j.parts_waiting ? <span className="text-blue-700"> · waiting on {j.parts_waiting} part(s)</span> : ''}</div>
                {j.assigned_to && <div className="text-xs text-gray-500 mt-0.5">{j.assigned_to.name}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div>
      <Section title="My jobs" jobs={data.mine} />
      <Section title="Ready: anyone can take" jobs={data.ready} note="Reviewed and parts in. Open one and press Take this job." />
      <Section title="Waiting on parts" jobs={data.waiting_parts} dim note="Not ready yet. Shown so you can see what is coming." />
      <Section title="Other people's jobs" jobs={data.others} dim />
    </div>
  );
}

// ------------------------------------------------------------------ parts across all job cards
function Parts({ me, onOpen, refreshKey }) {
  const [data, setData] = useState(null);
  const [showFitted, setShowFitted] = useState(false);
  const load = useCallback(() => get(`/parts?show_fitted=${showFitted}`).then(setData).catch((e) => toast.error(e.message)), [showFitted]);
  useEffect(() => { load(); }, [load, refreshKey]);
  const setStatus = async (line, status) => {
    try {
      await post('/parts/status', { employee_number: me, status, uses: line.uses.map((u) => ({ job_id: u.job_id, part_id: u.part_id })) });
      toast.success(`${line.name}: ${status}`); load();
    } catch (e) { toast.error(e.message); }
  };
  if (!data) return <Loading />;
  return (
    <Box>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h2 className="font-serif text-xl font-bold">Parts to order</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={showFitted} onChange={(e) => setShowFitted(e.target.checked)} /> Show fitted</label>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-3">One line per part across every job card. Changing the status changes it on every job card waiting on that part. Parts arrive here when a machine is marked Reviewed.</p>
      {data.lines.length === 0 && <p className="text-sm text-gray-500">Nothing to order.</p>}
      <div className="divide-y">
        {data.lines.map((L) => {
          const st = L.uses.every((u) => u.status === L.uses[0].status) ? L.uses[0].status : '';
          return (
            <div key={`${L.name}|${L.part_no}`} className="py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_60px_3fr_150px] gap-2 items-start">
              <div><div className="font-semibold">{L.name}</div>{L.part_no && <div className="text-xs text-gray-500">Part no. {L.part_no}</div>}</div>
              <div className="font-serif text-2xl font-bold text-right sm:text-left">{L.qty}</div>
              <div className="flex flex-wrap gap-1 col-span-2 sm:col-span-1">
                {L.uses.map((u) => (
                  <button key={u.part_id} onClick={() => onOpen(u.asset_id)} className="rounded-md border bg-[#F6F4EE] px-2 py-0.5 text-xs hover:bg-[#E8F2D5]">
                    {shortName(u.asset_name)} · {u.job_no}{u.qty > 1 ? ` ×${u.qty}` : ''}
                  </button>
                ))}
              </div>
              <select className="border rounded-md h-9 px-2 bg-white col-span-2 sm:col-span-1" value={st} onChange={(e) => setStatus(L, e.target.value)}>
                {!st && <option value="">Mixed</option>}
                {PART_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </Box>
  );
}
