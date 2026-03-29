'use client';

import { useEffect, useRef } from 'react';

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

const PALETTE: [number, number, number][] = [
  [217, 119, 87],
  [106, 155, 204],
  [120, 140, 93],
  [176, 174, 165],
];

export default function AlgorithmicArt({ statistics, windows, customers }: AlgorithmicArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p5Instance: any = null;

    import('p5').then((mod) => {
      const p5 = mod.default;
      const container = containerRef.current!;
      const WIN_COUNT = windows.length;
      const W = 900;
      const H = 580;
      const WIN_W = 120;
      const WIN_H = 80;
      const SPACING = (W - WIN_COUNT * WIN_W) / (WIN_COUNT + 1);
      const WIN_Y = 290;
      const TITLE_H = 50;

      const winCX = (i: number) => SPACING + i * (WIN_W + SPACING) + WIN_W / 2;
      const winCY = WIN_Y + WIN_H / 2;

      const utilization = windows.slice(0, WIN_COUNT).map(w =>
        Math.min(1, w.totalServiceTime / Math.max(1, statistics.totalSimulationTime))
      );

      const byWindow: CustomerData[][] = Array.from({ length: WIN_COUNT }, () => []);
      customers.forEach(c => {
        const wi = Math.max(0, Math.min(WIN_COUNT - 1, c.windowId - 1));
        byWindow[wi].push(c);
      });

      function waitColor(waitTime: number): [number, number, number] {
        const t = Math.min(1, waitTime / 10);
        return [
          Math.round(100 + t * 120),
          Math.round(149 - t * 109),
          Math.round(237 - t * 177),
        ];
      }

      interface Particle {
        x: number; y: number;
        vx: number; vy: number;
        alpha: number;
        r: number;
        col: [number, number, number];
        delay: number;
      }
      const particles: Particle[] = [];
      customers.forEach((c, idx) => {
        const wi = Math.max(0, Math.min(WIN_COUNT - 1, c.windowId - 1));
        const cx = winCX(wi);
        const col = PALETTE[wi % PALETTE.length];
        const r = 3 + Math.min(c.serviceTime, 10) * 0.4;
        for (let k = 0; k < 4; k++) {
          const angle = (k / 4) * Math.PI * 2 + Math.random() * 0.5;
          const spd = 1.2 + Math.random() * 2;
          particles.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: winCY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 1.2,
            alpha: 0.85,
            r,
            col,
            delay: Math.floor(idx * 1.2) % 180,
          });
        }
      });

      const maxServed = Math.max(1, ...windows.slice(0, WIN_COUNT).map(w => w.totalServed));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sketch = (p: any) => {
        p.setup = () => {
          p.createCanvas(W, H);
          p.frameRate(60);
          p.textFont('sans-serif');
        };

        p.draw = () => {
          p.background(248, 250, 252);

          // ── title bar ──
          p.noStroke();
          p.fill(30, 41, 59);
          p.rect(0, 0, W, TITLE_H);
          p.fill(255);
          p.textSize(15); p.textAlign(p.LEFT, p.CENTER);
          p.text('🏦 银行排队模拟 · 4窗口', 20, TITLE_H / 2);
          p.textAlign(p.RIGHT, p.CENTER);
          p.textSize(13);
          p.fill(156, 163, 175);
          p.text(`平均等待: ${statistics.avgWaitTime.toFixed(1)} min  |  总客户: ${statistics.totalCustomers}  |  仿真时长: ${statistics.totalSimulationTime.toFixed(1)} min`, W - 16, TITLE_H / 2);

          // ── particle animation ──
          for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            if (pt.delay > 0) { pt.delay--; continue; }
            p.noStroke();
            p.fill(pt.col[0], pt.col[1], pt.col[2], pt.alpha * 255);
            p.circle(pt.x, pt.y, pt.r * 2);
            pt.x += pt.vx; pt.y += pt.vy;
            pt.vy += 0.04;
            pt.alpha -= 0.008;
            if (pt.alpha <= 0) {
              // reset particle
              const wi = Math.floor(Math.random() * WIN_COUNT);
              const angle = Math.random() * Math.PI * 2;
              const spd = 1.2 + Math.random() * 2;
              pt.x = winCX(wi) + (Math.random() - 0.5) * 20;
              pt.y = winCY;
              pt.vx = Math.cos(angle) * spd;
              pt.vy = Math.sin(angle) * spd - 1.2;
              pt.alpha = 0.85;
              pt.col = PALETTE[wi % PALETTE.length];
            }
          }

          // ── windows ──
          for (let wi = 0; wi < WIN_COUNT; wi++) {
            const cx = winCX(wi);
            const wx = cx - WIN_W / 2;
            const col = PALETTE[wi % PALETTE.length];
            const util = utilization[wi] ?? 0;
            const glow = util * 30;

            // glow halo
            if (glow > 2) {
              p.noStroke();
              p.fill(col[0], col[1], col[2], glow);
              p.rect(wx - 10, WIN_Y - 10, WIN_W + 20, WIN_H + 20, 18);
            }

            // window box gradient via drawingContext
            p.drawingContext.save();
            const grad = (p.drawingContext as unknown as CanvasRenderingContext2D).createLinearGradient(wx, WIN_Y, wx, WIN_Y + WIN_H);
            grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},1)`);
            grad.addColorStop(1, `rgba(${Math.max(0,col[0]-40)},${Math.max(0,col[1]-40)},${Math.max(0,col[2]-40)},1)`);
            (p.drawingContext as unknown as CanvasRenderingContext2D).fillStyle = grad;
            p.noStroke();
            p.rect(wx, WIN_Y, WIN_W, WIN_H, 12);
            p.drawingContext.restore();

            // window label
            p.fill(255); p.noStroke();
            p.textSize(13); p.textAlign(p.CENTER, p.CENTER);
            p.text(`窗口 ${wi + 1}`, cx, WIN_Y + 26);
            p.textSize(11);
            p.fill(255, 255, 255, 200);
            p.text(`已服务 ${windows[wi]?.totalServed ?? 0} 人`, cx, WIN_Y + 50);

            // utilization bar inside window
            p.fill(0, 0, 0, 40);
            p.noStroke();
            p.rect(wx + 10, WIN_Y + 62, WIN_W - 20, 8, 4);
            p.fill(255, 255, 255, 180);
            p.rect(wx + 10, WIN_Y + 62, (WIN_W - 20) * util, 8, 4);
          }

          // ── queue dots above each window ──
          for (let wi = 0; wi < WIN_COUNT; wi++) {
            const cx = winCX(wi);
            const queue = byWindow[wi] ?? [];
            const visible = queue.slice(0, 15);
            visible.forEach((c, qi) => {
              const dotY = WIN_Y - 20 - qi * 22;
              const [r, g, b] = waitColor(c.waitTime);
              const pulse = 0.85 + 0.15 * Math.sin(p.frameCount * 0.08 + qi * 0.6);
              p.noStroke();
              p.fill(r, g, b, pulse * 220);
              p.circle(cx, dotY, 16);
              // highlight
              p.fill(255, 255, 255, 60);
              p.circle(cx - 3, dotY - 3, 5);
              // id label
              p.fill(255);
              p.textSize(8); p.textAlign(p.CENTER, p.CENTER);
              p.text(`${c.id}`, cx, dotY);
            });
            if (queue.length > 15) {
              const dotY = WIN_Y - 20 - 15 * 22;
              p.fill(100, 116, 139); p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
              p.text(`+${queue.length - 15}`, cx, dotY);
            }
            // queue count label
            p.fill(71, 85, 105); p.textSize(10); p.textAlign(p.CENTER, p.TOP);
            p.text(`${queue.length}人排队`, cx, WIN_Y + WIN_H + 8);
          }

          // ── bar chart ──
          const CHART_Y = WIN_Y + WIN_H + 60;
          const CHART_H = H - CHART_Y - 40;
          const BAR_W = 60;
          const BAR_SPACING = (W - WIN_COUNT * BAR_W) / (WIN_COUNT + 1);

          // axis
          p.stroke(203, 213, 225); p.strokeWeight(1);
          p.line(30, CHART_Y, 30, CHART_Y + CHART_H);
          p.line(30, CHART_Y + CHART_H, W - 20, CHART_Y + CHART_H);

          p.fill(100, 116, 139); p.noStroke();
          p.textSize(10); p.textAlign(p.CENTER, p.TOP);
          p.text('各窗口服务人数', W / 2, CHART_Y - 18);

          for (let wi = 0; wi < WIN_COUNT; wi++) {
            const served = windows[wi]?.totalServed ?? 0;
            const barH = CHART_H * (served / maxServed);
            const bx = BAR_SPACING + wi * (BAR_W + BAR_SPACING);
            const by = CHART_Y + CHART_H - barH;
            const col = PALETTE[wi % PALETTE.length];

            p.drawingContext.save();
            const bg = (p.drawingContext as unknown as CanvasRenderingContext2D).createLinearGradient(bx, by, bx, CHART_Y + CHART_H);
            bg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.9)`);
            bg.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0.4)`);
            (p.drawingContext as unknown as CanvasRenderingContext2D).fillStyle = bg;
            p.noStroke();
            p.rect(bx, by, BAR_W, barH, 6, 6, 0, 0);
            p.drawingContext.restore();

            // value label on top
            p.fill(30, 41, 59); p.noStroke();
            p.textSize(11); p.textAlign(p.CENTER, p.BOTTOM);
            p.text(`${served}`, bx + BAR_W / 2, by - 3);

            // x label
            p.fill(71, 85, 105); p.textSize(10); p.textAlign(p.CENTER, p.TOP);
            p.text(`窗口${wi + 1}`, bx + BAR_W / 2, CHART_Y + CHART_H + 5);
          }

          // legend: wait-time color scale
          const LX = W - 140;
          const LY = CHART_Y;
          p.textSize(9); p.textAlign(p.LEFT, p.CENTER); p.fill(100, 116, 139); p.noStroke();
          p.text('等待时长', LX, LY - 10);
          for (let k = 0; k < 10; k++) {
            const [r, g, b] = waitColor(k * 1.1);
            p.fill(r, g, b); p.noStroke();
            p.rect(LX + k * 12, LY, 12, 10);
          }
          p.fill(100, 116, 139); p.textAlign(p.LEFT, p.TOP);
          p.text('0 min', LX, LY + 13);
          p.textAlign(p.RIGHT, p.TOP);
          p.text('10+ min', LX + 120, LY + 13);
        }; // end draw
      }; // end sketch

      p5Instance = new p5(sketch, container);
    });

    return () => { p5Instance?.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statistics, windows, customers]);

  const utilization = windows.map(w =>
    Math.min(1, w.totalServiceTime / Math.max(1, statistics.totalSimulationTime))
  );

  return (
    <div style={{ display: 'flex', gap: 0, background: '#141413', borderRadius: 16, overflow: 'hidden' }}>
      {/* sidebar */}
      <div style={{
        width: 220, background: '#1c1c1b', padding: '24px 16px',
        display: 'flex', flexDirection: 'column', gap: 18, flexShrink: 0,
      }}>
        <div style={{ color: '#d97757', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>银行排队数据</div>
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 14 }}>
          {([
            ['总客户数', statistics.totalCustomers],
            ['平均等待', `${statistics.avgWaitTime.toFixed(1)} min`],
            ['仿真时长', `${statistics.totalSimulationTime.toFixed(1)} min`],
          ] as [string, string | number][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#6b6b68', fontSize: 11 }}>{label}</span>
              <span style={{ color: '#faf9f5', fontSize: 11 }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 14 }}>
          <div style={{ color: '#b0aea5', fontSize: 11, marginBottom: 10 }}>窗口利用率</div>
          {windows.map((w, i) => {
            const util = utilization[i] ?? 0;
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
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}
