import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ChevronDown, ChevronRight, ClipboardCheck, Settings, AlertTriangle, History, Package } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

const TYPE_META = {
  pre_service_check: { label: 'Pre Service Check', icon: ClipboardCheck, badge: 'bg-green-100 text-green-800' },
  workshop_service: { label: 'Workshop Service', icon: Settings, badge: 'bg-orange-100 text-orange-800' },
};
const FAULT_META = { label: 'Check with faults', icon: AlertTriangle, badge: 'bg-red-100 text-red-800' };

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const faults = (rec) => (rec.checklist_items || []).filter(i => i.status === 'unsatisfactory');

const summary = (rec) => {
  const bad = faults(rec).length;
  const parts = rec.parts_required?.length || 0;
  if (rec.check_type === 'workshop_service') return rec.workshop_notes ? rec.workshop_notes.slice(0, 90) : 'Workshop service recorded';
  const bits = [bad ? `${bad} needs work` : 'Nothing needed work'];
  if (parts) bits.push(`${parts} part${parts > 1 ? 's' : ''} required`);
  return bits.join(' · ');
};

const HistoryEntry = ({ rec, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const meta = TYPE_META[rec.check_type] || FAULT_META;
  const Icon = meta.icon;
  const bad = faults(rec);
  return (
    <div className="border rounded-lg bg-white" data-testid={`history-entry-${rec.id}`}>
      <button type="button" className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50" onClick={() => setOpen(o => !o)} data-testid={`history-toggle-${rec.id}`}>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        <Icon className={`h-4 w-4 shrink-0 ${rec.check_type === 'pre_service_check' ? 'text-green-700' : rec.check_type === 'workshop_service' ? 'text-orange-600' : 'text-red-600'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{fmtDate(rec.completed_at)}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            <span className="text-xs text-gray-500">by {rec.staff_name}</span>
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">{summary(rec)}</p>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm border-t" data-testid={`history-detail-${rec.id}`}>
          {bad.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Needed work</p>
              <ul className="space-y-1">
                {bad.map((i, idx) => (
                  <li key={`${i.item}-${idx}`} className="bg-red-50 border border-red-100 rounded px-2 py-1">
                    <span className="font-medium">{i.item}</span>
                    {i.notes && <span className="text-gray-700"> — {i.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rec.workshop_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{rec.check_type === 'pre_service_check' ? 'Other parts or issues' : 'Notes'}</p>
              <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 rounded px-2 py-1">{rec.workshop_notes}</p>
            </div>
          )}
          {rec.parts_required?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Parts required</p>
              <ul className="list-decimal list-inside bg-green-50 rounded px-3 py-1 space-y-0.5">
                {rec.parts_required.map((p, idx) => <li key={`${p}-${idx}`}>{p}</li>)}
              </ul>
            </div>
          )}
          {bad.length === 0 && !rec.workshop_notes && !(rec.parts_required?.length) && (
            <p className="text-gray-500 text-xs">All sections OK — nothing recorded as needing work.</p>
          )}
        </div>
      )}
    </div>
  );
};

export const ServiceHistoryPanel = ({ make, model }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!make || !model) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setExpanded(false);
    const params = new URLSearchParams({ make, model, limit: '30' });
    fetch(`${API_BASE_URL}/api/checklists/machine-history?${params}`)
      .then(r => (r.ok ? r.json() : { records: [], total: 0 }))
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ records: [], total: 0 }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [make, model]);

  if (!make || !model) return null;
  const records = data?.records || [];
  const partsCount = records.reduce((n, r) => n + (r.parts_required?.length || 0), 0);

  return (
    <Card className="p-4 border-slate-200 bg-slate-50/60" data-testid="service-history-panel">
      <button type="button" className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setExpanded(e => !e)} data-testid="service-history-toggle">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-slate-600" />
          <div>
            <p className="font-semibold text-slate-900">Service History</p>
            <p className="text-xs text-slate-600" data-testid="service-history-summary">
              {loading ? 'Loading…'
                : records.length === 0 ? 'No previous service records or faults for this machine'
                : `${data.total} record${data.total > 1 ? 's' : ''}${data.last_service_at ? ` · last service ${fmtDate(data.last_service_at)}` : ' · no service yet'}${partsCount ? ` · ${partsCount} part${partsCount > 1 ? 's' : ''} requested` : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && records.length > 0 && <Badge variant="secondary" data-testid="service-history-count">{data.total}</Badge>}
          {!loading && records.length > 0 && (expanded ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronRight className="h-5 w-5 text-slate-500" />)}
        </div>
      </button>
      {expanded && records.length > 0 && (
        <div className="mt-3 space-y-2" data-testid="service-history-list">
          {records.map((rec, idx) => <HistoryEntry key={rec.id} rec={rec} defaultOpen={idx === 0} />)}
          {data.total > records.length && <p className="text-xs text-slate-500">Showing the latest {records.length} of {data.total}.</p>}
        </div>
      )}
    </Card>
  );
};
