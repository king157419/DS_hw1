import type { BenchmarkRunResult } from '@/lib/benchmark-types';
import { getAlgorithmMeta, isAlgorithmId } from '@/lib/benchmark-registry';

interface MetricsComparisonPanelProps {
  results: BenchmarkRunResult[];
}

const metricConfig = [
  { key: 'avgWait', label: 'Average Wait', higherIsBetter: false, format: fixed2 },
  { key: 'p95Wait', label: 'P95 Wait', higherIsBetter: false, format: fixed2 },
  { key: 'avgStay', label: 'Average Stay', higherIsBetter: false, format: fixed2 },
  { key: 'serviceLevel5m', label: 'Service Level <= 5m', higherIsBetter: true, format: percent1 },
  { key: 'jainFairnessWait', label: 'Jain Fairness', higherIsBetter: true, format: fixed3 },
  { key: 'utilizationStd', label: 'Utilization Std', higherIsBetter: false, format: fixed3 },
  { key: 'maxQueueLength', label: 'Max Queue Length', higherIsBetter: false, format: fixed2 },
  { key: 'maxWait', label: 'Max Wait', higherIsBetter: false, format: fixed2 },
  { key: 'starvedCount', label: 'Starved Customers', higherIsBetter: false, format: fixed2 },
] as const;

export default function MetricsComparisonPanel({ results }: MetricsComparisonPanelProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400">
        Run a comparison to see the metric table.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Metric</th>
            {results.map((result) => (
              <th
                key={`${result.algorithmId}-${result.algorithmName}`}
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
                    {metric.higherIsBetter ? 'higher is better' : 'lower is better'}
                  </span>
                </td>
                {results.map((result) => {
                  const value = result.metrics[metric.key];
                  const isBest = value === bestValue;

                  return (
                    <td
                      key={`${result.algorithmId}-${metric.key}`}
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
