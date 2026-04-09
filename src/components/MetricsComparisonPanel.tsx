import React from 'react';
import type { BenchmarkRunResult } from '@/lib/benchmark-types';
import { getAlgorithmMeta, isAlgorithmId } from '@/lib/benchmark-registry';

interface MetricsComparisonPanelProps {
  results: BenchmarkRunResult[];
}

const metricConfig = [
  { key: 'avgWait', label: '平均等待时间', higherIsBetter: false, format: fixed2 },
  { key: 'p95Wait', label: 'P95 等待时间', higherIsBetter: false, format: fixed2 },
  { key: 'avgStay', label: '平均逗留时间', higherIsBetter: false, format: fixed2 },
  { key: 'serviceLevel5m', label: '5 分钟内开始服务比例', higherIsBetter: true, format: percent1 },
  { key: 'jainFairnessWait', label: '等待公平性 Jain', higherIsBetter: true, format: fixed3 },
  { key: 'utilizationStd', label: '窗口利用率离散度', higherIsBetter: false, format: fixed3 },
  { key: 'maxQueueLength', label: '峰值队列长度', higherIsBetter: false, format: fixed2 },
  { key: 'maxWait', label: '最大等待时间', higherIsBetter: false, format: fixed2 },
  { key: 'starvedCount', label: '饥饿客户数', higherIsBetter: false, format: fixed2 },
] as const;

export default function MetricsComparisonPanel({ results }: MetricsComparisonPanelProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400">
        运行多算法对比后，这里会显示指标表。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left font-semibold text-slate-700">指标</th>
            {results.map((result) => (
              <th
                key={result.algorithmId ?? result.algorithmName}
                className="px-4 py-3 text-center font-semibold text-slate-700"
              >
                {getAlgorithmLabel(result)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metricConfig.map((metric) => {
            const values = results.map((result) => result.metrics[metric.key]);
            const bestValue = metric.higherIsBetter ? Math.max(...values) : Math.min(...values);

            return (
              <tr key={metric.key} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-700">
                  {metric.label}
                  <span className="ml-2 text-xs text-slate-400">
                    {metric.higherIsBetter ? '越高越好' : '越低越好'}
                  </span>
                </td>
                {results.map((result) => {
                  const value = result.metrics[metric.key];
                  const isBest = value === bestValue;

                  return (
                    <td
                      key={`${result.algorithmId ?? result.algorithmName}-${metric.key}`}
                      className={`px-4 py-3 text-center font-mono ${
                        isBest ? 'bg-emerald-50 font-bold text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {metric.format(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fixed2(value: number) {
  return value.toFixed(2);
}

function fixed3(value: number) {
  return value.toFixed(3);
}

function percent1(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function getAlgorithmLabel(result: BenchmarkRunResult) {
  if (isAlgorithmId(result.algorithmId)) {
    return getAlgorithmMeta(result.algorithmId).shortName;
  }

  return result.algorithmName;
}
