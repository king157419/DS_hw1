'use client';

import { useEffect, useRef, useState } from 'react';

interface SimStats {
  totalCustomers: number;
  avgWaitTime: number;
  totalSimulationTime: number;
}

interface WindowStat {
  id: number;
  totalServed: number;
  totalServiceTime: number;
  idleTime: number;
}

interface CustomerData {
  id: number;
  arrivalTime: number;
  waitTime: number;
  serviceTime: number;
  windowId: number;
  endTime: number;
}

export interface AlgorithmicArtProps {
  statistics: SimStats;
  windows: WindowStat[];
  customers: CustomerData[];
}

const WIN_COUNT = 4;
const PALETTE = [
  [217, 119, 87],   // anthropic orange
  [106, 155, 204],  // anthropic blue
  [120, 140, 93],   // anthropic green
  [176, 174, 165],  // anthropic gray
];

export default function AlgorithmicArt({ statistics, windows, customers }: AlgorithmicArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(() => Math.round(statistics.avgWaitTime * 1000) % 99999 || 12345);
  const seedRef = useRef(seed);

  useEffect(() => { seedRef.current = seed; }, [seed]);

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p5Instance: any = null;

    import('p5').then((mod) => {
      const p5 = mod.default;
      const container = containerRef.current!;
      const W = 800;
      const H = 800;

      // ── seeded PRNG (mulberry32) ──
      function makePRNG(s: number) {
        let state = s;
        return function () {
          state |= 0; state = state + 0x6D2B79F5 | 0;
          let t = Math.imul(state ^ state >>> 15, 1 | state);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }

      // ── Perlin-like noise (seeded) ──
      function makeNoise2D(rng: () => number) {
        const perm = Array.from({ length: 512 }, (_, i) => i % 256);
        for (let i = 255; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [perm[i], perm[j]] = [perm[j], perm[i]];
          perm[i + 256] = perm[i];
        }
        const grad = (h: number, x: number, y: number) => {
          const v = h & 3;
          return (v < 2 ? (v === 0 ? x : -x) : 0) + (v < 2 ? 0 : (v === 2 ? y : -y));
        };
        return function (x: number, y: number) {
          const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
          x -= Math.floor(x); y -= Math.floor(y);
          const u = x * x * x * (x * (x * 6 - 15) + 10);
          const v2 = y * y * y * (y * (y * 6 - 15) + 10);
          const a = perm[X] + Y, b = perm[X + 1] + Y;
          return 0.5 + 0.5 * (
            (1 - u) * ((1 - v2) * grad(perm[a], x, y) + v2 * grad(perm[a + 1], x, y - 1)) +
            u * ((1 - v2) * grad(perm[b], x - 1, y) + v2 * grad(perm[b + 1], x - 1, y - 1))
          );
        };
      }

      // ── build window centers ──
      const winCenters = Array.from({ length: WIN_COUNT }, (_, i) => ({
        x: (W / (WIN_COUNT + 1)) * (i + 1),
        y: H * 0.72,
        col: PALETTE[i % PALETTE.length],
        utilization: windows[i]
          ? Math.min(1, windows[i].totalServiceTime / Math.max(1, statistics.totalSimulationTime))
          : 0.5,
      }));

      // ── build particles from customer data ──
      const rng = makePRNG(seedRef.current);
      const noise = makeNoise2D(makePRNG(seedRef.current + 1));

      interface Particle {
        x: number; y: number;
        ox: number; oy: number; // origin (entry point)
        tx: number; ty: number; // target window center
        col: [number, number, number];
        alpha: number;
        speed: number;
        orbit: number;   // orbit radius (maps to waitTime)
        orbitAngle: number;
        phase: number;   // animation phase: 'orbit' | 'arrive' | 'done'
        phaseProgress: number;
        trailX: number[]; trailY: number[];
      }

      const particles: Particle[] = customers.slice(0, 120).map((c) => {
        const wi = Math.max(0, Math.min(WIN_COUNT - 1, c.windowId - 1));
        const wc = winCenters[wi];
        const orbitRadius = 18 + Math.min(c.waitTime, 20) * 4; // 18–98px
        return {
          x: wc.x + (rng() - 0.5) * 60,
          y: H * 0.05 + rng() * H * 0.15,
          ox: wc.x + (rng() - 0.5) * 60,
          oy: H * 0.05 + rng() * H * 0.15,
          tx: wc.x, ty: wc.y,
          col: wc.col as [number, number, number],
          alpha: 0.7 + rng() * 0.3,
          speed: 0.004 + rng() * 0.003,
          orbit: orbitRadius,
          orbitAngle: rng() * Math.PI * 2,
          phase: 0,       // 0=travel, 1=orbit, 2=arrive, 3=burst
          phaseProgress: rng(), // stagger start
          trailX: [], trailY: [],
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sketch = (p: any) => {
        p.setup = () => {
          p.createCanvas(W, H);
          p.frameRate(60);
          p.colorMode(p.RGB, 255, 255, 255, 255);
        };

        p.draw = () => {
          // fading background for trails
          p.fill(20, 20, 19, 18);
          p.noStroke();
          p.rect(0, 0, W, H);

          // ── flow field background lines ──
          if (p.frameCount % 3 === 0) {
            const fx = rng() * W;
            const fy = rng() * H;
            const angle = noise(fx * 0.004, fy * 0.004) * Math.PI * 4;
            const len = 18 + rng() * 20;
            p.stroke(176, 174, 165, 18);
            p.strokeWeight(0.5);
            p.line(fx, fy, fx + Math.cos(angle) * len, fy + Math.sin(angle) * len);
          }

          // ── window halos ──
          winCenters.forEach((wc) => {
            const pulseR = 30 + wc.utilization * 60;
            const pulse = 0.4 + 0.3 * Math.sin(p.frameCount * 0.04);
            p.noStroke();
            p.fill(wc.col[0], wc.col[1], wc.col[2], pulse * 60);
            p.circle(wc.x, wc.y, pulseR * 2);
            // inner
            p.fill(wc.col[0], wc.col[1], wc.col[2], 180);
            p.circle(wc.x, wc.y, 24);
            // label
            p.fill(250, 249, 245, 200);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(11);
            p.text(`窗口${wc.col === PALETTE[0] ? 1 : wc.col === PALETTE[1] ? 2 : wc.col === PALETTE[2] ? 3 : 4}`, wc.x, wc.y);
          });

          // ── particles ──
          particles.forEach((pt) => {
            pt.phaseProgress += pt.speed;

            if (pt.phase === 0) {
              // travel toward window center
              const dx = pt.tx - pt.x;
              const dy = pt.ty - pt.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < pt.orbit + 10) {
                pt.phase = 1;
                pt.phaseProgress = 0;
                pt.orbitAngle = Math.atan2(pt.y - pt.ty, pt.x - pt.tx);
              } else {
                pt.x += dx * 0.012;
                pt.y += dy * 0.012;
              }
            } else if (pt.phase === 1) {
              // orbit around window
              pt.orbitAngle += 0.018 + pt.speed * 0.5;
              pt.x = pt.tx + Math.cos(pt.orbitAngle) * pt.orbit;
              pt.y = pt.ty + Math.sin(pt.orbitAngle) * pt.orbit;
              if (pt.phaseProgress > 1.5) { pt.phase = 2; pt.phaseProgress = 0; }
            } else if (pt.phase === 2) {
              // spiral inward to window center
              pt.orbitAngle += 0.04;
              const r = pt.orbit * (1 - pt.phaseProgress * 0.6);
              pt.x = pt.tx + Math.cos(pt.orbitAngle) * Math.max(r, 2);
              pt.y = pt.ty + Math.sin(pt.orbitAngle) * Math.max(r, 2);
              if (pt.phaseProgress > 1.2) { pt.phase = 3; pt.phaseProgress = 0; }
            } else {
              // burst outward then reset
              pt.orbitAngle += 0.08;
              const br = pt.orbit * pt.phaseProgress * 0.5;
              pt.x = pt.tx + Math.cos(pt.orbitAngle) * br;
              pt.y = pt.ty + Math.sin(pt.orbitAngle) * br;
              if (pt.phaseProgress > 1.0) {
                pt.x = pt.ox; pt.y = pt.oy;
                pt.phase = 0; pt.phaseProgress = 0;
                pt.trailX = []; pt.trailY = [];
              }
            }

            // trail
            pt.trailX.push(pt.x); pt.trailY.push(pt.y);
            if (pt.trailX.length > 12) { pt.trailX.shift(); pt.trailY.shift(); }
            for (let ti = 0; ti < pt.trailX.length - 1; ti++) {
              const a = (ti / pt.trailX.length) * pt.alpha * 120;
              p.stroke(pt.col[0], pt.col[1], pt.col[2], a);
              p.strokeWeight(1);
              p.line(pt.trailX[ti], pt.trailY[ti], pt.trailX[ti + 1], pt.trailY[ti + 1]);
            }

            // dot
            p.noStroke();
            const dotA = pt.phase === 3 ? (1 - pt.phaseProgress) * pt.alpha * 255 : pt.alpha * 220;
            p.fill(pt.col[0], pt.col[1], pt.col[2], dotA);
            const dotR = pt.phase === 3 ? 6 * (1 - pt.phaseProgress * 0.7) : (pt.phase === 1 ? 5 : 4);
            p.circle(pt.x, pt.y, dotR * 2);
          });
        }; // end draw
      }; // end sketch

      p5Instance = new p5(sketch, container);
    });

    return () => { p5Instance?.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, statistics, windows, customers]);

  const resetSeed = () => setSeed(Math.floor(Math.random() * 99999) + 1);
  const prevSeed = () => setSeed(s => Math.max(1, s - 1));
  const nextSeed = () => setSeed(s => Math.min(99999, s + 1));

  return (
    <div style={{ display: 'flex', gap: 0, background: '#141413', borderRadius: 16, overflow: 'hidden', minHeight: 820 }}>
      {/* Anthropic-brand sidebar */}
      <div style={{
        width: 240, background: '#1c1c1b', padding: '24px 16px', display: 'flex',
        flexDirection: 'column', gap: 20, flexShrink: 0,
      }}>
        <div style={{ color: '#d97757', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>算法艺术</div>
        <div style={{ color: '#b0aea5', fontSize: 12, lineHeight: 1.6 }}>
          粒子根据排队等待时间映射轨道半径，流场由 Perlin 噪声驱动。
        </div>

        {/* seed nav */}
        <div>
          <div style={{ color: '#b0aea5', fontSize: 11, marginBottom: 8 }}>种子 Seed</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevSeed} style={btnStyle}>‹</button>
            <span style={{ color: '#faf9f5', fontFamily: 'monospace', fontSize: 13, flex: 1, textAlign: 'center' }}>{seed}</span>
            <button onClick={nextSeed} style={btnStyle}>›</button>
          </div>
          <button onClick={resetSeed} style={{ ...btnStyle, width: '100%', marginTop: 8 }}>随机种子</button>
        </div>

        {/* stats */}
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 16 }}>
          <div style={{ color: '#b0aea5', fontSize: 11, marginBottom: 10 }}>模拟参数</div>
          {[
            ['客户总数', statistics.totalCustomers],
            ['平均等待', `${statistics.avgWaitTime.toFixed(1)} min`],
            ['仿真时长', `${statistics.totalSimulationTime.toFixed(1)} min`],
          ].map(([label, val]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#6b6b68', fontSize: 11 }}>{label}</span>
              <span style={{ color: '#faf9f5', fontSize: 11 }}>{val}</span>
            </div>
          ))}
        </div>

        {/* window utilizations */}
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 16 }}>
          <div style={{ color: '#b0aea5', fontSize: 11, marginBottom: 10 }}>窗口利用率</div>
          {windows.slice(0, 4).map((w, i) => {
            const util = Math.min(1, w.totalServiceTime / Math.max(1, statistics.totalSimulationTime));
            const col = PALETTE[i % PALETTE.length];
            return (
              <div key={w.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#6b6b68', fontSize: 10 }}>窗口{i + 1}</span>
                  <span style={{ color: `rgb(${col[0]},${col[1]},${col[2]})`, fontSize: 10 }}>{(util * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 4, background: '#2a2a28', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${util * 100}%`, background: `rgb(${col[0]},${col[1]},${col[2]})`, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* canvas */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a28',
  border: '1px solid #3a3a38',
  color: '#faf9f5',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 13,
};