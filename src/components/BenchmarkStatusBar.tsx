import type { BenchmarkState } from '@/lib/benchmark-types';

interface BenchmarkStatusBarProps {
  state: BenchmarkState | null;
  algorithmName: string;
  isPlaying: boolean;
  speed: number;
}

export default function BenchmarkStatusBar({
  state,
  algorithmName,
  isPlaying,
  speed,
}: BenchmarkStatusBarProps) {
  if (!state) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Waiting for playback state...
      </div>
    );
  }

  const waitingCount = state.jobs.filter((job) => job.status === 'waiting').length;
  const servingCount = state.jobs.filter((job) => job.status === 'serving').length;
  const completedCount = state.jobs.filter((job) => job.status === 'completed').length;
  const inSystemCount = waitingCount + servingCount;
  const longestQueue = Math.max(...state.servers.map((server) => server.queueJobIds.length), 0);

  return (
    <div className="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge label="Algorithm" value={algorithmName} />
          <Badge label="Time" value={`${state.currentTime.toFixed(1)} min`} />
          <Badge label="In System" value={String(inSystemCount)} />
          <Badge label="Waiting" value={String(waitingCount)} />
          <Badge label="Serving" value={String(servingCount)} />
          <Badge label="Completed" value={String(completedCount)} />
          <Badge label="Longest Queue" value={String(longestQueue)} />
          {state.queueStructure === 'shared' ? (
            <Badge label="Shared Queue" value={String(state.sharedQueue.length)} />
          ) : null}
          {state.queueStructure === 'holding' ? (
            <Badge label="Holding Pool" value={String(state.holdingPool.length)} />
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isPlaying ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          <span>{isPlaying ? `Playing (${speed.toFixed(1)}x)` : 'Paused'}</span>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
