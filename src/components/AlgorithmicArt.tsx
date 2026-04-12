'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { BenchmarkRunResult, Job } from '@/lib/benchmark-types';
import { getAlgorithmMeta, isAlgorithmId } from '@/lib/benchmark-registry';

export type ArtMode = 'flow' | 'compare';

export interface AlgorithmicArtProps {
  singleResult?: BenchmarkRunResult | null;
  comparisonResults?: BenchmarkRunResult[];
  initialMode?: ArtMode;
}

export default function AlgorithmicArt({
  singleResult,
  comparisonResults = [],
  initialMode = 'flow',
}: AlgorithmicArtProps) {
  const canFlow = Boolean(singleResult);
  const canCompare = comparisonResults.length > 0;
  const [mode, setMode] = useState<ArtMode>(canFlow ? initialMode : 'compare');

  useEffect(() => {
    if (mode === 'flow' && !canFlow && canCompare) {
      setMode('compare');
    } else if (mode === 'compare' && !canCompare && canFlow) {
      setMode('flow');
    }
  }, [canCompare, canFlow, mode]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Algorithmic Art</h3>
          <p className="mt-1 text-sm text-slate-500">
            用显式 tab 在单算法 flow 视图和多算法 compare 视图之间切换。
          </p>
        </div>

        <div className="inline-flex rounded-full bg-slate-100 p-1">
          <TabButton active={mode === 'flow'} disabled={!canFlow} onClick={() => setMode('flow')}>
            Flow View
          </TabButton>
          <TabButton
            active={mode === 'compare'}
            disabled={!canCompare}
            onClick={() => setMode('compare')}
          >
            Compare View
          </TabButton>
        </div>
      </div>

      <div className="mt-5 min-h-[430px]">
        {mode === 'flow' ? (
          <FlowView result={singleResult ?? null} />
        ) : (
          <CompareView results={comparisonResults} />
        )}
      </div>
    </section>
  );
}

