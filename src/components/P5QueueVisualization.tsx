'use client';

import { useEffect, useRef } from 'react';

interface CustomerData {
  id: number;
  arrivalTime: number;
  serviceTime: number;
  startTime: number;
  endTime: number;
  windowId: number;
  waitTime: number;
}

interface SimResult {
  customers: CustomerData[];
  windows: { id: number; totalServed: number }[];
  statistics: {
    totalSimulationTime: number;
    avgWaitTime: number;
    totalCustomers: number;
  };
}

export interface P5QueueVisualizationProps {
  simulationResult: SimResult;
  isPlaying: boolean;
  speed: number;
  currentTime: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onTimeChange: (time: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  r: number;
  col: [number, number, number];
}

export default function P5QueueVisualization({
  simulationResult,
  isPlaying,
  speed,
  currentTime,
  onPlayPause,
  onSpeedChange,
  onTimeChange,
}: P5QueueVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(currentTime);
  const simRef = useRef(simulationResult);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const onTimeChangeRef = useRef(onTimeChange);
  const onPlayPauseRef = useRef(onPlayPause);
  const lastRealTimeRef = useRef<number>(0);

  // keep refs in sync
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { simRef.current = simulationResult; }, [simulationResult]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onTimeChangeRef.current = onTimeChange; }, [onTimeChange]);
  useEffect(() => { onPlayPauseRef.current = onPlayPause; }, [onPlayPause]);

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p5Instance: any = null;

    import('p5').then((mod) => {
      const p5 = mod.default;
      const container = containerRef.current!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sketch = (p: any) => {
        const W = 900;
        const H = 500;
        const WIN_COUNT = 4;
        const WIN_W = 90;
        const WIN_H = 100;
        const SPACING = (W - WIN_COUNT * WIN_W) / (WIN_COUNT + 1);
        const WIN_Y = H - WIN_H - 50;

        // particles for completed customers
        const particles: Particle[] = [];
        // pulse rings per window
        const pulses: { x: number; y: number; r: number; alpha: number }[] = [];
        // trail dots for arriving customers (flying animation)
        const flyingCustomers: {
          id: number;
          x: number; y: number;
          tx: number; ty: number;
          progress: number;
          col: [number, number, number];
        }[] = [];
        const seenArrived = new Set<number>();
        const seenCompleted = new Set<number>();

        const winX = (i: number) => SPACING + i * (WIN_W + SPACING) + WIN_W / 2;
        const winY = () => WIN_Y + WIN_H / 2;

        p.setup = () => {
          p.createCanvas(W, H);
          p.frameRate(60);
          p.colorMode(p.RGB, 255, 255, 255, 1);
          p.textFont('sans-serif');
        };

        p.draw = () => {
          // advance simulation time
          if (isPlayingRef.current) {
            const now = performance.now();
            if (lastRealTimeRef.current === 0) lastRealTimeRef.current = now;
            const delta = now - lastRealTimeRef.current;
            lastRealTimeRef.current = now;
            const total = simRef.current.statistics.totalSimulationTime;
            const next = currentTimeRef.current + (delta * speedRef.current) / 1000;
            if (next >= total) {
              onTimeChangeRef.current(total);
              onPlayPauseRef.current();
            } else {
              onTimeChangeRef.current(next);
            }
          } else {
            lastRealTimeRef.current = 0;
          }

          const t = currentTimeRef.current;
          const sim = simRef.current;

          // detect newly arriving customers → spawn flying dot
          sim.customers.forEach(c => {
            if (c.arrivalTime <= t && !seenArrived.has(c.id)) {
              seenArrived.add(c.id);
              const wx = winX(c.windowId - 1);
              const wy = WIN_Y - 20;
              flyingCustomers.push({
                id: c.id,
                x: p.random(50, W - 50),
                y: H + 20,
                tx: wx,
                ty: wy,
                progress: 0,
                col: [99, 102, 241],
              });
            }
          });

          // detect newly completed → burst particles
          sim.customers.forEach(c => {
            if (c.endTime <= t && !seenCompleted.has(c.id)) {
              seenCompleted.add(c.id);
              const wx = winX(c.windowId - 1);
              const wy = winY();
              for (let i = 0; i < 18; i++) {
                const angle = p.random(p.TWO_PI);
                const spd = p.random(1.5, 4);
                particles.push({
                  x: wx, y: wy,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  alpha: 1,
                  r: p.random(4, 8),
                  col: [16, 185, 129],
                });
              }
              pulses.push({ x: wx, y: wy, r: 20, alpha: 0.8 });
            }
          });

          // ── background ──
          p.background(248, 250, 252);

          // ── grid lines ──
          p.stroke(226, 232, 240);
          p.strokeWeight(1);
          for (let gx = 0; gx < W; gx += 60) {
            p.line(gx, 0, gx, H);
          }

          // ── progress bar ──
          const total = sim.statistics.totalSimulationTime;
          const progress = total > 0 ? t / total : 0;
          p.noStroke();
          p.fill(226, 232, 240);
          p.rect(20, 15, W - 40, 8, 4);
          if (progress > 0) {
            p.drawingContext.save();
            const pg = ((p.drawingContext as unknown as CanvasRenderingContext2D)).createLinearGradient(20, 0, 20 + (W - 40) * progress, 0);
            pg.addColorStop(0, '#6366f1');
            pg.addColorStop(1, '#8b5cf6');
            ((p.drawingContext as unknown as CanvasRenderingContext2D)).fillStyle = pg;
            p.rect(20, 15, (W - 40) * progress, 8, 4);
            p.drawingContext.restore();
          }

          // time label
          const hour = Math.floor((t + 540) / 60);
          const min = Math.floor((t + 540) % 60);
          p.noStroke(); p.fill(30, 41, 59);
          p.textSize(13); p.textAlign(p.LEFT, p.TOP);
          p.text(`时间: ${hour}:${String(min).padStart(2, '0')}`, 20, 30);
          const active = sim.customers.filter(c => c.arrivalTime <= t && c.endTime > t).length;
          const done = sim.customers.filter(c => c.endTime <= t).length;
          p.textAlign(p.RIGHT, p.TOP);
          p.text(`在场: ${active}人  已完成: ${done}人`, W - 20, 30);

          // ── pulse rings ──
          for (let i = pulses.length - 1; i >= 0; i--) {
            const pu = pulses[i];
            p.noFill();
            p.stroke(16, 185, 129, pu.alpha);
            p.strokeWeight(2);
            p.circle(pu.x, pu.y, pu.r * 2);
            pu.r += 2.5;
            pu.alpha -= 0.025;
            if (pu.alpha <= 0) pulses.splice(i, 1);
          }

          // ── burst particles ──
          for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            p.noStroke();
            p.fill(pt.col[0], pt.col[1], pt.col[2], pt.alpha);
            p.circle(pt.x, pt.y, pt.r * 2);
            pt.x += pt.vx; pt.y += pt.vy;
            pt.vy += 0.08;
            pt.alpha -= 0.022;
            pt.r *= 0.97;
            if (pt.alpha <= 0) particles.splice(i, 1);
          }

          // ── flying customers ──
          for (let i = flyingCustomers.length - 1; i >= 0; i--) {
            const fc = flyingCustomers[i];
            fc.progress = Math.min(1, fc.progress + 0.04);
            const ease = 1 - Math.pow(1 - fc.progress, 3);
            fc.x = p.lerp(fc.x, fc.tx, ease * 0.12);
            fc.y = p.lerp(fc.y, fc.ty, ease * 0.12);
            // trail
            p.noStroke();
            p.fill(fc.col[0], fc.col[1], fc.col[2], 0.25);
            p.circle(fc.x, fc.y, 12);
            p.fill(fc.col[0], fc.col[1], fc.col[2], 0.8);
            p.circle(fc.x, fc.y, 8);
            if (fc.progress >= 1) flyingCustomers.splice(i, 1);
          }

          // ── windows ──
          for (let wi = 0; wi < WIN_COUNT; wi++) {
            const wx = SPACING + wi * (WIN_W + SPACING);
            const cx = wx + WIN_W / 2;
            const serving = sim.customers.find(
              c => c.windowId === wi + 1 && c.startTime <= t && c.endTime > t
            );
            const queue = sim.customers
              .filter(c => c.windowId === wi + 1 && c.arrivalTime <= t && c.startTime > t)
              .sort((a, b) => a.arrivalTime - b.arrivalTime);

            // window box gradient
            p.drawingContext.save();
            const wg = ((p.drawingContext as unknown as CanvasRenderingContext2D)).createLinearGradient(wx, WIN_Y, wx, WIN_Y + WIN_H);
            if (serving) {
              wg.addColorStop(0, '#6366f1');
              wg.addColorStop(1, '#4f46e5');
            } else {
              wg.addColorStop(0, '#94a3b8');
              wg.addColorStop(1, '#64748b');
            }
            ((p.drawingContext as unknown as CanvasRenderingContext2D)).fillStyle = wg;
            p.noStroke();
            p.rect(wx, WIN_Y, WIN_W, WIN_H, 12);
            p.drawingContext.restore();

            // window label
            p.fill(255); p.noStroke();
            p.textSize(13); p.textAlign(p.CENTER, p.CENTER);
            p.text(`窗口${wi + 1}`, cx, WIN_Y + 20);

            // serving customer — pulsing circle
            if (serving) {
              const pulse = 0.8 + 0.2 * Math.sin(p.frameCount * 0.12);
              p.noStroke();
              p.fill(16, 185, 129, 0.3);
              p.circle(cx, WIN_Y + 65, 36 * pulse);
              p.fill(16, 185, 129);
              p.circle(cx, WIN_Y + 65, 26);
              // highlight
              p.fill(255, 255, 255, 0.35);
              p.circle(cx - 5, WIN_Y + 58, 8);
              p.fill(255); p.textSize(9);
              p.text(`#${serving.id}`, cx, WIN_Y + 65);
            } else {
              p.fill(203, 213, 225); p.textSize(12);
              p.text('空闲', cx, WIN_Y + 65);
            }

            // queue above window (upward)
            queue.slice(0, 8).forEach((c, qi) => {
              const qy = WIN_Y - 15 - qi * 20;
              // flow color: amber with shimmer
              const shimmer = 0.6 + 0.4 * Math.sin(p.frameCount * 0.1 + qi * 0.8);
              p.noStroke();
              p.fill(245, 158, 11, shimmer);
              p.circle(cx, qy, 18);
              p.fill(255, 255, 255, 0.3);
              p.circle(cx - 3, qy - 3, 5);
              p.fill(30, 41, 59); p.textSize(8);
              p.text(`${c.id}`, cx, qy);
            });
            if (queue.length > 8) {
              p.fill(100, 116, 139); p.textSize(10);
              p.text(`+${queue.length - 8}`, cx, WIN_Y - 15 - 8 * 20 - 10);
            }
          }
        }; // end draw
      }; // end sketch

      p5Instance = new p5(sketch, container);
    });

    return () => {
      p5Instance?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationResult]); // re-mount only when result changes

  // total simulation time for slider
  const total = simulationResult.statistics.totalSimulationTime;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold text-gray-700">队列动态可视化</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            速度: {speed}x
          </span>
          <input
            type="range" min="0.5" max="5" step="0.5"
            value={speed}
            onChange={e => onSpeedChange(parseFloat(e.target.value))}
            className="w-24"
          />
          <button
            onClick={onPlayPause}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-600 text-sm"
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button
            onClick={() => onTimeChange(0)}
            disabled={currentTime === 0}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm disabled:opacity-40"
          >
            ↺ 重置
          </button>
        </div>
      </div>

      {/* p5 canvas mount point */}
      <div ref={containerRef} className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg" />

      {/* scrubber */}
      <input
        type="range" min="0" max={total} step="0.1"
        value={currentTime}
        onChange={e => onTimeChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>0 min</span>
        <span>{total.toFixed(1)} min</span>
      </div>
    </div>
  );
}
