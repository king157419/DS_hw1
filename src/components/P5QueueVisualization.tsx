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
  x: number; y: number;
  vx: number; vy: number;
  alpha: number; r: number;
  col: [number, number, number];
}

interface FlyingDot {
  id: number;
  x: number; y: number;
  tx: number; ty: number;
  cx1: number; cy1: number;
  progress: number;
  col: [number, number, number];
  trail: { x: number; y: number; a: number }[];
}

interface PulseRing {
  x: number; y: number;
  r: number; maxR: number;
  alpha: number;
  col: [number, number, number];
}

interface LeavingDot {
  id: number;
  x: number; y: number;
  tx: number; ty: number;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  progress: number;
  trail: { x: number; y: number; a: number }[];
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
  const p5Ref = useRef<any>(null);
  const currentTimeRef = useRef(currentTime);
  const simRef = useRef(simulationResult);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const onTimeChangeRef = useRef(onTimeChange);
  const onPlayPauseRef = useRef(onPlayPause);
  const lastRealTimeRef = useRef<number>(0);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { simRef.current = simulationResult; }, [simulationResult]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onTimeChangeRef.current = onTimeChange; }, [onTimeChange]);
  useEffect(() => { onPlayPauseRef.current = onPlayPause; }, [onPlayPause]);

  // 处理 Reset (currentTime = 0)
  useEffect(() => {
    if (currentTime === 0) {
      currentTimeRef.current = 0;
    }
  }, [currentTime]);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    // 核心优化：确保实例仅在挂载时创建一次
    if (p5Ref.current) return;

    import('p5').then((mod) => {
      if (!mounted || !containerRef.current) return;
      const p5 = mod.default;
      const container = containerRef.current;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sketch = (p: any) => {
        const W = 900;
        const H = 560;
        let lastStateSync = 0;
        let lastInternalTime = -1;

        // Layout computed from window count
        let WIN_COUNT = simRef.current.windows.length || 4;
        let WIN_W = Math.min(130, Math.floor((W - 80) / WIN_COUNT) - 20);
        const WIN_H = 130;
        let SPACING = (W - WIN_COUNT * WIN_W) / (WIN_COUNT + 1);
        const WIN_Y = 120;
        const ENTRANCE_X = W * 0.3; // 左侧入口
        const EXIT_X = W * 0.7;     // 右侧出口
        const ENTRANCE_Y = H - 45;

        const particles: Particle[] = [];
        const pulses: PulseRing[] = [];
        const flyingDots: FlyingDot[] = [];
        const leavingDots: LeavingDot[] = [];
        const entranceRipples: { r: number; alpha: number }[] = [];
        const seenArrived = new Set<number>();
        const seenCompleted = new Set<number>();
        const seenServiceStart = new Set<number>();
        const seenLeaving = new Set<number>();
        const MAX_PARTICLES = 80;

        const winX = (i: number) => SPACING + i * (WIN_W + SPACING) + WIN_W / 2;
        const winTop = () => WIN_Y;

        // Wait time → color: green (0 min) → yellow (5 min) → red (10+ min)
        function waitCol(wt: number): [number, number, number] {
          const t = Math.min(1, wt / 10);
          if (t < 0.5) {
            return [Math.round(34 + t * 2 * (234 - 34)), Math.round(197 - t * 2 * (197 - 179)), Math.round(94 + t * 2 * (8 - 94))];
          }
          const s = (t - 0.5) * 2;
          return [Math.round(234 + s * (239 - 234)), Math.round(179 - s * (179 - 68)), Math.round(8 + s * (68 - 8))];
        }

        // Cubic bezier point
        function bezier(t: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): [number, number] {
          const u = 1 - t;
          const b0 = u * u * u;
          const b1 = 3 * u * u * t;
          const b2 = 3 * u * t * t;
          const b3 = t * t * t;
          return [b0 * x0 + b1 * x1 + b2 * x2 + b3 * x3, b0 * y0 + b1 * y1 + b2 * y2 + b3 * y3];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bgBuffer: any = null;

        p.setup = () => {
          p.createCanvas(W, H);
          p.frameRate(24);
          p.colorMode(p.RGB, 255, 255, 255, 1);
          p.textFont('sans-serif');

          // Pre-render static background into offscreen buffer
          bgBuffer = p.createGraphics(W, H);
          bgBuffer.background(18, 22, 36);
          // marble floor tiles
          bgBuffer.noStroke();
          for (let row = 0; row < 4; row++) {
            for (let col2 = 0; col2 < 6; col2++) {
              const tx2 = col2 * 150;
              const ty2 = WIN_Y + WIN_H + 10 + row * 30;
              const shade = 28 + (row + col2) % 2 * 6;
              bgBuffer.fill(shade, shade + 2, shade + 8, 0.8);
              bgBuffer.rect(tx2, ty2, 149, 29);
            }
          }
          // grid lines
          bgBuffer.stroke(40, 48, 72, 0.4);
          bgBuffer.strokeWeight(1);
          for (let gx = 0; gx < W; gx += 80) bgBuffer.line(gx, 0, gx, WIN_Y);
          for (let gy = 40; gy < WIN_Y; gy += 60) bgBuffer.line(0, gy, W, gy);
          bgBuffer.noStroke();
        };

        p.draw = () => {
          // --- detect layout change ---
          const currentWinCount = simRef.current.windows.length;
          if (currentWinCount !== WIN_COUNT) {
            WIN_COUNT = currentWinCount;
            WIN_W = Math.min(130, Math.floor((W - 80) / WIN_COUNT) - 20);
            SPACING = (W - WIN_COUNT * WIN_W) / (WIN_COUNT + 1);
            initBg();
          }

          // --- advance sim time ---
          if (isPlayingRef.current) {
            const now = performance.now();
            if (lastRealTimeRef.current === 0) lastRealTimeRef.current = now;
            const delta = now - lastRealTimeRef.current;
            lastRealTimeRef.current = now;
            const total = simRef.current.statistics.totalSimulationTime;
            const next = currentTimeRef.current + (delta * speedRef.current) / 1000;

            currentTimeRef.current = Math.min(next, total);

            // 优化：降低 React 同步频率，每 200ms 或结束时同步一次
            if (next >= total || now - lastStateSync > 200) {
              onTimeChangeRef.current(currentTimeRef.current);
              lastStateSync = now;
              if (next >= total) onPlayPauseRef.current();
            }
          } else {
            lastRealTimeRef.current = 0;
          }

          const t = currentTimeRef.current;

          // 核心优化：如果进度被大幅重置（回退），清空所有内部 Set 和动画对象
          // 增加阈值到 1.0 以防止 React 状态滞后导致的微小抖动误触发重置
          if (t < lastInternalTime - 1.0) {
            seenArrived.clear();
            seenCompleted.clear();
            seenServiceStart.clear();
            seenLeaving.clear();
            flyingDots.length = 0;
            leavingDots.length = 0;
            particles.length = 0;
          }
          lastInternalTime = t;

          const sim = simRef.current;
          const total = sim.statistics.totalSimulationTime;

          p.background(18, 22, 36); // 显式清理背景

          // --- detect events ---
          sim.customers.forEach(c => {
            if (c.arrivalTime <= t && !seenArrived.has(c.id)) {
              seenArrived.add(c.id);
              const wi = c.windowId - 1;
              const tx = winX(wi) - WIN_W * 0.25; // 飞向窗口左侧排队区
              const ty = WIN_Y + WIN_H + 35;
              // control points for S-curve bezier
              const cx1 = ENTRANCE_X + (tx - ENTRANCE_X) * 0.1;
              const cy1 = ENTRANCE_Y - 150;
              flyingDots.push({
                id: c.id, x: ENTRANCE_X, y: ENTRANCE_Y,
                tx, ty, cx1, cy1,
                progress: 0,
                col: waitCol(c.waitTime),
                trail: [],
              });
              // entrance ripple
              entranceRipples.push({ r: 8, alpha: 0.8 });
            }
          });

          sim.customers.forEach(c => {
            if (c.startTime <= t && !seenServiceStart.has(c.id)) {
              seenServiceStart.add(c.id);
              const wi = c.windowId - 1;
              pulses.push({ x: winX(wi), y: WIN_Y + WIN_H / 2, r: 15, maxR: 55, alpha: 0.9, col: [99, 102, 241] });
            }
          });

          sim.customers.forEach(c => {
            if (c.endTime <= t && !seenCompleted.has(c.id)) {
              seenCompleted.add(c.id);
              const wx = winX(c.windowId - 1);
              const wy = WIN_Y + WIN_H / 2;
              // 粒子爆炸（限制总数）
              if (particles.length < MAX_PARTICLES) {
                for (let i = 0; i < Math.min(12, MAX_PARTICLES - particles.length); i++) {
                  const angle = p.random(p.TWO_PI);
                  const spd = p.random(1.5, 3.5);
                  particles.push({
                    x: wx, y: wy,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd - 1,
                    alpha: 1, r: p.random(3, 7),
                    col: i % 2 === 0 ? [251, 191, 36] : [16, 185, 129],
                  });
                }
              }
              pulses.push({ x: wx, y: wy, r: 20, maxR: 70, alpha: 0.7, col: [16, 185, 129] });
            }
            // 离开动画：从窗口飞向出口
            if (c.endTime <= t && !seenLeaving.has(c.id)) {
              seenLeaving.add(c.id);
              const wi = c.windowId - 1;
              const lx = winX(wi) + WIN_W * 0.25; // 从窗口右侧离开
              const ly = WIN_Y + WIN_H - 10;
              const ex = EXIT_X + p.random(-20, 20); // 向右侧出口汇聚
              const ey = ENTRANCE_Y;
              leavingDots.push({
                id: c.id,
                x: lx, y: ly,
                tx: ex, ty: ey,
                cx1: lx + 50, cy1: ly + 80, // 向右甩出的弧度
                cx2: ex, cy2: ey - 80,
                progress: 0,
                trail: [],
              });
            }
          });

          // --- BACKGROUND: blit pre-rendered buffer ---
          p.image(bgBuffer, 0, 0);

          // 绘制门口标签
          p.noStroke();
          p.fill(34, 197, 94, 0.6); p.rect(ENTRANCE_X - 40, ENTRANCE_Y + 10, 80, 22, 6);
          p.fill(255); p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
          p.text("入 口", ENTRANCE_X, ENTRANCE_Y + 21);

          p.fill(251, 191, 36, 0.6); p.rect(EXIT_X - 40, ENTRANCE_Y + 10, 80, 22, 6);
          p.fill(255); p.text("出 口", EXIT_X, ENTRANCE_Y + 21);

          // --- TITLE BAR ---
          p.fill(24, 30, 52);
          p.rect(0, 0, W, 46);
          p.fill(148, 163, 240);
          p.textSize(15); p.textAlign(p.LEFT, p.CENTER);
          p.text('🏦  银行营业厅 · 实时模拟', 18, 23);
          // live clock
          const mins = Math.floor(t);
          const secs = Math.floor((t - mins) * 60);
          const clock = `T = ${mins}:${secs.toString().padStart(2, '0')} min`;
          p.textAlign(p.RIGHT, p.CENTER);
          p.fill(99, 102, 241); p.textSize(13);
          p.text(clock, W - 16, 23);

          // --- PROGRESS BAR ---
          const progress = total > 0 ? t / total : 0;
          p.fill(30, 38, 60);
          p.rect(0, 46, W, 6);
          p.fill(99, 102, 241);
          p.rect(0, 46, W * progress, 6);

          // --- ENTRANCE ---
          p.fill(99, 102, 241, 0.15);
          p.ellipse(ENTRANCE_X, ENTRANCE_Y + 5, 80, 18);
          p.fill(148, 163, 240, 0.9);
          p.textSize(11); p.textAlign(p.CENTER, p.CENTER);
          p.text('入 口', ENTRANCE_X, ENTRANCE_Y + 5);

          // entrance ripples
          for (let i = entranceRipples.length - 1; i >= 0; i--) {
            const rp = entranceRipples[i];
            p.noFill(); p.stroke(99, 102, 241, rp.alpha); p.strokeWeight(1.5);
            p.ellipse(ENTRANCE_X, ENTRANCE_Y, rp.r * 2.5, rp.r * 0.8);
            p.noStroke();
            rp.r += 2.5; rp.alpha -= 0.05;
            if (rp.alpha <= 0) entranceRipples.splice(i, 1);
          }
          p.noStroke();

          // --- PULSE RINGS ---
          for (let i = pulses.length - 1; i >= 0; i--) {
            const rng = pulses[i];
            p.noFill(); p.stroke(rng.col[0], rng.col[1], rng.col[2], rng.alpha); p.strokeWeight(2);
            p.circle(rng.x, rng.y, rng.r * 2);
            p.noStroke();
            rng.r += 2.5; rng.alpha -= 0.035;
            if (rng.r >= rng.maxR) pulses.splice(i, 1);
          }

          // --- PARTICLES ---
          for (let i = particles.length - 1; i >= 0; i--) {
            const pp = particles[i];
            p.fill(pp.col[0], pp.col[1], pp.col[2], pp.alpha);
            p.circle(pp.x, pp.y, pp.r * 2);
            pp.x += pp.vx; pp.y += pp.vy; pp.vy += 0.15;
            pp.alpha -= 0.03; pp.r *= 0.97;
            if (pp.alpha <= 0) particles.splice(i, 1);
          }

          // --- FLYING DOTS (bezier) ---
          for (let i = flyingDots.length - 1; i >= 0; i--) {
            const fd = flyingDots[i];
            fd.progress = Math.min(1, fd.progress + Math.min(0.025 * speedRef.current, 0.5));
            const [bx, by] = bezier(fd.progress,
              ENTRANCE_X, ENTRANCE_Y,
              fd.cx1, fd.cy1,
              fd.tx, fd.ty - 60,
              fd.tx, fd.ty);
            // trail
            fd.trail.push({ x: bx, y: by, a: 0.6 });
            if (fd.trail.length > 10) fd.trail.shift();
            fd.trail.forEach((tr, ti) => {
              const ta = tr.a * (ti / fd.trail.length);
              p.fill(fd.col[0], fd.col[1], fd.col[2], ta * 0.5);
              p.circle(tr.x, tr.y, 8);
            });
            // dot
            p.fill(fd.col[0], fd.col[1], fd.col[2]);
            p.circle(bx, by, 14);
            p.fill(255, 255, 255, 0.7); p.circle(bx - 2, by - 2, 4);
            if (fd.progress >= 1) flyingDots.splice(i, 1);
          }

          // --- LEAVING DOTS (gold bezier, window → exit) ---
          for (let i = leavingDots.length - 1; i >= 0; i--) {
            const ld = leavingDots[i];
            ld.progress = Math.min(1, ld.progress + 0.022);
            const u = ld.progress;
            const u1 = 1 - u;
            const lbx = u1*u1*u1*ld.x + 3*u1*u1*u*ld.cx1 + 3*u1*u*u*ld.cx2 + u*u*u*ld.tx;
            const lby = u1*u1*u1*ld.y + 3*u1*u1*u*ld.cy1 + 3*u1*u*u*ld.cy2 + u*u*u*ld.ty;
            // trail
            ld.trail.push({ x: lbx, y: lby, a: 0.5 });
            if (ld.trail.length > 5) ld.trail.shift();
            ld.trail.forEach((tr, ti) => {
              p.fill(251, 191, 36, tr.a * (ti / ld.trail.length) * 0.5);
              p.circle(tr.x, tr.y, 7);
            });
            // gold dot
            p.fill(251, 191, 36, 1 - u * 0.3);
            p.circle(lbx, lby, 12);
            p.fill(255, 240, 180, 0.8); p.circle(lbx - 2, lby - 2, 4);
            if (ld.progress >= 1) leavingDots.splice(i, 1);
          }

          // --- WINDOWS ---
          for (let wi = 0; wi < WIN_COUNT; wi++) {
            const cx = winX(wi);
            const wy = WIN_Y;
            const wx2 = cx - WIN_W / 2;

            // compute state at t
            const serving = sim.customers.find(
              c => c.windowId === wi + 1 && c.startTime <= t && c.endTime > t
            ) || null;
            const queue = sim.customers
              .filter(c => c.windowId === wi + 1 && c.arrivalTime <= t && c.startTime > t)
              .sort((a, b) => a.arrivalTime - b.arrivalTime);

            // window booth frame (wood-tone)
            p.fill(45, 36, 28);
            p.rect(wx2 - 4, wy - 4, WIN_W + 8, WIN_H + 8, 14);

            // window glass panel (gradient via raw canvas API)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dctx = p.drawingContext as unknown as CanvasRenderingContext2D;
            dctx.save();
            const wg = dctx.createLinearGradient(wx2, wy, wx2, wy + WIN_H);
            if (serving) {
              wg.addColorStop(0, '#312e81'); wg.addColorStop(1, '#1e1b4b');
            } else {
              wg.addColorStop(0, '#1e293b'); wg.addColorStop(1, '#0f172a');
            }
            dctx.fillStyle = wg;
            dctx.beginPath();
            dctx.roundRect(wx2, wy, WIN_W, WIN_H, 10);
            dctx.fill();
            dctx.restore();
            p.noStroke();

            // glass shine
            p.fill(255, 255, 255, 0.05);
            p.rect(wx2 + 4, wy + 4, WIN_W / 2 - 6, WIN_H - 8, 8);

            // window label
            p.fill(180, 190, 255); p.textSize(12); p.textAlign(p.CENTER, p.CENTER);
            p.text(`窗口 ${wi + 1}`, cx, wy + 18);

            // counter line
            p.fill(80, 90, 130, 0.6); p.rect(wx2 + 4, wy + WIN_H - 30, WIN_W - 8, 2, 1);

            // serving customer — pulsing glow
            if (serving) {
              const pulse = 0.75 + 0.25 * Math.sin(p.frameCount * 0.1);
              const [r, g, b] = waitCol(serving.waitTime);
              p.fill(r, g, b, 0.25); p.circle(cx, wy + 72, 52 * pulse);
              p.fill(r, g, b); p.circle(cx, wy + 72, 30);
              p.fill(255, 255, 255, 0.4); p.circle(cx - 5, wy + 65, 8);
              p.fill(255); p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
              p.text(`#${serving.id}`, cx, wy + 72);
              p.textSize(8); p.fill(180, 190, 255); p.text("服务中", cx, wy + 90);
              // wait time badge
              p.fill(99, 102, 241, 0.85); p.rect(cx - 20, wy + 87, 40, 14, 4);
              p.fill(200, 204, 255); p.textSize(8);
              p.text(`等${serving.waitTime.toFixed(1)}m`, cx, wy + 94);
            } else {
              p.fill(60, 70, 100, 0.5); p.circle(cx, wy + 72, 26);
              p.fill(100, 110, 150); p.textSize(10);
              p.text('空闲', cx, wy + 72);
            }

            // utilization mini-bar below booth
            const winData = sim.windows[wi];
            const servedAtT = sim.customers.filter(c => c.windowId === wi + 1 && c.endTime <= t).length;
            const util = winData ? Math.min(1, servedAtT / Math.max(1, sim.statistics.totalCustomers)) : 0;
            p.fill(30, 38, 60); p.rect(wx2, wy + WIN_H + 8, WIN_W, 6, 3);
            p.fill(serving ? 99 : 60, serving ? 102 : 80, serving ? 241 : 140);
            p.rect(wx2, wy + WIN_H + 8, WIN_W * util, 6, 3);
            p.fill(120, 130, 180); p.textSize(9); p.textAlign(p.CENTER, p.TOP);
            p.text(`已服务 ${servedAtT}`, cx, wy + WIN_H + 18);

            // queue: 纵向方块，带编号和等待时间 (重构为靠左排列)
            const BLOCK_H = 18;
            const BLOCK_W = Math.floor(WIN_W * 0.48);
            const qx = cx - WIN_W * 0.25; // 靠左中轴线
            const QUEUE_START_Y = wy + WIN_H + 35;
            const maxShow = Math.floor((H - QUEUE_START_Y - 20) / (BLOCK_H + 3));

            queue.slice(0, maxShow).forEach((c, qi) => {
              const qy = QUEUE_START_Y + qi * (BLOCK_H + 3);
              const waitAtT = Math.max(0, t - c.arrivalTime);
              const [r, g, b] = waitCol(waitAtT);
              // 方块背景
              p.fill(r, g, b, 0.85);
              p.rect(qx - BLOCK_W/2, qy - BLOCK_H/2, BLOCK_W, BLOCK_H, 4);
              // 内部文字（精简）
              p.fill(255, 255, 255, 0.95); p.textSize(7); p.textAlign(p.CENTER, p.CENTER);
              p.text(`${qi+1}`, qx - BLOCK_W/2 + 7, qy);
              p.textAlign(p.RIGHT, p.CENTER);
              p.text(`${waitAtT.toFixed(0)}m`, qx + BLOCK_W/2 - 3, qy);
            });
            if (queue.length > maxShow) {
              p.fill(148, 163, 240, 0.9); p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
              const textY = QUEUE_START_Y + maxShow * (BLOCK_H + 3) + 10;
              p.text(`+${queue.length - maxShow}`, qx, textY);
            }
            // 队列人数徽章
            if (queue.length > 0) {
              p.fill(251, 191, 36); p.noStroke();
              p.circle(cx + WIN_W/2 - 8, WIN_Y - 4, 18);
              p.fill(20, 20, 30); p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
              p.text(`${queue.length}`, cx + WIN_W/2 - 8, WIN_Y - 4);
              p.fill(251, 191, 36); p.textAlign(p.LEFT, p.CENTER); p.textSize(10);
              p.text("排队", cx + WIN_W/2 + 2, WIN_Y - 4);
            }
          } // end for windows

          // --- HUD (top-right stats) ---
          const completed = sim.customers.filter(c => c.endTime <= t).length;
          const waiting = sim.customers.filter(c => c.arrivalTime <= t && c.startTime > t).length;
          const serving2 = sim.customers.filter(c => c.startTime <= t && c.endTime > t).length;

          const hudX = W - 180;
          const hudY = 56;
          p.fill(18, 24, 48, 0.88); p.rect(hudX, hudY, 172, 95, 10);
          p.fill(148, 163, 240); p.textSize(11); p.textAlign(p.LEFT, p.TOP);

          // 墙上时间 (假设 09:00 开门)
          const h = Math.floor(9 + t / 60);
          const m = Math.floor(t % 60);
          const wallTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          p.fill(255, 255, 255, 0.9);
          p.text(`当前时刻: ${wallTime}`, hudX + 10, hudY + 82);

          const completedList = sim.customers.filter(c => c.endTime <= t);
          const avgWaitNow = completedList.length > 0
            ? completedList.reduce((sum, c) => sum + (c.startTime - c.arrivalTime), 0) / completedList.length
            : 0;

          const hudRows: [string, string, number[]][] = [
            ['已完成', `${completed}`, [156, 163, 175]],
            ['服务中', `${serving2}`, [99, 102, 241]],
            ['等待中', `${waiting}`, waitCol(avgWaitNow)],
            ['总客户', `${sim.statistics.totalCustomers}`, [148, 163, 240]],
          ];
          hudRows.forEach(([label, val, col3], idx) => {
            const hx = hudX + 10;
            const hy = hudY + 10 + idx * 17;
            p.fill(col3[0], col3[1], col3[2]); p.circle(hx + 4, hy + 5, 8);
            p.fill(180, 190, 230); p.text(label, hx + 12, hy);
            p.fill(col3[0], col3[1], col3[2]); p.textAlign(p.RIGHT, p.TOP);
            p.text(val, hudX + 162, hy);
            p.textAlign(p.LEFT, p.TOP);
          });

          // --- COLOR LEGEND ---
          // 拆分为两个区块：等待色阶和状态
          p.fill(18, 24, 48, 0.8); p.rect(10, H - 75, 280, 60, 10);

          // 等待色阶
          p.fill(180, 190, 230); p.textSize(9); p.textAlign(p.LEFT, p.TOP);
          p.text("等待时长梯度", 18, H - 68);
          const waitItems: [string, [number,number,number]][] = [
            ['短', [34, 197, 94]],
            ['中', [234, 179, 8]],
            ['长', [239, 68, 68]],
          ];
          waitItems.forEach(([label, col4], idx) => {
            const lx = 85 + idx * 60;
            const ly = H - 68;
            p.fill(col4[0], col4[1], col4[2]); p.circle(lx + 6, ly + 5, 10);
            p.fill(180, 190, 230); p.text(label, lx + 14, ly + 5);
          });

          // 状态标识
          p.text("当前窗口状态", 18, H - 42);
          const statusItems: [string, [number,number,number]][] = [
            ['服务中', [99, 102, 241]],
            ['空闲', [156, 163, 175]],
          ];
          statusItems.forEach(([label, col4], idx) => {
            const lx = 85 + idx * 80;
            const ly = H - 42;
            p.fill(col4[0], col4[1], col4[2]); p.circle(lx + 6, ly + 5, 10);
            p.fill(180, 190, 230); p.text(label, lx + 14, ly + 5);
          });

        }; // end draw
      }; // end sketch

      p5Ref.current = new p5(sketch, container);
    });

    return () => {
      mounted = false;
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationResult]);

  const total = simulationResult.statistics.totalSimulationTime;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-600">播放速度:</span>
          <span className="text-sm font-bold text-indigo-600">{speed}x</span>
          <input
            type="range" min="0.5" max="10" step="0.5"
            value={speed}
            onChange={e => onSpeedChange(parseFloat(e.target.value))}
            className="w-28"
          />
        </div>
        <div className="flex items-center gap-2">
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

      <div ref={containerRef} className="rounded-2xl overflow-hidden border border-gray-700 shadow-2xl" />

      <input
        type="range" min="0" max={total} step="0.1"
        value={currentTime}
        onChange={e => onTimeChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>0 min</span>
        <span>{Math.floor(currentTime)}:{Math.floor((currentTime % 1) * 60).toString().padStart(2,'0')} / {total.toFixed(1)} min</span>
        <span>{total.toFixed(1)} min</span>
      </div>
    </div>
  );
}










