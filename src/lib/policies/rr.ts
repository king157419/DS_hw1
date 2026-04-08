/**
 * Round Robin (RR) 轮询分配策略
 * 迁移自 RoundRobinSimulation
 */

import type { Job, BenchmarkState, SchedulingPolicy } from '../benchmark-types';

export class RoundRobinPolicy implements SchedulingPolicy {
  name = 'RR（轮询分配）';
  queueStructure = 'dedicated' as const;
  private rrIndex = 0;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    const serverCount = state.servers.length;
    const serverId = state.servers[this.rrIndex % serverCount].id;
    this.rrIndex++;

    return {
      serverId,
      reason: `轮询分配到窗口${serverId}`
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string } {
    // Dedicated queues模式下，服务器从自己的队列取任务
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
