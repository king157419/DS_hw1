import type { BenchmarkState, Job, SchedulingPolicy } from '../benchmark-types';

export class RoundRobinPolicy implements SchedulingPolicy {
  id = 'rr';
  name = 'RR - Round Robin';
  queueStructure = 'dedicated' as const;
  private rrIndex = 0;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    void job;

    const serverCount = state.servers.length;
    const serverId = state.servers[this.rrIndex % serverCount].id;
    this.rrIndex += 1;

    return {
      serverId,
      reason: `Round-robin pointer selected window ${serverId}.`,
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string } {
    const server = state.servers.find((entry) => entry.id === serverId);
    if (server && server.queueJobIds.length > 0) {
      return {
        jobId: server.queueJobIds[0],
        reason: 'Take the next job from the local queue.',
      };
    }

    return { jobId: null, reason: 'Local queue is empty.' };
  }
}
