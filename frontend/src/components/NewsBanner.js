import React, { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../lib/api';

/**
 * Rolling news ticker. Sits above the Dashboard heading, and on the login
 * screen. Renders nothing at all when there's no news, so it never leaves an
 * empty bar on the screen.
 *
 * Touch or hover holds it still so a message can be read.
 */

const SPEED_PX_PER_SEC = 62;

export default function NewsBanner({ className = '' }) {
  const [items, setItems] = useState([]);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef(null);
  const [anim, setAnim] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/news-banner`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      // A ticker is decoration — never let it break the page it sits on
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120000); // fresh news every 2 minutes
    return () => clearInterval(t);
  }, [load]);

  // Measure after render and pace the roll to the length of the content
  useEffect(() => {
    if (!items.length) { setAnim(null); return; }
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      const half = el.scrollWidth / 2;
      if (!half) return;
      setAnim({ shift: -half, secs: Math.max(8, half / SPEED_PX_PER_SEC) });
    };
    const id = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', measure); };
  }, [items]);

  if (!items.length) return null;

  const run = items.map((it) => (
    <React.Fragment key={it.id}>
      <span className={`abn-item abn-${it.style || 'normal'}`}>
        {it.style === 'grow' ? <em>{it.text}</em> : it.text}
      </span>
      <span className="abn-item abn-sep">&#9670;</span>
    </React.Fragment>
  ));

  return (
    <div
      className={`abn ${paused ? 'abn-paused' : ''} ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      data-testid="news-banner"
    >
      <style>{ABN_CSS}</style>
      <div className="abn-label"><span className="abn-dot" />News</div>
      <div className="abn-view">
        <div
          ref={trackRef}
          className="abn-track"
          style={anim ? {
            animation: `abn-roll ${anim.secs.toFixed(1)}s linear infinite`,
            ['--abn-shift']: `${anim.shift}px`,
          } : undefined}
        >
          {run}
          {/* second copy so the loop joins with no gap */}
          {items.map((it) => (
            <React.Fragment key={`${it.id}-b`}>
              <span className={`abn-item abn-${it.style || 'normal'}`}>
                {it.style === 'grow' ? <em>{it.text}</em> : it.text}
              </span>
              <span className="abn-item abn-sep">&#9670;</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

const ABN_CSS = `
.abn{background:#1F1F1D;color:#fff;position:relative;overflow:hidden;display:flex;
  align-items:stretch;height:44px;border-radius:10px;border-top:3px solid #7DB82B;
  box-shadow:0 2px 10px rgba(31,31,29,.10)}
.abn-label{flex:none;display:flex;align-items:center;gap:7px;padding:0 13px;
  background:#7DB82B;color:#1F1F1D;font-weight:800;font-size:11px;letter-spacing:2px;
  text-transform:uppercase}
.abn-dot{width:8px;height:8px;border-radius:50%;background:#1F1F1D;animation:abn-pulse 1.4s infinite}
@keyframes abn-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}
.abn-view{position:relative;flex:1;overflow:hidden}
.abn-track{position:absolute;top:0;left:0;height:100%;display:flex;align-items:center;
  white-space:nowrap;will-change:transform}
.abn-paused .abn-track{animation-play-state:paused!important}
@keyframes abn-roll{from{transform:translateX(0)}to{transform:translateX(var(--abn-shift))}}
.abn-item{display:inline-flex;align-items:center;padding:0 26px;font-size:15px;font-weight:600}
.abn-sep{color:#7DB82B;opacity:.75;font-size:11px}
.abn-normal{color:#fff}
.abn-good{color:#9ED84F;font-weight:700}
.abn-flash{color:#ff6b5e;font-weight:800;animation:abn-flash 1s steps(1,end) infinite}
@keyframes abn-flash{0%,49%{opacity:1}50%,100%{opacity:.18}}
.abn-grow em{font-style:normal;display:inline-block;transform-origin:center;
  animation:abn-grow 1.8s ease-in-out infinite}
@keyframes abn-grow{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
.abn-celebrate{font-weight:800;background:linear-gradient(90deg,#ffd76e,#ffb200,#fff0b8,#ffb200);
  background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:abn-shine 3s linear infinite}
@keyframes abn-shine{to{background-position:300% 0}}
.abn-urgent{background:#c0392b;color:#fff;font-weight:800;border-radius:6px;padding:4px 12px;
  margin:0 14px;animation:abn-throb 1.3s ease-in-out infinite}
@keyframes abn-throb{0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,.7)}70%{box-shadow:0 0 0 11px rgba(192,57,43,0)}}
@media (prefers-reduced-motion:reduce){
  .abn-track{animation:none!important}
  .abn-flash,.abn-grow em,.abn-celebrate,.abn-urgent,.abn-dot{animation:none!important}
  .abn-celebrate{color:#ffc93c;-webkit-text-fill-color:#ffc93c}
  .abn-track{overflow-x:auto}
}
@media (max-width:480px){
  .abn{height:40px}
  .abn-item{font-size:13.5px;padding:0 18px}
  .abn-label{padding:0 9px;font-size:10px;letter-spacing:1px}
}
`;
