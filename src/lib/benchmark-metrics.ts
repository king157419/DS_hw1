/**
 * QueueLab Benchmark Metrics
 * 6个核心指标的精确计算实现
 */

import type { Job, Server, BenchmarkMetrics } from './benchmark-types';

/**
 * 计算所有benchmark指标
 */
export function calculateMetrics(
  jobs: Job[],
  servers: Server[],
  totalSimulationTime: number
): BenchmarkMetrics {
  const completedJobs = jobs.filter(j => j.status === 'completed');

  if (completedJobs.length === 0) {
    return {
      avgWait: 0,
      p95Wait: 0,
      avgStay: 0,
      serviceLevel5m: 0,
      jainFairnessWait: 1,
      utilizationStd: 0
    };
  }

  const waitTimes = completedJobs.map(j => j.startTime - j.arrivalTime);
  const stayTimes = completedJobs.map(j => j.endTime - j.arrivalTime);

  return {
    avgWait: calculateAvgWait(waitTimes),
    p95Wait: calculateP95Wait(waitTimes),
    avgStay: calculateAvgStay(stayTimes),
    serviceLevel5m: calculateServiceLevel5m(waitTimes),
    jainFairnessWait: calculateJainFairness(waitTimes),
    utilizationStd: calculateUtilizationStd(servers, totalSimulationTime)
  };
}

/**
 * 1. 平均等待时间
 * avgWait = mean(startTime - arrivalTime)
 */
function calculateAvgWait(waitTimes: number[]): number {
  if (waitTimes.length === 0) return 0;
  const sum = waitTimes.reduce((acc, t) => acc + t, 0);
  return sum / waitTimes.length;
}

/**
 * 2. 95分位等待时间
 * p95Wait = 95th percentile of waitTime
 */
function calculateP95Wait(waitTimes: number[]): number {
  if (waitTimes.length === 0) return 0;

  const sorted = [...waitTimes].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 3. 平均逗留时间
 * avgStay = mean(endTime - arrivalTime)
 */
function calculateAvgStay(stayTimes: number[]): number {
  if (stayTimes.length === 0) return 0;
  const sum = stayTimes.reduce((acc, t) => acc + t, 0);
  return sum / stayTimes.length;
}

/**
 * 4. 服务水平（5分钟内开始服务的比例）
 * serviceLevel5m = count(waitTime <= 5) / N
 */
function calculateServiceLevel5m(waitTimes: number[]): number {
  if (waitTimes.length === 0) return 0;
  const within5min = waitTimes.filter(t => t <= 5).length;
  return within5min / waitTimes.length;
}

/**
 * 5. Jain公平性指数
 *
 * 公式：
 * - 如果所有等待时间相等，返回 1
 * - 否则：fairness = (sum(wait_i))^2 / (n * sum(wait_i^2))
 *
 * 值域：[0, 1]，越接近1越公平
 *
 * 参考：Jain's Fairness Index (arXiv:cs/9809099)
 */
function calculateJainFairness(waitTimes: number[]): number {
  if (waitTimes.length === 0) return 1;

  // 检查是否所有等待时间相等
  const allEqual = waitTimes.every(t => t === waitTimes[0]);
  if (allEqual) return 1;

  const n = waitTimes.length;
  const sum = waitTimes.reduce((acc, t) => acc + t, 0);
  const sumSquares = waitTimes.reduce((acc, t) => acc + t * t, 0);

  if (sumSquares === 0) return 1;

  return (sum * sum) / (n * sumSquares);
}

/**
 * 6. 窗口负载不均衡度（利用率标准差）
 *
 * 公式：
 * - util_i = serverBusyTime_i / totalSimulationTime
 * - utilizationStd = std(util_1, util_2, ..., util_k)
 *
 * 值越小表示负载越均衡
 */
function calculateUtilizationStd(servers: Server[], totalSimulationTime: number): number {
  if (servers.length === 0 || totalSimulationTime === 0) return 0;

  const utilizations = servers.map(s => s.busyTime / totalSimulationTime);

  const mean = utilizations.reduce((acc, u) => acc + u, 0) / utilizations.length;
  const variance = utilizations.reduce((acc, u) => acc + (u - mean) ** 2, 0) / utilizations.length;

  return Math.sqrt(variance);
}

/**
 * 格式化指标用于显示
 */
export function formatMetrics(metrics: BenchmarkMetrics): Record<string, string> {
  return {
    avgWait: `${metrics.avgWait.toFixed(2)} 分钟`,
    p95Wait: `${metrics.p95Wait.toFixed(2)} 分钟`,
    avgStay: `${metrics.avgStay.toFixed(2)} 分钟`,
    serviceLevel5m: `${(metrics.serviceLevel5m * 100).toFixed(1)}%`,
    jainFairnessWait: metrics.jainFairnessWait.toFixed(3),
    utilizationStd: metrics.utilizationStd.toFixed(3)
  };
}

/**
 * 指标排序方向
 * true = 越大越好，false = 越小越好
 */
export const metricDirections: Record<keyof BenchmarkMetrics, boolean> = {
  avgWait: false,        // 越小越好
  p95Wait: false,        // 越小越好
  avgStay: false,        // 越小越好
  serviceLevel5m: true,  // 越大越好
  jainFairnessWait: true,  // 越大越好
  utilizationStd: false  // 越小越好
};

/**
 * 指标中文名称
 */
export const metricNames: Record<keyof BenchmarkMetrics, string> = {
  avgWait: '平均等待时间',
  p95Wait: '95分位等待时间',
  avgStay: '平均逗留时间',
  serviceLevel5m: '服务水平(≤5分钟)',
  jainFairnessWait: '等待公平性(Jain指数)',
  utilizationStd: '负载不均衡度'
};
