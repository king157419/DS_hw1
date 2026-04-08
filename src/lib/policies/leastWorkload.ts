/**
 * Least Workload (LEW) 最短预期等待策略
 * 迁移自 LeastExpectedWaitSimulation
 */

import type { Job, BenchmarkState, SchedulingPolicy } from '../benchmark-types';

export class LeastWorkloadPolicy implements SchedulingPolicy {
  name = 'LEW（最短预期等待）';
  queueStructure = 'dedicated' as const;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    let bestServer = state.servers[0];
    let bestWorkload = Infinity;

    const candidateScores: Record<number, number> = {};

    for (const server of state.servers) {
      // 计算预期工作量 = 当前任务剩余时间 + 队列中所有任务的服务时间
      let workload = 0;

      // 当前任务剩余时间
      if (server.currentJobId !== null) {
        const currentJob = state.jobs.find(j => j.id === server.currentJobId);
        if (currentJob) {
          const remaining = Math.max(0, currentJob.endTime - state.currentTime);
          workload += remaining;
        }
      }

      // 队列中任务的服务时间总和
      for (const jobId of server.queueJobIds) {
        const queuedJob = state.jobs.find(j => j.id === jobId);
        if (queuedJob) {
          workload += queuedJob.serviceTime;
        }
      }

      candidateScores[server.id] = workload;

      if (workload < bestWorkload) {
        bestWorkload = workload;
        bestServer = server;
      } else if (workload === bestWorkload && server.id < bestServer.id) {
        // tie-break: 选择id更小的
        bestServer = server;
      }
    }

    return {
      serverId: bestServer.id,
      reason: `选择预期工作量最小的窗口${bestServer.id}（工作量=${bestWorkload.toFixed(1)}分钟）`
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string } {
    const server = state.servers.find(s => s.id === serverId);
    if (server && server.queueJobIds.length > 0) {
      return {
        jobId: server.queueJobIds[0],
        reason: '从本窗口队列取队首'
      };
    }
    return { jobId: null, reason: '队列为空' };
  }
}
