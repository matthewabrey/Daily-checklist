import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../lib/api';

const ESTATES = ['Wretham', 'Beard', 'Rackham Farms', 'Pickenham', 'Gooderham', 'Euston', 'Chandler', 'Blakeney'];
const ESTATE_CYCLE_DELAY = 15000; // 15 seconds per estate

// Embedded self-hosted cropping map with estate tabs and auto-cycling
export default function FieldMapBoard({ active, isPaused }) {
  const [estateIdx, setEstateIdx] = useState(0);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef(null);

  // Lazy-load the iframe only when the section first becomes visible
  useEffect(() => {
    if (active) setLoadedOnce(true);
  }, [active]);

  const switchEstateInIframe = (name) => {
    try {
      const win = iframeRef.current?.contentWindow;
      const sel = win?.document?.getElementById('est-sel');
      if (sel && typeof win.go === 'function') {
        sel.value = name;
        win.go('estate', name);
        return true;
      }
    } catch (e) {
      // fall through to src reload
    }
    return false;
  };

  // Apply estate whenever the selection changes
  useEffect(() => {
    if (!iframeReady) return;
    const name = ESTATES[estateIdx];
    if (!switchEstateInIframe(name) && iframeRef.current) {
      iframeRef.current.src = `${API_BASE_URL}/api/fieldmap?estate=${encodeURIComponent(name)}`;
    }
  }, [estateIdx, iframeReady]);

  // Auto-cycle estates while this section is showing and rotation isn't paused
  useEffect(() => {
    if (!active || isPaused) return;
    const t = setInterval(() => {
      setEstateIdx((prev) => (prev + 1) % ESTATES.length);
    }, ESTATE_CYCLE_DELAY);
    return () => clearInterval(t);
  }, [active, isPaused]);

  if (!loadedOnce) {
    return <div className="h-48" data-testid="field-map-placeholder" />;
  }

  return (
    <div data-testid="field-map-section">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {ESTATES.map((name, idx) => (
          <button
            key={name}
            onClick={() => setEstateIdx(idx)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              estateIdx === idx
                ? 'bg-green-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`estate-tab-${name.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {name}
          </button>
        ))}
        {!isPaused && (
          <span className="text-[10px] text-gray-400 ml-1">Cycling every 15s</span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        title="Cropping Field Map"
        src={`${API_BASE_URL}/api/fieldmap?estate=${encodeURIComponent(ESTATES[0])}`}
        onLoad={() => setIframeReady(true)}
        className="w-full rounded-lg border border-gray-200 bg-white"
        style={{ height: '70vh', minHeight: 420 }}
        data-testid="field-map-iframe"
      />
    </div>
  );
}
