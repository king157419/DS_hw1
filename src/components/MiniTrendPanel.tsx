import type { BenchmarkState } from '@/lib/benchmark-types';

interface MiniTrendPanelProps {
  snapshots: BenchmarkState[];
  currentTime: number;
}

interface SeriesPoint {
  time: number;
  value: number;
}

export default function MiniTrendPanel({
  snapshots,
  currentTime,
}: MiniTrendPanelProps) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm text-slate-400">
        No trend data yet.
      </div>
    );
  }

  const waitingSeries = snapshots.map((snapshot) => ({
    time: snapshot.currentTime,
    value: snapshot.jobs.filter((job) => job.status === 'waiting').length,
  }));

  const inSystemSeries = snapshots.map((snapshot) => ({
    time: snapshot.currentTime,
    value: snapshot.jobs.filter((job) => job.status !== 'completed').length,
  }));

  const queueSeries = snapshots.map((snapshot) => ({
    time: snapshot.currentTime,
    value: Math.max(
      snapshot.sharedQueue.length,
      snapshot.holdingPool.length,
      ...snapshot.servers.map((server) => server.queueJobIds.length),
    ),
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-900">Real-time Trends</div>
      <div className="space-y-4">
        <MiniChart
          title="Waiting Customers"
          color="#f59e0b"
          series={waitingSeries}
          currentTime={currentTime}
        />
        <MiniChart
          title="Customers In System"
          color="#fb923c"
          series={inSystemSeries}
          currentTime={currentTime}
        />
        <MiniChart
          title="Queue Peak"
          color="#ef4444"
          series={queueSeries}
          currentTime={currentTime}
        />
      </div>
    </div>
  );
}

function MiniChart({
  title,
  color,
  series,
  currentTime,
}: {
  title: string;
  color: string;
  series: SeriesPoint[];
  currentTime: number;
}) {
  const width = 260;
  const height = 56;
  const maxValue = Math.max(1, ...series.map((point) => point.value));
  const activeIndex = findActiveIndex(series, currentTime);

  const path = series
    .map((point, index) => {
      const denominator = series.length === 1 ? 1 : series.length - 1;
      const x = series.length === 1 ? width / 2 : (index / denominator) * width;
      const y = height - (point.value / maxValue) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const activePoint = series[activeIndex] ?? series[series.length - 1];
  const activeX =
    series.length === 1 ? width / 2 : (activeIndex / Math.max(series.length - 1, 1)) * width;
  const activeY = height - (activePoint.value / maxValue) * height;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-slate-500">{title}</span>
        <span className="text-xs font-semibold text-slate-800">{activePoint.value}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible">
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={activeX} cy={activeY} r="4" fill={color} />
      </svg>
    </div>
  );
}

function findActiveIndex(series: SeriesPoint[], currentTime: number): number {
  let activeIndex = 0;

  for (let index = 0; index < series.length; index += 1) {
    if (series[index].time <= currentTime) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}
