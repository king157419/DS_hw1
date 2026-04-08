/**
 * Metrics Comparison Panel
 * 显示多个算法的指标对比
 */

import React from 'react';
import type { BenchmarkRunResult } from '@/lib/benchmark-types';
import { metricNames, metricDirections } from '@/lib/benchmark-metrics';

interface MetricsComparisonPanelProps {
  results: BenchmarkRunResult[];
}

export default function MetricsComparisonPanel({ results }: MetricsComparisonPanelProps) {
  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
        运行算法对比后查看指标
      </div>
    );
  }

  const metrics = Object.keys(results[0].metrics) as Array<keyof typeof results[0]['metrics']>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">指标对比</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">指标</th>
              {results.map((result, index) => (
                <th key={index} className="text-center py-2 px-3 font-semibold text-gray-700">
                  {result.algorithmName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const values = results.map(r => r.metrics[metric]);
              const isBetter = metricDirections[metric];
              const bestValue = isBetter
                ? Math.max(...values)
                : Math.min(...values);

              return (
                <tr key={metric} className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-700">
                    {metricNames[metric]}
                    <span className="text-xs text-gray-400 ml-1">
                      ({isBetter ? '↑' : '↓'})
                    </span>
                  </td>
                  {results.map((result, index) => {
                    const value = result.metrics[metric];
                    const isBest = value === bestValue;

                    return (
                      <td
                        key={index}
                        className={`text-center py-2 px-3 font-mono ${
                          isBest ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-600'
                        }`}
                      >
                        {formatMetricValue(metric, value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === 'serviceLevel5m') {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (metric === 'jainFairnessWait' || metric === 'utilizationStd') {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}
