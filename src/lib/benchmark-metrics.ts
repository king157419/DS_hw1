import type {
  BenchmarkMetrics,
  BenchmarkState,
  Job,
  Server,
} from './benchmark-types';

export function calculateMetrics(
  jobs: Job[],
  servers: Server[],
  totalSimulationTime: number,
  snapshots: BenchmarkState[] = [],
): BenchmarkMetrics {
  const completedJobs = jobs.filter((job) => job.status === 'completed');

  if (completedJobs.length === 0) {
    return {
      avgWait: 0,
      p95Wait: 0,
      avgStay: 0,
      serviceLevel5m: 0,
      jainFairnessWait: 1,
      utilizationStd: 0,
      maxQueueLength: 0,
      maxWait: 0,
      starvedCount: 0,
    };
  }

  const waitTimes = completedJobs.map((job) => job.startTime - job.arrivalTime);
  const stayTimes = completedJobs.map((job) => job.endTime - job.arrivalTime);

  return {
    avgWait: average(waitTimes),
    p95Wait: percentile(waitTimes, 0.95),
    avgStay: average(stayTimes),
    serviceLevel5m: waitTimes.filter((wait) => wait <= 5).length / waitTimes.length,
    jainFairnessWait: calculateJainFairness(waitTimes),
    utilizationStd: calculateUtilizationStd(servers, totalSimulationTime),
    maxQueueLength: calculateMaxQueueLength(snapshots),
    maxWait: Math.max(...waitTimes),
    starvedCount: waitTimes.filter((wait) => wait > 10).length,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function calculateJainFairness(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  const sumSquares = values.reduce((total, value) => total + value * value, 0);

  if (sumSquares === 0) {
    return 1;
  }

  return (sum * sum) / (values.length * sumSquares);
}

function calculateUtilizationStd(
  servers: Server[],
  totalSimulationTime: number,
): number {
  if (servers.length === 0 || totalSimulationTime <= 0) {
    return 0;
  }

  const utilizations = servers.map((server) => server.busyTime / totalSimulationTime);
  const mean = average(utilizations);
  const variance =
    utilizations.reduce((total, utilization) => total + (utilization - mean) ** 2, 0) /
    utilizations.length;

  return Math.sqrt(variance);
}

function calculateMaxQueueLength(snapshots: BenchmarkState[]): number {
  if (snapshots.length === 0) {
    return 0;
  }

  return snapshots.reduce((maxQueue, snapshot) => {
    const dedicatedMax = snapshot.servers.reduce(
      (serverMax, server) => Math.max(serverMax, server.queueJobIds.length),
      0,
    );

    return Math.max(
      maxQueue,
      dedicatedMax,
      snapshot.sharedQueue.length,
      snapshot.holdingPool.length,
    );
  }, 0);
}

export function formatMetrics(metrics: BenchmarkMetrics): Record<string, string> {
  return {
    avgWait: `${metrics.avgWait.toFixed(2)} min`,
    p95Wait: `${metrics.p95Wait.toFixed(2)} min`,
    avgStay: `${metrics.avgStay.toFixed(2)} min`,
    serviceLevel5m: `${(metrics.serviceLevel5m * 100).toFixed(1)}%`,
    jainFairnessWait: metrics.jainFairnessWait.toFixed(3),
    utilizationStd: metrics.utilizationStd.toFixed(3),
    maxQueueLength: `${metrics.maxQueueLength}`,
    maxWait: `${metrics.maxWait.toFixed(2)} min`,
    starvedCount: `${metrics.starvedCount}`,
  };
}

export const metricDirections: Record<keyof BenchmarkMetrics, boolean> = {
  avgWait: false,
  p95Wait: false,
  avgStay: false,
  serviceLevel5m: true,
  jainFairnessWait: true,
  utilizationStd: false,
  maxQueueLength: false,
  maxWait: false,
  starvedCount: false,
};

export const metricNames: Record<keyof BenchmarkMetrics, string> = {
  avgWait: '平均等待时间',
  p95Wait: 'P95 等待时间',
  avgStay: '平均逗留时间',
  serviceLevel5m: '5 分钟内开始服务比例',
  jainFairnessWait: '等待公平性（Jain）',
  utilizationStd: '窗口负载离散度',
  maxQueueLength: '峰值排队长度',
  maxWait: '最大等待时间',
  starvedCount: '等待超过 10 分钟人数',
};
