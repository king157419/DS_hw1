'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  BenchmarkRunResult,
  BenchmarkState,
  Difficulty,
  Differentiation,
  RecommendedFor,
} from '@/lib/benchmark-types';
import {
  getAllAlgorithmMetas,
  getDefaultPresetId,
  type AlgorithmId,
  type PresetId,
} from '@/lib/benchmark-registry';

const P5QueueVisualization = dynamic(() => import('@/components/P5QueueVisualization'), {
  ssr: false,
});
const BenchmarkStatusBar = dynamic(() => import('@/components/BenchmarkStatusBar'), {
  ssr: false,
});
const MetricsComparisonPanel = dynamic(
  () => import('@/components/MetricsComparisonPanel'),
  { ssr: false },
);
const DecisionAuditPanel = dynamic(() => import('@/components/DecisionAuditPanel'), {
  ssr: false,
});
const MiniTrendPanel = dynamic(() => import('@/components/MiniTrendPanel'), {
  ssr: false,
});
const AlgorithmicArt = dynamic(() => import('@/components/AlgorithmicArt'), {
  ssr: false,
});

interface PresetOption {
  id: PresetId;
  name: string;
  description: string;
  serverCount: number;
  jobCount: number;
  differentiation: Differentiation;
  difficulty: Difficulty;
  recommendedFor: RecommendedFor;
}

const ALGORITHM_METAS = getAllAlgorithmMetas();
const DEFAULT_VISUALIZATION_ALGORITHM_ID: AlgorithmId = 'jsq';
const DEFAULT_COMPARISON_ALGORITHM_IDS: AlgorithmId[] = ['jsq', 'rr', 'lew'];

