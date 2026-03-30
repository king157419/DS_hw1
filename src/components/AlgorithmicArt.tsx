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

export interface ComparisonEntry {
  algorithmName: string;
  result: {
    customers: CustomerData[];
    windows: WindowStat[];
    statistics: SimStats;
  };
}

export interface AlgorithmicArtProps {
  statistics: SimStats;
  windows: WindowStat[];
  customers: CustomerData[];
  comparisonResults?: ComparisonEntry[];
}

// Anthropic brand palette
const C: Record<string, [number,number,number]> = {
  bg:     [20, 20, 19],
  blue:   [106, 155, 204],
  orange: [217, 119, 87],
  green:  [120, 140, 93],
  gray:   [176, 174, 165],
  red:    [220, 60, 60],
};

export default function AlgorithmicArt({ statistics, windows, customers, comparisonResults }: AlgorithmicArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isComparison = !!(comparisonResults && comparisonResults.length > 0);

  // Utilization for sidebar
  const utilization = windows.map(w =>
    Math.min(1, w.totalServiceTime / Math.max(1, statistics.totalSimulationTime))
  );

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p5Instance: any = null;

    import('p5').then((mod) => {
      const p5 = mod.default;
      const container = containerRef.current!;

      // Pure wait-time color (no p5 dependency, used in setup buffer)
      function waitColStatic(wt: number, avgWait: number): [number,number,number] {
        const t = Math.min(1, wt / Math.max(1, avgWait * 1.5));
        if (t < 0.5) {
          const s = t * 2;
          return [
            Math.round(C.blue[0] + s * (C.orange[0] - C.blue[0])),
            Math.round(C.blue[1] + s * (C.orange[1] - C.blue[1])),
            Math.round(C.blue[2] + s * (C.orange[2] - C.blue[2])),
          ];
        }
        const s2 = (t - 0.5) * 2;
        return [
          Math.round(C.orange[0] + s2 * (C.red[0] - C.orange[0])),
          Math.round(C.orange[1] + s2 * (C.red[1] - C.orange[1])),
          Math.round(C.orange[2] + s2 * (C.red[2] - C.orange[2])),
        ];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sketch = (p: any) => {
        const W = 900;
        const H = isComparison ? 620 : 540;

        // Wait time → color: Anthropic blue → orange → red
        function waitCol(wt: number, avgWait: number): [number,number,number] {
          const t = Math.min(1, wt / Math.max(1, avgWait * 1.5));
          if (t < 0.5) {
            const s = t * 2;
            return [
              Math.round(C.blue[0] + s * (C.orange[0] - C.blue[0])),
              Math.round(C.blue[1] + s * (C.orange[1] - C.blue[1])),
              Math.round(C.blue[2] + s * (C.orange[2] - C.blue[2])),
            ];
          }
          const s = (t - 0.5) * 2;
          return [
            Math.round(C.orange[0] + s * (C.red[0] - C.orange[0])),
            Math.round(C.orange[1] + s * (C.red[1] - C.orange[1])),
            Math.round(C.orange[2] + s * (C.red[2] - C.orange[2])),
          ];
        }

        // Flow field motes
        interface Mote { x: number; y: number; col: [number,number,number]; }
        const motes: Mote[] = Array.from({ length: 60 }, () => ({
          x: p.random(W), y: p.random(H),
          col: [C.blue[0], C.blue[1], C.blue[2]] as [number,number,number],
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let arcBuffer: any = null;

        p.setup = () => {
          p.createCanvas(W, H);
          p.frameRate(24);
          p.colorMode(p.RGB, 255, 255, 255, 1);
          p.textFont('sans-serif');
          p.randomSeed(42);
          p.noiseSeed(42);

          // Pre-render static arcs into offscreen buffer
          arcBuffer = p.createGraphics(W, H);
          arcBuffer.clear();
          arcBuffer.colorMode(arcBuffer.RGB, 255, 255, 255, 1);

          if (!isComparison) {
            // single mode: arrival dots + bezier arcs
            const WIN_COUNT_s = windows.length || 1;
            const WIN_NODE_R_s = 18;
            const WIN_Y_s = H - 90;
            const SPACING_s = W / (WIN_COUNT_s + 1);
            const winX_s = (i: number) => SPACING_s * (i + 1);
            const simTime_s = statistics.totalSimulationTime || 1;
            // timeline strip
            arcBuffer.fill(15, 18, 32); arcBuffer.noStroke(); arcBuffer.rect(0, 0, W, 38);
            customers.forEach(c => {
              const ax = 20 + (c.arrivalTime / simTime_s) * (W - 40);
              const [r2,g2,b2] = waitColStatic(c.waitTime, statistics.avgWaitTime);
              arcBuffer.fill(r2,g2,b2, 0.85); arcBuffer.noStroke();
              arcBuffer.circle(ax, 19, 6);
              const wi = c.windowId - 1;
              const wx_s = winX_s(wi);
              const sw = Math.min(2.5, 0.5 + c.serviceTime * 0.12);
              arcBuffer.stroke(r2,g2,b2, 0.45); arcBuffer.strokeWeight(sw); arcBuffer.noFill();
              arcBuffer.bezier(ax, 19, ax, WIN_Y_s - 200, wx_s, WIN_Y_s - 200, wx_s, WIN_Y_s - WIN_NODE_R_s - 4);
            });
          } else if (comparisonResults) {
            // comparison mode: arcs for each panel
            const N2 = comparisonResults.length;
            const panelH2 = Math.floor((H - 120) / N2);
            comparisonResults.forEach((entry, ei) => {
              const { result: res2 } = entry;
              const simTime2 = res2.statistics.totalSimulationTime || 1;
              const wins2 = res2.windows;
              const WIN_COUNT2 = wins2.length || 1;
              const SPACING2 = (W - 160) / (WIN_COUNT2 + 1);
              const winX2 = (i: number) => 80 + SPACING2 * (i + 1);
              const panelY2 = ei * panelH2 + 10;
              const arcAreaH2 = panelH2 - 38;
              const nodeY2 = panelY2 + arcAreaH2;
              res2.customers.forEach(c => {
                const ax2 = 80 + (c.arrivalTime / simTime2) * (W - 160);
                const [r3,g3,b3] = waitColStatic(c.waitTime, res2.statistics.avgWaitTime);
                const sw2 = Math.min(1.5, 0.3 + c.serviceTime * 0.07);
                arcBuffer.stroke(r3,g3,b3, 0.5); arcBuffer.strokeWeight(sw2); arcBuffer.noFill();
                arcBuffer.bezier(ax2, panelY2 + 8, ax2, nodeY2 - 50, winX2(c.windowId-1), nodeY2 - 50, winX2(c.windowId-1), nodeY2 - 10);
              });
            });
          }
        };

        // ── single-algorithm draw ──
        function drawSingle() {
          const sim = statistics;
          const wins = windows;
          const custs = customers;
          const WIN_COUNT = wins.length || 1;
          const WIN_NODE_R = 18;
          const WIN_Y = H - 90;
          const SPACING = W / (WIN_COUNT + 1);
          const winX = (i: number) => SPACING * (i + 1);
          const simTime = sim.totalSimulationTime || 1;

          // motion blur
          p.fill(C.bg[0], C.bg[1], C.bg[2], 22);
          p.noStroke(); p.rect(0, 0, W, H);

          // aurora bands
          for (let band = 0; band < 3; band++) {
            const off = p.noise(band * 10, p.frameCount * 0.003) * 80 - 40;
            const by = H * 0.3 + band * 80 + off;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dctx2 = p.drawingContext as unknown as CanvasRenderingContext2D;
            dctx2.save();
            const grd = dctx2.createLinearGradient(0, by - 30, 0, by + 30);
            const cols = [[30,60,180],[60,20,120],[10,100,120]];
            const [ar,ag,ab] = cols[band];
            grd.addColorStop(0, `rgba(${ar},${ag},${ab},0)`);
            grd.addColorStop(0.5, `rgba(${ar},${ag},${ab},0.04)`);
            grd.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
            dctx2.fillStyle = grd;
            dctx2.fillRect(0, by - 30, W, 60);
            dctx2.restore();
          }

          // flow field motes
          motes.forEach(m => {
            const angle = p.noise(m.x * 0.004, m.y * 0.004, p.frameCount * 0.004) * p.TWO_PI * 2;
            m.x += Math.cos(angle) * 0.5;
            m.y += Math.sin(angle) * 0.5;
            if (m.x < 0) m.x = W; if (m.x > W) m.x = 0;
            if (m.y < 0) m.y = H; if (m.y > H) m.y = 0;
            p.fill(m.col[0], m.col[1], m.col[2], 0.18);
            p.noStroke(); p.circle(m.x, m.y, 3);
          });

          // blit pre-rendered arcs + timeline strip
          if (arcBuffer) p.image(arcBuffer, 0, 0);
          // timeline labels (dynamic: simTime)
          p.fill(C.gray[0], C.gray[1], C.gray[2], 0.5);
          p.textSize(10); p.textAlign(p.LEFT, p.CENTER);
          p.text('到达时间线', 10, 19);
          p.fill(C.gray[0], C.gray[1], C.gray[2], 0.35);
          p.textAlign(p.RIGHT, p.CENTER);
          p.text(`0 ──── ${simTime.toFixed(1)} min`, W - 10, 19);
          p.noStroke();

          // window nodes
          wins.forEach((w, i) => {
            const wx = winX(i);
            const wy = WIN_Y;
            const util = Math.min(1, w.totalServiceTime / Math.max(1, simTime));
            // nebula halo (additive)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dctx3 = p.drawingContext as unknown as CanvasRenderingContext2D;
            dctx3.save();
            dctx3.globalCompositeOperation = 'screen';
            const rBase = 18 + w.totalServed * 0.6;
            for (let ring = 3; ring >= 1; ring--) {
              const rr = rBase * ring * 0.9;
              const grad = dctx3.createRadialGradient(wx, wy, 0, wx, wy, rr);
              grad.addColorStop(0, `rgba(${C.green[0]},${C.green[1]},${C.green[2]},${0.08 / ring})`);
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              dctx3.fillStyle = grad;
              dctx3.beginPath(); dctx3.arc(wx, wy, rr, 0, Math.PI * 2); dctx3.fill();
            }
            dctx3.restore();
            // utilization sweep arc
            p.noFill(); p.stroke(C.green[0], C.green[1], C.green[2], 0.7); p.strokeWeight(2);
            p.arc(wx, wy, WIN_NODE_R * 2 + 10, WIN_NODE_R * 2 + 10, -p.HALF_PI, -p.HALF_PI + util * p.TWO_PI);
            // breathing pulse ring
            const pulse = WIN_NODE_R + 6 + 4 * Math.sin(p.frameCount * 0.05 + i * 1.2);
            p.stroke(C.green[0], C.green[1], C.green[2], 0.25); p.strokeWeight(1);
            p.circle(wx, wy, pulse * 2);
            // node core
            p.noStroke();
            p.fill(C.green[0], C.green[1], C.green[2]); p.circle(wx, wy, WIN_NODE_R * 2);
            p.fill(255, 255, 255, 0.2); p.circle(wx - 4, wy - 4, 7);
            // label
            p.fill(C.gray[0], C.gray[1], C.gray[2]); p.textSize(10); p.textAlign(p.CENTER, p.TOP);
            p.text(`窗口${w.id}`, wx, wy + WIN_NODE_R + 4);
            p.fill(C.orange[0], C.orange[1], C.orange[2]); p.textSize(9);
            p.text(`${w.totalServed}人 · ${(util*100).toFixed(0)}%`, wx, wy + WIN_NODE_R + 17);
          });

          // HUD bottom-right
          const hudX = W - 190; const hudY = H - 80;
          p.fill(15, 18, 32, 0.85); p.noStroke(); p.rect(hudX, hudY, 180, 68, 8);
          const hudRows: [string, string, [number,number,number]][] = [
            ['平均等待', `${sim.avgWaitTime.toFixed(1)} min`, [C.blue[0],C.blue[1],C.blue[2]]],
            ['最大等待', `${Math.max(...custs.map(c=>c.waitTime), 0).toFixed(1)} min`, [C.red[0],C.red[1],C.red[2]]],
            ['总客户数', `${sim.totalCustomers}`, [C.gray[0],C.gray[1],C.gray[2]]],
          ];
          hudRows.forEach(([label, val, col], idx) => {
            p.fill(col[0],col[1],col[2]); p.textSize(10); p.textAlign(p.LEFT, p.TOP);
            p.text(label, hudX + 10, hudY + 10 + idx * 19);
            p.textAlign(p.RIGHT, p.TOP);
            p.text(val, hudX + 170, hudY + 10 + idx * 19);
          });
        } // end drawSingle

        // ── comparison draw ──
        function drawComparison() {
          if (!comparisonResults || comparisonResults.length === 0) return;
          p.background(C.bg[0], C.bg[1], C.bg[2]);

          // blit pre-rendered arcs
          if (arcBuffer) p.image(arcBuffer, 0, 0);

          // dark grid overlay (drawn once — no loops needed since arcBuffer has no grid)
          p.stroke(30, 35, 55, 0.5); p.strokeWeight(1);
          for (let gx = 0; gx < W; gx += 60) p.line(gx, 0, gx, H);
          for (let gy = 0; gy < H; gy += 40) p.line(0, gy, W, gy);
          p.noStroke();

          const N = comparisonResults.length;
          const panelH = Math.floor((H - 120) / N);
          const bestAvg = Math.min(...comparisonResults.map(e => e.result.statistics.avgWaitTime));

          comparisonResults.forEach((entry, ei) => {
            const { algorithmName, result: res } = entry;
            const panelY = ei * panelH + 10;
            const simTime = res.statistics.totalSimulationTime || 1;
            const custs2 = res.customers;
            const wins2 = res.windows;
            const WIN_COUNT2 = wins2.length || 1;
            const SPACING2 = (W - 160) / (WIN_COUNT2 + 1);
            const winX2 = (i: number) => 80 + SPACING2 * (i + 1);
            const arcAreaH = panelH - 38;
            const nodeY = panelY + arcAreaH;
            const isBest = res.statistics.avgWaitTime <= bestAvg + 0.001;

            // panel separator
            if (ei > 0) {
              p.stroke(40, 48, 72, 0.8); p.strokeWeight(1);
              p.line(0, panelY - 4, W, panelY - 4); p.noStroke();
            }

            // algo label
            const labelCol = isBest ? C.orange : C.gray;
            p.fill(labelCol[0], labelCol[1], labelCol[2]); p.textSize(11); p.textAlign(p.LEFT, p.CENTER);
            p.text(algorithmName, 8, panelY + 14);
            if (isBest) {
              p.fill(C.orange[0], C.orange[1], C.orange[2], 0.8); p.textSize(9);
              p.text('★ 最优', 8, panelY + 27);
            }
            // avg wait badge
            const avgW = res.statistics.avgWaitTime;
            const badgeCol = waitCol(avgW, avgW * 0.5);
            p.fill(badgeCol[0], badgeCol[1], badgeCol[2], 0.9);
            p.textSize(12); p.textAlign(p.LEFT, p.CENTER);
            p.text(`avg ${avgW.toFixed(2)}m`, 8, panelY + arcAreaH / 2);

            // arcs from pre-rendered buffer (blit once at start of comparison draw)
            p.noStroke();

            // mini window nodes
            wins2.forEach((w, i) => {
              const wx2 = winX2(i);
              const nr = 7;
              p.fill(C.green[0], C.green[1], C.green[2]); p.circle(wx2, nodeY, nr * 2);
              p.fill(C.gray[0], C.gray[1], C.gray[2]); p.textSize(8); p.textAlign(p.CENTER, p.TOP);
              p.text(`W${w.id}`, wx2, nodeY + nr + 2);
            });
          }); // end forEach entry

          // bottom bar chart: avgWaitTime comparison
          const barY = H - 108;
          p.fill(15, 18, 32, 0.9); p.noStroke(); p.rect(0, barY, W, 108);
          p.fill(C.gray[0], C.gray[1], C.gray[2]); p.textSize(10); p.textAlign(p.LEFT, p.CENTER);
          p.text('平均等待时间对比（越短越优）', 10, barY + 12);
          const maxAvg = Math.max(...comparisonResults.map(e => e.result.statistics.avgWaitTime), 0.1);
          const barW = Math.floor((W - 40) / comparisonResults.length) - 16;
          comparisonResults.forEach((entry, ei) => {
            const avgW2 = entry.result.statistics.avgWaitTime;
            const bh = Math.max(4, (avgW2 / maxAvg) * 70);
            const bx = 20 + ei * (barW + 16);
            const isBest2 = avgW2 <= bestAvg + 0.001;
            const [br,bg2,bb] = waitCol(avgW2, maxAvg * 0.5);
            p.fill(br, bg2, bb, isBest2 ? 0.95 : 0.6);
            p.rect(bx, barY + 90 - bh, barW, bh, 3);
            p.fill(isBest2 ? C.orange[0] : C.gray[0], isBest2 ? C.orange[1] : C.gray[1], isBest2 ? C.orange[2] : C.gray[2]);
            p.textSize(9); p.textAlign(p.CENTER, p.BOTTOM);
            p.text(`${avgW2.toFixed(2)}m`, bx + barW / 2, barY + 88 - bh);
            p.textAlign(p.CENTER, p.TOP);
            p.text(entry.algorithmName.split('（')[0], bx + barW / 2, barY + 92);
          });
        } // end drawComparison

        p.draw = () => {
          if (isComparison) drawComparison();
          else drawSingle();
        };
      }; // end sketch

      p5Instance = new p5(sketch, container);
    });

    return () => { p5Instance?.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statistics, windows, customers, comparisonResults, isComparison]);

  return (
    <div style={{ display: 'flex', gap: 0, background: '#141413', borderRadius: 16, overflow: 'hidden' }}>
      {/* sidebar */}
      <div style={{
        width: 200, background: '#1c1c1b', padding: '20px 14px',
        display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0,
      }}>
        <div style={{ color: '#d97757', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
          {isComparison ? '算法对比' : '等待的代价'}
        </div>
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 12 }}>
          {([
            ['总客户数', statistics.totalCustomers],
            ['平均等待', `${statistics.avgWaitTime.toFixed(1)} min`],
            ['仿真时长', `${statistics.totalSimulationTime.toFixed(1)} min`],
          ] as [string, string | number][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ color: '#6b6b68', fontSize: 11 }}>{label}</span>
              <span style={{ color: '#faf9f5', fontSize: 11 }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 12 }}>
          <div style={{ color: '#b0aea5', fontSize: 11, marginBottom: 8 }}>窗口利用率</div>
          {windows.map((w, i) => {
            const util = utilization[i] ?? 0;
            return (
              <div key={w.id} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: '#6b6b68', fontSize: 10 }}>窗口{i + 1}</span>
                  <span style={{ color: '#788c5d', fontSize: 10 }}>{(util * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 4, background: '#2a2a28', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${util * 100}%`, background: '#788c5d', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        {isComparison && (
          <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 12 }}>
            <div style={{ color: '#b0aea5', fontSize: 11, marginBottom: 8 }}>色彩说明</div>
            {[['低等待', '#6a9bcc'], ['中等待', '#d97757'], ['高等待', '#dc3c3c']].map(([label, col]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
                <span style={{ color: '#6b6b68', fontSize: 10 }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* canvas */}
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}








