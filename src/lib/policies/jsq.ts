/**
 * Join the Shortest Queue (JSQ) 最短队列优先策略
 * 迁移自 BankSimulation（基础版）
 */

import type { Job, BenchmarkState, SchedulingPolicy } from '../benchmark-types';

export class JSQPolicy implements SchedulingPolicy {
  name = 'JSQ（最短队列优先）';
  queueStructure = 'dedicated' as const;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    // 找到队列最短的服务器
    let shortestServer = state.servers[0];
    let minQueueLength = shortestServer.queueJobIds.length + (shortestServer.currentJobId ? 1 : 0);

    const candidateScores: Record<number, number> = {};

    for (const server of state.servers) {
      const queueLength = server.queueJobIds.length + (server.currentJobId ? 1 : 0);
      candidateScores[server.id] = queueLength;

      if (queueLength < minQueueLength) {
        minQueueLength = queueLength;
        shortestServer = server;
      } else if (queueLength === minQueueLength && server.id < shortestServer.id) {
        // tie-break: 选择id更小的
        shortestServer = server;
      }
    }

    return {
      serverId: shortestServer.id,
      reason: `选择队列最短的窗口${shortestServer.id}（队列长度=${minQueueLength}）`
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
