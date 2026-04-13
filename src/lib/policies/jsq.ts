import type {
  ArrivalDecision,
  BenchmarkState,
  DispatchDecision,
  Job,
  SchedulingPolicy,
} from '../benchmark-types';

export class JSQPolicy implements SchedulingPolicy {
  readonly id = 'jsq';
  readonly name = 'JSQ（最短队列优先）';
  readonly queueStructure = 'dedicated' as const;

  onArrival(_job: Job, state: BenchmarkState): ArrivalDecision {
    let bestServer = state.servers[0];
    let bestQueueLength = Number.POSITIVE_INFINITY;
    const candidateScores: Record<number, number> = {};

    for (const server of state.servers) {
      const queueLength =
        server.queueJobIds.length + (server.currentJobId === null ? 0 : 1);
      candidateScores[server.id] = queueLength;

      if (
        queueLength < bestQueueLength ||
        (queueLength === bestQueueLength && server.id < bestServer.id)
      ) {
        bestServer = server;
        bestQueueLength = queueLength;
      }
    }

    return {
      serverId: bestServer.id,
      reason: `选择总队长最短的窗口 ${bestServer.id}（当前负载 ${bestQueueLength}）`,
      candidateScores,
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): DispatchDecision {
    const server = state.servers.find((entry) => entry.id === serverId);
    if (!server || server.queueJobIds.length === 0) {
      return { jobId: null, reason: '当前窗口没有排队客户' };
    }

    return {
      jobId: server.queueJobIds[0],
      reason: `窗口 ${serverId} 从本地队列取队首客户`,
    };
  }
}
