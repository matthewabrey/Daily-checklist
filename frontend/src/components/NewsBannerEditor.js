import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Megaphone, Plus, Trash2, ArrowUp, ArrowDown, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '../lib/api';
import NewsBanner from './NewsBanner';

const STYLES = [
  { value: 'normal', label: 'Plain' },
  { value: 'good', label: 'Good news' },
  { value: 'celebrate', label: 'Celebrate' },
  { value: 'grow', label: 'Grow' },
  { value: 'flash', label: 'Flashing' },
  { value: 'urgent', label: 'Urgent' },
];

const newItem = () => ({
  id: (crypto?.randomUUID && crypto.randomUUID()) || `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  text: '',
  style: 'normal',
  active: true,
  ends_on: '',
});

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function NewsBannerEditor({ employeeName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerKey, setBannerKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/news-banner/all`);
      const data = await res.json();
      setItems((data.items || []).map((i) => ({ ...newItem(), ...i, ends_on: i.ends_on || '' })));
    } catch (e) {
      toast.error("Couldn't load the news banner");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (id, patch) => setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) => setItems((rows) => rows.filter((r) => r.id !== id));
  const move = (i, dir) => setItems((rows) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return rows;
    const copy = [...rows];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/news-banner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ ...i, ends_on: i.ends_on || null })),
          updated_by: employeeName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.live_now
            ? `Saved — ${data.live_now} message${data.live_now === 1 ? '' : 's'} rolling on everyone's screen`
            : 'Saved — nothing is showing at the moment'
        );
        setBannerKey((k) => k + 1);
        load();
      } else {
        toast.error(data.detail || "Couldn't save the news banner");
      }
    } catch (e) {
      toast.error('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const expired = (i) => i.ends_on && i.ends_on < todayISO();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Megaphone className="h-5 w-5 text-green-600" />
          <span>News Banner</span>
        </CardTitle>
        <CardDescription>
          Rolls across the top of everyone's dashboard and on the login screen. Leave the finish
          date blank for something that runs until you switch it off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Live preview of what's currently saved */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[3px] text-green-700 font-extrabold mb-1.5">
            Showing now
          </p>
          <NewsBanner key={bannerKey} />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-4">Loading&hellip;</p>
        ) : (
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-gray-500 py-3">
                No messages yet. Add one and press Save.
              </p>
            )}
            {items.map((it, i) => (
              <div
                key={it.id}
                className={`rounded-xl border p-3 ${expired(it) ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}
                data-testid={`news-row-${i}`}
              >
                <input
                  type="text"
                  value={it.text}
                  maxLength={300}
                  onChange={(e) => update(it.id, { text: e.target.value })}
                  placeholder="What do you want people to see?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <select
                    value={it.style}
                    onChange={(e) => update(it.id, { style: e.target.value })}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                    aria-label="Style"
                  >
                    {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>

                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    Finish
                    <input
                      type="date"
                      value={it.ends_on || ''}
                      onChange={(e) => update(it.id, { ends_on: e.target.value })}
                      className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={it.active}
                      onChange={(e) => update(it.id, { active: e.target.checked })}
                      className="w-4 h-4 accent-green-700"
                    />
                    Show
                  </label>

                  {expired(it) && (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      Finished &mdash; no longer showing
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(it.id)} className="text-red-600 hover:bg-red-50" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={() => setItems((r) => [...r, newItem()])}>
            <Plus className="h-4 w-4 mr-2" />Add message
          </Button>
          <Button onClick={save} disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">
            {saving
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving&hellip;</>
              : <><Save className="h-4 w-4 mr-2" />Save &amp; publish</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
