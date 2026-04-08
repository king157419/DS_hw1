/**
 * Single Queue FCFS 单队列先来先服务策略
 * 所有客户进入一条共享队列，窗口空闲时取队首
 */

import type { Job, BenchmarkState, SchedulingPolicy } from '../benchmark-types';

export class SingleQueueFCFSPolicy implements SchedulingPolicy {
  name = 'Single Queue FCFS（单队列先来先服务）';
  queueStructure = 'shared' as const;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    // Shared queue模式下，到达时不分配服务器
    return {
      serverId: null,
      reason: '进入共享队列'
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string } {
    // 从共享队列取队首
    if (state.sharedQueue.length > 0) {
      const jobId = state.sharedQueue[0];
      return {
        jobId,
        reason: `从共享队列取队首任务${jobId}`
      };
    }
    return { jobId: null, reason: '共享队列为空' };
  }
}