export default function Home() {
  const [screen, setScreen] = useState<'config' | 'results'>('config');
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<PresetId>(getDefaultPresetId());

  const [visualizationAlgorithmId, setVisualizationAlgorithmId] =
    useState<AlgorithmId>(DEFAULT_VISUALIZATION_ALGORITHM_ID);
  const [comparisonAlgorithmIds, setComparisonAlgorithmIds] = useState<AlgorithmId[]>(
    DEFAULT_COMPARISON_ALGORITHM_IDS,
  );

  const [singleResult, setSingleResult] = useState<BenchmarkRunResult | null>(null);
  const [singlePresetId, setSinglePresetId] = useState<PresetId | null>(null);
  const [comparisonResults, setComparisonResults] = useState<BenchmarkRunResult[]>([]);
  const [comparisonPresetId, setComparisonPresetId] = useState<PresetId | null>(null);

  const [loading, setLoading] = useState<'single' | 'compare' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    void loadPresets();
  }, []);

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const singlePreset = presets.find((preset) => preset.id === singlePresetId);
  const comparisonPreset = presets.find((preset) => preset.id === comparisonPresetId);
  const currentSnapshot = getSnapshotAtTime(singleResult?.snapshots ?? [], currentTime);

  async function loadPresets() {
    try {
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'benchmarkPresets' }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load presets.');
      }

      setPresets(data.presets as PresetOption[]);
    } catch (loadError) {
      console.error(loadError);
      setError('预设场景加载失败，请刷新后重试。');
    }
  }

  async function runSingleVisualization() {
    setLoading('single');
    setError(null);

    try {
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'benchmarkSingle',
          data: {
            presetId: selectedPresetId,
            algorithmId: visualizationAlgorithmId,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Single benchmark failed.');
      }

      setSingleResult(data.result as BenchmarkRunResult);
      setSinglePresetId(selectedPresetId);
      resetPlayback();
      setScreen('results');
    } catch (runError) {
      console.error(runError);
      setError(runError instanceof Error ? runError.message : '运行单算法动画失败。');
    } finally {
      setLoading(null);
    }
  }

  async function runComparison() {
    if (comparisonAlgorithmIds.length === 0) {
      setError('请至少选择一个算法进行对比。');
      return;
    }

    setLoading('compare');
    setError(null);

    try {
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'benchmarkCompare',
          data: {
            presetId: selectedPresetId,
            algorithmIds: comparisonAlgorithmIds,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Benchmark comparison failed.');
      }

      setComparisonResults(data.results as BenchmarkRunResult[]);
      setComparisonPresetId(selectedPresetId);
      setScreen('results');
    } catch (runError) {
      console.error(runError);
      setError(runError instanceof Error ? runError.message : '运行多算法对比失败。');
    } finally {
      setLoading(null);
    }
  }

  function toggleComparisonAlgorithm(algorithmId: AlgorithmId) {
    setComparisonAlgorithmIds((currentIds) =>
      currentIds.includes(algorithmId)
        ? currentIds.filter((id) => id !== algorithmId)
        : [...currentIds, algorithmId],
    );
  }

  function resetPlayback() {
    setIsPlaying(false);
    setCurrentTime(0);
    setSpeed(1);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_32%),linear-gradient(180deg,#eff6ff_0%,#eef2ff_45%,#f8fafc_100%)] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <div className="inline-flex rounded-full bg-white/90 px-4 py-1 text-sm font-medium text-slate-600 shadow-sm">
            QueueLab · 银行队列调度实验平台
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
            Benchmark 视图补完版
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-slate-600">
            单算法动画和多算法分析已经拆成两条独立链路，解释性、趋势与 preset 标签也统一到 id contract。
          </p>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {screen === 'config' ? (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-slate-900">1. 选择实验场景</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    所有 selector 和 API 都只用 presetId / algorithmId，不再依赖显示名匹配。
                  </p>
                </div>

                <div className="w-full max-w-xl">
                  <select
                    value={selectedPresetId}
                    onChange={(event) => setSelectedPresetId(event.target.value as PresetId)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPreset ? (
                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-[24px] bg-slate-50 p-5">
                    <div className="text-lg font-semibold text-slate-900">{selectedPreset.name}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {selectedPreset.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {getPresetTags(selectedPreset).map((tag) => (
                        <span
                          key={tag.label}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">场景规模</div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <PresetStat label="窗口数" value={`${selectedPreset.serverCount}`} />
                      <PresetStat label="客户数" value={`${selectedPreset.jobCount}`} />
                      <PresetStat label="难度" value={difficultyLabel(selectedPreset.difficulty)} />
                      <PresetStat label="差异度" value={differentiationLabel(selectedPreset.differentiation)} />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">2. 单算法动画</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  这里只会调用 <code className="rounded bg-slate-100 px-1 py-0.5">benchmarkSingle</code>。
                </p>

                <div className="mt-5 space-y-3">
                  {ALGORITHM_METAS.map((meta) => (
                    <label
                      key={meta.id}
                      className={`flex cursor-pointer items-start rounded-[22px] border px-4 py-4 transition ${
                        visualizationAlgorithmId === meta.id
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visualization-algorithm"
                        value={meta.id}
                        checked={visualizationAlgorithmId === meta.id}
                        onChange={() => setVisualizationAlgorithmId(meta.id)}
                        className="mt-1"
                      />
                      <div className="ml-3">
                        <div className="font-medium text-slate-900">{meta.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{meta.description}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={runSingleVisualization}
                  disabled={loading !== null}
                  className="mt-5 w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading === 'single' ? '正在运行单算法动画…' : '运行单算法动画'}
                </button>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">3. 多算法对比</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  这里只会调用 <code className="rounded bg-slate-100 px-1 py-0.5">benchmarkCompare</code>，不会再默认拿第一个结果画动画。
                </p>

                <div className="mt-5 space-y-3">
                  {ALGORITHM_METAS.map((meta) => (
                    <label
                      key={meta.id}
                      className={`flex cursor-pointer items-start rounded-[22px] border px-4 py-4 transition ${
                        comparisonAlgorithmIds.includes(meta.id)
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={comparisonAlgorithmIds.includes(meta.id)}
                        onChange={() => toggleComparisonAlgorithm(meta.id)}
                        className="mt-1"
                      />
                      <div className="ml-3">
                        <div className="font-medium text-slate-900">{meta.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{meta.description}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={runComparison}
                  disabled={loading !== null || comparisonAlgorithmIds.length === 0}
                  className="mt-5 w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading === 'compare'
                    ? '正在运行多算法对比…'
                    : `运行对比（${comparisonAlgorithmIds.length} 个算法）`}
                </button>
              </section>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setScreen('config')}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                返回配置
              </button>

              <div className="flex flex-wrap gap-2">
                {singlePreset ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    单算法场景：{singlePreset.name}
                  </span>
                ) : null}
                {comparisonPreset ? (
                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    对比场景：{comparisonPreset.name}
                  </span>
                ) : null}
              </div>
            </div>

            {singleResult ? (
              <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">主动画区</h2>
                    <p className="mt-1 text-sm text-slate-500">页面层只保留这一处 P5 动画挂载。</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    {singleResult.algorithmName}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="min-w-0">
                    <P5QueueVisualization
                      result={singleResult}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      speed={speed}
                      onPlayingChange={setIsPlaying}
                      onSpeedChange={setSpeed}
                      onTimeChange={setCurrentTime}
                      showHud
                    />
                  </div>

                  <div className="space-y-4">
                    <BenchmarkStatusBar
                      state={currentSnapshot}
                      algorithmName={singleResult.algorithmName}
                      isPlaying={isPlaying}
                      speed={speed}
                    />
                    <MiniTrendPanel
                      snapshots={singleResult.snapshots}
                      currentTime={currentTime}
                    />
                    <DecisionAuditPanel
                      decisions={singleResult.decisions}
                      currentTime={currentTime}
                    />
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
                当前还没有单算法动画结果。运行一次单算法动画后，这里才会挂载主动画区。
              </section>
            )}

            {comparisonResults.length > 0 ? (
              <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-2xl font-semibold text-slate-900">多算法分析</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    这部分只消费 <code className="rounded bg-slate-100 px-1 py-0.5">benchmarkCompare</code> 的结果。
                  </p>
                </div>
                <MetricsComparisonPanel results={comparisonResults} />
              </section>
            ) : null}

            {singleResult || comparisonResults.length > 0 ? (
              <AlgorithmicArt
                singleResult={singleResult}
                comparisonResults={comparisonResults}
                initialMode={singleResult ? 'flow' : 'compare'}
              />
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function getSnapshotAtTime(
  snapshots: BenchmarkState[],
  currentTime: number,
): BenchmarkState | null {
  if (snapshots.length === 0) {
    return null;
  }

  let activeSnapshot = snapshots[0];

  for (const snapshot of snapshots) {
    if (snapshot.currentTime <= currentTime) {
      activeSnapshot = snapshot;
    } else {
      break;
    }
  }

  return activeSnapshot;
}

function getPresetTags(preset: PresetOption) {
  return [
    {
      label: recommendedForLabel(preset.recommendedFor),
      className:
        preset.recommendedFor === 'demo'
          ? 'bg-sky-100 text-sky-700'
          : preset.recommendedFor === 'fairness'
            ? 'bg-fuchsia-100 text-fuchsia-700'
            : 'bg-slate-100 text-slate-700',
    },
    {
      label: differentiationTag(preset.differentiation),
      className:
        preset.differentiation === 'strong'
          ? 'bg-emerald-100 text-emerald-700'
          : preset.differentiation === 'medium'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-700',
    },
  ];
}

function PresetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function recommendedForLabel(value: RecommendedFor) {
  switch (value) {
    case 'demo':
      return '推荐演示';
    case 'fairness':
      return '公平性观察';
    default:
      return '基础校验';
  }
}

function differentiationTag(value: Differentiation) {
  switch (value) {
    case 'strong':
      return '差异明显';
    case 'medium':
      return '差异适中';
    default:
      return '差异较小';
  }
}

function difficultyLabel(value: Difficulty) {
  switch (value) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    default:
      return '低';
  }
}

function differentiationLabel(value: Differentiation) {
  switch (value) {
    case 'strong':
      return '明显';
    case 'medium':
      return '中等';
    default:
      return '较弱';
  }
}
