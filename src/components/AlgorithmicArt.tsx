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
  yellow: [230, 190, 80],
};
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function waitColor(wt: number, avgWait: number): [number,number,number] {
  const t = Math.min(1, wt / Math.max(1, avgWait * 1.5));
  if (t < 0.5) {
    const s = t * 2;
    return [Math.round(lerp(C.blue[0],C.orange[0],s)), Math.round(lerp(C.blue[1],C.orange[1],s)), Math.round(lerp(C.blue[2],C.orange[2],s))];
  }
  const s = (t - 0.5) * 2;
  return [Math.round(lerp(C.orange[0],C.red[0],s)), Math.round(lerp(C.orange[1],C.red[1],s)), Math.round(lerp(C.orange[2],C.red[2],s))];
}

export default function AlgorithmicArt({ statistics, windows, customers, comparisonResults }: AlgorithmicArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<any>(null);
  const statisticsRef = useRef(statistics);
  const windowsRef = useRef(windows);
  const customersRef = useRef(customers);
  const comparisonResultsRef = useRef(comparisonResults);

  const utilization = windows.map(w =>
    Math.min(1, w.totalServiceTime / Math.max(1, statistics.totalSimulationTime))
  );

  useEffect(() => {
    statisticsRef.current = statistics;
    windowsRef.current = windows;
    customersRef.current = customers;
    comparisonResultsRef.current = comparisonResults;

    if (p5Ref.current) {
      p5Ref.current.redraw();
    }
  }, [statistics, windows, customers, comparisonResults]);

  useEffect(() => {
    if (!containerRef.current || p5Ref.current) return;

    let mounted = true;

    import('p5').then((mod) => {
      if (!mounted || !containerRef.current) return;
      const p5 = mod.default;
      const container = containerRef.current;

      const sketch = (p: any) => {
        const W = container.offsetWidth || 700;
        const H = 420;

        p.setup = () => {
          p.createCanvas(W, H);
          p.noLoop();
          p.redraw();
        };

        p.draw = () => {
          p.background(C.bg[0], C.bg[1], C.bg[2]);
          const nextComparisonResults = comparisonResultsRef.current;
          if (nextComparisonResults && nextComparisonResults.length > 0) {
            drawComparison(p, W, H, nextComparisonResults);
          } else {
            drawSingle(p, W, H, statisticsRef.current, windowsRef.current, customersRef.current);
          }
        };
      };

      p5Ref.current = new p5(sketch, container);
    });

    return () => {
      mounted = false;
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  }, []);
  return (
    <div style={{ display: 'flex', background: '#14141300', borderRadius: 12, overflow: 'hidden', minHeight: 420 }}>
      {/* 侧边栏 */}
      <div style={{ width: 180, background: '#18181a', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>
        <div>
          <div style={{ color: '#6b6b68', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>模拟统计</div>
          <div style={{ color: '#b0aea5', fontSize: 12, marginBottom: 4 }}>总客户数 <span style={{ color: '#d97757', fontWeight: 700 }}>{statistics.totalCustomers}</span></div>
          <div style={{ color: '#b0aea5', fontSize: 12, marginBottom: 4 }}>平均等待 <span style={{ color: '#6a9bcc', fontWeight: 700 }}>{statistics.avgWaitTime.toFixed(1)}m</span></div>
          <div style={{ color: '#b0aea5', fontSize: 12 }}>仿真时长 <span style={{ color: '#788c5d', fontWeight: 700 }}>{statistics.totalSimulationTime.toFixed(0)}m</span></div>
          <div style={{ color: '#6b6b68', fontSize: 9, marginTop: 4 }}>注: 仿真时长指最后一位客户离开的时刻。</div>
        </div>
        <div>
          <div style={{ color: '#6b6b68', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>窗口利用率</div>
          {utilization.map((util, i) => (
            <div key={i} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#6b6b68', fontSize: 10 }}>窗口{i + 1}</span>
                <span style={{ color: '#788c5d', fontSize: 10 }}>{(util * 100).toFixed(0)}%</span>
              </div>
              <div style={{ height: 4, background: '#2a2a28', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${util * 100}%`, background: '#788c5d', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #2a2a28', paddingTop: 12 }}>
          <div style={{ color: '#b0aea5', fontSize: 10, marginBottom: 6 }}>等待时间色阶</div>
          {([['等待: 短', '#6a9bcc'], ['等待: 中', '#d97757'], ['等待: 长', '#dc3c3c']] as [string,string][]).map(([label, col]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
              <span style={{ color: '#b0aea5', fontSize: 10 }}>{label}</span>
            </div>
          ))}
          <div style={{ color: '#6b6b68', fontSize: 9, marginTop: 8, lineHeight: 1.4 }}>
            中心为入口，外圆为窗口。<br/>线条代表客户流向。
          </div>
        </div>
      </div>
      {/* canvas 区域 */}
      <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />
    </div>
  );
}
// ── 单模式：弧线 + 窗口节点图 ──
function drawSingle(p: any, W: number, H: number, statistics: SimStats, windows: WindowStat[], customers: CustomerData[]) {
  const avgWait = statistics.avgWaitTime;
  const CX = W / 2, CY = H / 2;
  const R = Math.min(W, H) * 0.32;

  // 弧线：每个客户一条，颜色=等待时间
  p.strokeWeight(0.6);
  p.noFill();
  const sample = customers.length > 120 ? customers.filter((_:any,i:number)=>i%Math.ceil(customers.length/120)===0) : customers;
  for (const c of sample) {
    const [r,g,b] = waitColor(c.waitTime, avgWait);
    p.stroke(r, g, b, 60);
    const wi = (c.windowId - 1) % windows.length;
    const angle = (wi / windows.length) * Math.PI * 2 - Math.PI / 2;
    const wx = CX + Math.cos(angle) * R;
    const wy = CY + Math.sin(angle) * R;
    const cx1 = CX + (wx - CX) * 0.3;
    const cy1 = CY + (wy - CY) * 0.3 - 30;
    p.bezier(CX, CY, cx1, cy1, wx - 10, wy - 10, wx, wy);
  }

  // 中心节点
  p.noStroke();
  p.fill(C.orange[0], C.orange[1], C.orange[2], 200);
  p.circle(CX, CY, 18);
  p.fill(C.bg[0], C.bg[1], C.bg[2]);
  p.circle(CX, CY, 10);

  // 窗口节点
  p.textAlign(p.CENTER, p.CENTER);
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const angle = (i / windows.length) * Math.PI * 2 - Math.PI / 2;
    const wx = CX + Math.cos(angle) * R;
    const wy = CY + Math.sin(angle) * R;
    const util = Math.min(1, w.totalServiceTime / Math.max(1, statistics.totalSimulationTime));
    const [r,g,b] = [Math.round(lerp(C.blue[0],C.green[0],util)), Math.round(lerp(C.blue[1],C.green[1],util)), Math.round(lerp(C.blue[2],C.green[2],util))];
    p.fill(r, g, b, 220);
    p.noStroke();
    p.circle(wx, wy, 28);
    p.fill(255);
    p.textSize(8);
    p.text(`W${w.id}`, wx, wy - 4);
    p.text(`${w.totalServed}人`, wx, wy + 5);
  }

  // 标题
  p.fill(C.gray[0], C.gray[1], C.gray[2], 180);
  p.noStroke();
  p.textSize(11);
  p.textAlign(p.LEFT, p.TOP);
  p.text('客户流量分布', 16, 14);
  p.fill(C.gray[0], C.gray[1], C.gray[2], 120);
  p.textSize(9);
  p.text('弧线颜色代表该路径上客户的平均等待程度 (蓝色=短, 红色=长)', 16, 30);

  // 绘制雷达图 (如果窗口数为5或更多)
  if (windows.length >= 4) {
    drawRadar(p, CX, CY, statistics, windows);
  }
}
// ── 对比模式：3列并排 ──
function drawComparison(p: any, W: number, H: number, entries: ComparisonEntry[]) {
  const n = entries.length;
  const colW = W / n;
  const bestAvg = Math.min(...entries.map(e => e.result.statistics.avgWaitTime));

  // 底部条形图高度区域
  const barAreaH = 110;
  const mainH = H - barAreaH;

  // 每列
  entries.forEach((entry, ei) => {
    const x = ei * colW;
    const stats = entry.result.statistics;
    const wins = entry.result.windows;
    const isBest = stats.avgWaitTime <= bestAvg + 0.001;

    // 列背景
    p.noStroke();
    p.fill(ei % 2 === 0 ? 28 : 24, ei % 2 === 0 ? 28 : 24, ei % 2 === 0 ? 26 : 22, 200);
    p.rect(x, 0, colW, mainH);

    // 算法名
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(13);
    p.fill(isBest ? C.orange[0] : C.gray[0], isBest ? C.orange[1] : C.gray[1], isBest ? C.orange[2] : C.gray[2]);
    const shortName = entry.algorithmName.replace(/（.*）/, '').replace(/\(.*\)/, '');
    p.text(shortName, x + colW / 2, 14);
    if (isBest) {
      p.textSize(9);
      p.fill(C.green[0], C.green[1], C.green[2]);
      p.text('★ 最优', x + colW / 2, 32);
    }

    // 平均等待时间大字
    p.textSize(28);
    p.fill(isBest ? C.orange[0] : C.blue[0], isBest ? C.orange[1] : C.blue[1], isBest ? C.orange[2] : C.blue[2]);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(`${stats.avgWaitTime.toFixed(1)}`, x + colW / 2, 80);
    p.textSize(10);
    p.fill(C.gray[0], C.gray[1], C.gray[2], 160);
    p.text('分钟/人均等待', x + colW / 2, 105);

    // 总客户数
    p.textSize(11);
    p.fill(C.gray[0], C.gray[1], C.gray[2]);
    p.text(`${stats.totalCustomers} 人`, x + colW / 2, 130);
    p.textSize(9);
    p.fill(C.gray[0], C.gray[1], C.gray[2], 140);
    p.text('总服务客户', x + colW / 2, 145);

    // 窗口利用率柱状图
    const barTop = 168;
    const barH = mainH - barTop - 16;
    const bw = Math.min(22, (colW - 20) / Math.max(wins.length, 1) - 4);
    const spacing = (colW - 16) / Math.max(wins.length, 1);
    wins.forEach((w, wi) => {
      const util = Math.min(1, w.totalServiceTime / Math.max(1, stats.totalSimulationTime));
      const bx = x + 8 + wi * spacing + spacing / 2 - bw / 2;
      const bh = Math.max(4, util * barH);
      p.noStroke();
      p.fill(C.green[0], C.green[1], C.green[2], 180);
      p.rect(bx, barTop + barH - bh, bw, bh, 2);
      p.fill(C.gray[0], C.gray[1], C.gray[2], 120);
      p.textSize(8);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text(`W${w.id}`, bx + bw/2, barTop + barH + 12);
    });
    p.textAlign(p.LEFT, p.TOP);
    p.textSize(9);
    p.fill(C.gray[0], C.gray[1], C.gray[2], 100);
    p.text('窗口利用率', x + 8, barTop - 12);

    // 列分割线
    if (ei < n - 1) {
      p.stroke(C.gray[0], C.gray[1], C.gray[2], 30);
      p.strokeWeight(1);
      p.line(x + colW, 0, x + colW, mainH);
      p.noStroke();
    }
  });

  // ── 底部横向对比条形图 ──
  const barY = mainH;
  p.fill(16, 16, 15);
  p.noStroke();
  p.rect(0, barY, W, barAreaH);

  p.textAlign(p.LEFT, p.CENTER);
  p.textSize(10);
  p.fill(C.gray[0], C.gray[1], C.gray[2], 160);
  p.text('平均等待时间对比（分钟）', 14, barY + 14);

  const maxAvg = Math.max(...entries.map(e => e.result.statistics.avgWaitTime), 0.1);
  const rowH = (barAreaH - 28) / n;
  entries.forEach((entry, ei) => {
    const stats = entry.result.statistics;
    const isBest = stats.avgWaitTime <= bestAvg + 0.001;
    const bw = Math.max(4, (stats.avgWaitTime / maxAvg) * (W - 140));
    const by = barY + 26 + ei * rowH + rowH / 2 - 9;
    p.noStroke();
    p.fill(isBest ? C.orange[0] : C.blue[0], isBest ? C.orange[1] : C.blue[1], isBest ? C.orange[2] : C.blue[2], isBest ? 220 : 140);
    p.rect(100, by, bw, 14, 2);
    p.fill(C.gray[0], C.gray[1], C.gray[2]);
    p.textAlign(p.RIGHT, p.CENTER);
    p.textSize(9);
    const shortN = entry.algorithmName.replace(/（.*）/, '').replace(/\(.*\)/, '');
    p.text(shortN, 96, by + 7);
    p.textAlign(p.LEFT, p.CENTER);
    p.fill(isBest ? C.orange[0] : C.gray[0], isBest ? C.orange[1] : C.gray[1], isBest ? C.orange[2] : C.gray[2]);
    p.text(`${stats.avgWaitTime.toFixed(2)}m`, 104 + bw, by + 7);
  });
}

function drawRadar(p: any, cx: number, cy: number, stats: any, windows: any[]) {
  const R = 60;
  const axes = ['总客户', '平均等待', '平均逗留', '最大队列', '利用率'];
  const values = [
    Math.min(1, stats.totalCustomers / 100),
    Math.min(1, stats.avgWaitTime / 20),
    Math.min(1, (stats.avgWaitTime + 5) / 30),
    Math.min(1, (stats.totalCustomers / 10) / 10),
    windows.reduce((sum: number, w: any) => sum + (w.totalServiceTime / Math.max(1, stats.totalSimulationTime)), 0) / windows.length
  ];

  p.stroke(C.gray[0], C.gray[1], C.gray[2], 50);
  p.noFill();
  for (let j = 1; j <= 4; j++) {
    p.beginShape();
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      p.vertex(cx + Math.cos(angle) * R * (j / 4), cy + Math.sin(angle) * R * (j / 4));
    }
    p.endShape(p.CLOSE);
  }

  p.stroke(C.orange[0], C.orange[1], C.orange[2], 150);
  p.strokeWeight(2);
  p.fill(C.orange[0], C.orange[1], C.orange[2], 50);
  p.beginShape();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    p.vertex(cx + Math.cos(angle) * R * values[i], cy + Math.sin(angle) * R * values[i]);
  }
  p.endShape(p.CLOSE);

  p.noStroke();
  p.fill(C.gray[0], C.gray[1], C.gray[2], 200);
  p.textSize(8);
  p.textAlign(p.CENTER, p.CENTER);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const tx = cx + Math.cos(angle) * (R + 15);
    const ty = cy + Math.sin(angle) * (R + 15);
    p.text(axes[i], tx, ty);
  }
}



