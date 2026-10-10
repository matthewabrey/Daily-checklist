import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../lib/api';

// The birthday page. Shown full-screen the first time the person opens the
// app on their birthday, then marked as seen so it cannot come back at them
// later the same day.
//
// Renders nothing at all on any other day, for anybody — the fetch is one
// small call and the component disappears unless the server says show.
//
// No age and no date anywhere: the app only stores the day and the month.

const PALETTE = ['#7DB82B', '#5D8F1C', '#A5CE8C', '#F2C14E', '#E8743B', '#FFFFFF'];

export default function BirthdayTakeover({ employee }) {
  const [info, setInfo] = useState(null);
  const [closing, setClosing] = useState(false);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const number = employee?.employee_number;

  useEffect(() => {
    if (!number) return;
    let stop = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/birthdays/mine/${encodeURIComponent(number)}`);
        if (!r.ok || stop) return;
        const d = await r.json();
        if (d && d.show) setInfo(d);
      } catch (e) { /* a quiet failure here is better than a broken app */ }
    })();
    return () => { stop = true; };
  }, [number]);

  // confetti — plain canvas, nothing fetched from anywhere
  const run = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const x = c.getContext('2d');
    const W = c.width = c.offsetWidth;
    const H = c.height = c.offsetHeight;
    const bits = [];
    for (let i = 0; i < 130; i++) {
      bits.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.7,
        w: 5 + Math.random() * 7, h: 8 + Math.random() * 10,
        vy: 1.1 + Math.random() * 2.3, vx: (Math.random() - 0.5) * 1.2,
        a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.18,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
      });
    }
    const tick = () => {
      x.clearRect(0, 0, W, H);
      let live = 0;
      bits.forEach((b) => {
        b.y += b.vy;
        b.x += b.vx + Math.sin(b.y / 34) * 0.5;
        b.a += b.va;
        if (b.y < H + 30) live++;
        x.save();
        x.translate(b.x, b.y);
        x.rotate(b.a);
        x.fillStyle = b.c;
        x.globalAlpha = 0.92;
        x.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        x.restore();
      });
      if (live) rafRef.current = requestAnimationFrame(tick);
      else x.clearRect(0, 0, W, H);
    };
    cancelAnimationFrame(rafRef.current);
    tick();
  }, []);

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(run, 120);
    return () => { clearTimeout(t); cancelAnimationFrame(rafRef.current); };
  }, [info, run]);

  const close = async () => {
    setClosing(true);
    // Tell the server before the page goes, so a refresh can't bring it back.
    try {
      await fetch(`${API_BASE_URL}/api/birthdays/seen/${encodeURIComponent(number)}`,
        { method: 'POST' });
    } catch (e) { /* worst case they see it once more */ }
    setTimeout(() => setInfo(null), 260);
  };

  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 text-center"
      style={{
        background: 'radial-gradient(120% 90% at 50% -10%, #FFFFFF 0%, #E8F2D5 45%, #D6E9B4 100%)',
        opacity: closing ? 0 : 1,
        transition: 'opacity .26s ease',
      }}
      data-testid="birthday-takeover"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center birthday-pop">
        <img
          src="/abreys-logo.png"
          alt="Abreys"
          className="h-14 w-auto rounded-xl bg-white p-1 shadow-lg mb-5"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />

        <div className="text-5xl mb-1 birthday-bob" aria-hidden="true">🎂</div>

        <p className="text-sm font-bold uppercase tracking-[0.18em]"
           style={{ color: '#5D8F1C', fontFamily: 'Georgia, serif' }}>
          Happy Birthday
        </p>

        <h1 className="text-4xl sm:text-5xl leading-tight mt-1 mb-3"
            style={{ fontFamily: 'Georgia, serif', color: '#1F1F1D' }}>
          {info.first_name}
        </h1>

        <p className="text-base" style={{ color: '#2A2A27' }}>
          From everyone at <b>Abrey Farms</b>
        </p>

        <p className="text-sm mt-3 max-w-xs leading-relaxed" style={{ color: '#6B6B66' }}>
          Thanks for everything you do here. Have a good one.
        </p>

        {info.sharing_line && (
          <div className="mt-4 bg-white rounded-xl px-4 py-2.5 shadow-sm max-w-xs text-xs"
               style={{ color: '#2A2A27' }}>
            {info.sharing_line}
          </div>
        )}

        <button
          onClick={close}
          className="mt-7 text-white font-bold rounded-xl px-7 py-3 text-base shadow-lg"
          style={{ background: '#5D8F1C' }}
          data-testid="birthday-dismiss"
        >
          Thanks &mdash; on with the day
        </button>

        <p className="mt-3 text-[11px]" style={{ color: '#7E8A6A' }}>
          You&rsquo;ll only see this once today
        </p>
      </div>

      <style>{`
        @keyframes birthdayPop {
          from { transform: scale(.82); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
        @keyframes birthdayBob {
          0%,100% { transform: translateY(0) rotate(-3deg) }
          50%     { transform: translateY(-7px) rotate(3deg) }
        }
        .birthday-pop { animation: birthdayPop .55s cubic-bezier(.2,1.5,.4,1) both }
        .birthday-bob { animation: birthdayBob 2.6s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .birthday-pop, .birthday-bob { animation: none }
        }
      `}</style>
    </div>
  );
}
