import type {
  ArrivalDecision,
  BenchmarkState,
  DispatchDecision,
  Job,
  SchedulingPolicy,
} from '../benchmark-types';

export class LeastWorkloadPolicy implements SchedulingPolicy {
  readonly id = 'lew';
  readonly name = 'LEW（最小工作量）';
  readonly queueStructure = 'dedicated' as const;

  onArrival(_job: Job, state: BenchmarkState): ArrivalDecision {
    let bestServer = state.servers[0];
    let bestWorkload = Number.POSITIVE_INFINITY;
    const candidateScores: Record<number, number> = {};

    for (const server of state.servers) {
      let workload = 0;

      if (server.currentJobId !== null) {
        const currentJob = state.jobs.find((entry) => entry.id === server.currentJobId);
        if (currentJob) {
          workload += Math.max(0, currentJob.endTime - state.currentTime);
        }
      }

      for (const queuedJobId of server.queueJobIds) {
        const queuedJob = state.jobs.find((entry) => entry.id === queuedJobId);
        if (queuedJob) {
          workload += queuedJob.serviceTime;
        }
      }

      candidateScores[server.id] = workload;

      if (
        workload < bestWorkload ||
        (workload === bestWorkload && server.id < bestServer.id)
      ) {
        bestServer = server;
        bestWorkload = workload;
      }
    }

    return {
      serverId: bestServer.id,
      reason: `选择剩余工作量最小的窗口 ${bestServer.id}（工作量 ${bestWorkload.toFixed(1)}）`,
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
