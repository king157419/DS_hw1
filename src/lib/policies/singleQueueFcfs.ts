import type { BenchmarkState, Job, SchedulingPolicy } from '../benchmark-types';

export class SingleQueueFCFSPolicy implements SchedulingPolicy {
  id = 'single_queue_fcfs';
  name = 'Single Queue FCFS';
  queueStructure = 'shared' as const;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    void job;
    void state;

    return {
      serverId: null,
      reason: 'Job enters the shared queue and waits for the next idle window.',
    };
  }

  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string } {
    void serverId;

    if (state.sharedQueue.length > 0) {
      return {
        jobId: state.sharedQueue[0],
        reason: `Take the shared queue head job ${state.sharedQueue[0]}.`,
      };
    }

    return { jobId: null, reason: 'Shared queue is empty.' };
  }
}