function FlowView({ result }: { result: BenchmarkRunResult | null }) {
  if (!result) {
    return <EmptyState message="先运行一次单算法动画，Flow View 才会有内容。" />;
  }

  const sampledJobs = sampleJobs(result.jobs, 36);
  const totalTime = Math.max(...result.jobs.map((job) => job.endTime), 0);
  const serverPositions = getServerPositions(result.servers.length);

  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex h-full flex-col gap-4 rounded-[24px] bg-slate-950 px-5 py-5 text-slate-100">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Flow</div>
          <div className="mt-2 text-lg font-semibold">{displayAlgorithmName(result)}</div>
          <div className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
            {queueStructureLabel(result.queueStructure)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Average Wait" value={`${result.metrics.avgWait.toFixed(2)}m`} />
          <StatCard label="P95 Wait" value={`${result.metrics.p95Wait.toFixed(2)}m`} />
          <StatCard label="Max Queue" value={`${result.metrics.maxQueueLength}`} />
          <StatCard label="Total Time" value={`${totalTime.toFixed(1)}m`} />
        </div>

        <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Legend</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <LegendRow color="#38bdf8" label="Shorter waits" />
            <LegendRow color="#f59e0b" label="Medium waits" />
            <LegendRow color="#fb7185" label="Long waits" />
          </div>
        </div>
      </aside>

      <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_42%),linear-gradient(180deg,#0f172a,#111827)] p-5">
        <svg viewBox="0 0 860 420" className="h-full w-full">
          <circle cx="240" cy="210" r="24" fill="#f8fafc" fillOpacity="0.95" />
          <circle cx="240" cy="210" r="12" fill="#f97316" />
          <text x="240" y="252" textAnchor="middle" fontSize="12" fill="#cbd5e1">
            Customer inflow
          </text>

          {sampledJobs.map((job) => {
            const target = serverPositions[job.assignedServerId - 1];
            if (!target) {
              return null;
            }

            return (
              <path
                key={job.id}
                d={`M 240 210 Q ${(240 + target.x) / 2} ${Math.min(210, target.y) - 36} ${target.x} ${target.y}`}
                fill="none"
                stroke={waitColor(job.startTime - job.arrivalTime, result.metrics.avgWait)}
                strokeOpacity="0.42"
                strokeWidth="2"
              />
            );
          })}

          {result.servers.map((server, index) => {
            const target = serverPositions[index];
            const utilization = totalTime > 0 ? server.busyTime / totalTime : 0;
            return (
              <g key={server.id}>
                <circle
                  cx={target.x}
                  cy={target.y}
                  r="34"
                  fill={utilization > 0.75 ? '#f97316' : utilization > 0.45 ? '#38bdf8' : '#94a3b8'}
                  fillOpacity="0.92"
                />
                <circle cx={target.x} cy={target.y} r="14" fill="#0f172a" fillOpacity="0.75" />
                <text x={target.x} y={target.y - 52} textAnchor="middle" fontSize="13" fill="#e2e8f0">
                  Window {server.id}
                </text>
                <text x={target.x} y={target.y + 58} textAnchor="middle" fontSize="12" fill="#cbd5e1">
                  Utilization {(utilization * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function CompareView({ results }: { results: BenchmarkRunResult[] }) {
  if (results.length === 0) {
    return <EmptyState message="先运行一次多算法对比，Compare View 才会有内容。" />;
  }

  const sorted = [...results].sort((left, right) => left.metrics.avgWait - right.metrics.avgWait);
  const bestWait = sorted[0].metrics.avgWait;
  const worstWait = sorted[sorted.length - 1].metrics.avgWait;
  const spread = worstWait - bestWait;
  const lowDifference = sorted.length < 2 || spread < 0.5 || spread / Math.max(worstWait, 1) < 0.08;

  return (
    <div className="flex h-full flex-col gap-5">
      <div
        className={`rounded-[22px] border px-4 py-3 text-sm ${
          lowDifference
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}
      >
        {lowDifference
          ? '当前场景下算法差异较小，所以这里刻意弱化“赢家”视觉，避免把微小差异渲染得过强。'
          : '当前场景差异足够明显，因此会适度强调平均等待时间最优的算法。'}
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((result, index) => {
          const isBest = index === 0 && !lowDifference;
          return (
            <article
              key={`${result.algorithmId}-${result.algorithmName}`}
              className={`flex h-full flex-col rounded-[24px] border p-5 ${
                isBest ? 'border-orange-200 bg-orange-50 shadow-sm' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {displayAlgorithmName(result)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {queueStructureLabel(result.queueStructure)}
                  </div>
                </div>
                {isBest ? (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                    Best separation
                  </span>
                ) : null}
              </div>

              <div className="mt-5 text-4xl font-semibold text-slate-900">
                {result.metrics.avgWait.toFixed(2)}
                <span className="ml-1 text-base text-slate-400">min</span>
              </div>
              <div className="mt-1 text-sm text-slate-500">Average wait time</div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricChip label="P95" value={`${result.metrics.p95Wait.toFixed(2)}m`} />
                <MetricChip label="Fairness" value={result.metrics.jainFairnessWait.toFixed(3)} />
                <MetricChip label="Max Queue" value={`${result.metrics.maxQueueLength}`} />
                <MetricChip label="Util. Std" value={result.metrics.utilizationStd.toFixed(3)} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-950 px-5 py-5 text-slate-100">
        <div className="mb-4 text-sm font-medium text-slate-300">Average wait comparison</div>
        <div className="space-y-3">
          {sorted.map((result) => {
            const width = worstWait === 0 ? 0 : (result.metrics.avgWait / worstWait) * 100;
            return (
              <div key={`${result.algorithmId}-${result.algorithmName}`}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{displayAlgorithmName(result)}</span>
                  <span className="font-mono text-slate-300">
                    {result.metrics.avgWait.toFixed(2)}m
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${lowDifference ? 'bg-slate-400/70' : 'bg-sky-400'}`}
                    style={{ width: `${Math.max(width, 8)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white/5 px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-3 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function sampleJobs(jobs: Job[], limit: number) {
  if (jobs.length <= limit) {
    return jobs;
  }

  const step = Math.ceil(jobs.length / limit);
  return jobs.filter((_, index) => index % step === 0).slice(0, limit);
}

function getServerPositions(serverCount: number) {
  const centerX = 560;
  const centerY = 210;
  const radius = 150;

  return Array.from({ length: serverCount }, (_, index) => {
    const angle =
      serverCount === 1
        ? -Math.PI / 2
        : -Math.PI * 0.78 + (Math.PI * 1.56 * index) / (serverCount - 1);

    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });
}

function waitColor(waitTime: number, avgWait: number) {
  const normalized = Math.min(1, waitTime / Math.max(avgWait * 1.4, 1));

  if (normalized < 0.5) {
    return '#38bdf8';
  }

  if (normalized < 0.8) {
    return '#f59e0b';
  }

  return '#fb7185';
}

function displayAlgorithmName(result: BenchmarkRunResult) {
  if (isAlgorithmId(result.algorithmId)) {
    return getAlgorithmMeta(result.algorithmId).shortName;
  }

  return result.algorithmName;
}

function queueStructureLabel(structure: BenchmarkRunResult['queueStructure']) {
  switch (structure) {
    case 'shared':
      return 'Shared Queue';
    case 'holding':
      return 'Holding Pool';
    default:
      return 'Dedicated Queues';
  }
}
