/**
 * Holding Pool + SPT 待派池+最短处理时间优先策略
 * 客户进入待派池，窗口空闲时选择服务时间最短的客户
 */

import type { Job, BenchmarkState, SchedulingPolicy } from '../benchmark-types';

export class HoldingPoolSPTPolicy implements SchedulingPolicy {
  name = 'Holding Pool + SPT（待派池+最短处理时间）';
  queueStructure = 'holding' as const;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    // Holding pool模式下，到达时不分配服务器
    return {
      serverId: null,
      reason: '进入待派池'
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string } {
    if (state.holdingPool.length === 0) {
      return { jobId: null, reason: '待派池为空' };
    }

    // 从待派池中选择服务时间最短的任务
    let bestJob: Job | null = null;
    let minServiceTime = Infinity;

    for (const jobId of state.holdingPool) {
      const job = state.jobs.find(j => j.id === jobId);
      if (job) {
        if (job.serviceTime < minServiceTime) {
          minServiceTime = job.serviceTime;
          bestJob = job;
        } else if (job.serviceTime === minServiceTime && bestJob) {
          // tie-break 1: 到达时间更早
          if (job.arrivalTime < bestJob.arrivalTime) {
            bestJob = job;
          } else if (job.arrivalTime === bestJob.arrivalTime) {
            // tie-break 2: id更小
            if (job.id < bestJob.id) {
              bestJob = job;
            }
          }
        }
      }
    }

    if (bestJob) {
      return {
        jobId: bestJob.id,
        reason: `选择服务时间最短的任务${bestJob.id}（服务时间=${bestJob.serviceTime}分钟）`
      };
    }

    return { jobId: null, reason: '待派池为空' };
  }
}
