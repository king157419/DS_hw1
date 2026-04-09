import type { BenchmarkState, Job, SchedulingPolicy } from '../benchmark-types';

export class HoldingPoolSPTPolicy implements SchedulingPolicy {
  id = 'holding_pool_spt';
  name = 'Holding Pool + SPT';
  queueStructure = 'holding' as const;

  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string } {
    void job;
    void state;

    return {
      serverId: null,
      reason: 'Job enters the holding pool and waits for dispatch.',
    };
  }

  onServerIdle(
    serverId: number,
    state: BenchmarkState
  ): { jobId: number | null; reason: string } {
    void serverId;

    if (state.holdingPool.length === 0) {
      return { jobId: null, reason: 'Holding pool is empty.' };
    }

    let bestJob: Job | null = null;
    let shortestServiceTime = Infinity;

    for (const jobId of state.holdingPool) {
      const job = state.jobs.find((entry) => entry.id === jobId);
      if (!job) {
        continue;
      }

      if (job.serviceTime < shortestServiceTime) {
        shortestServiceTime = job.serviceTime;
        bestJob = job;
      } else if (job.serviceTime === shortestServiceTime && bestJob) {
        if (job.arrivalTime < bestJob.arrivalTime) {
          bestJob = job;
        } else if (job.arrivalTime === bestJob.arrivalTime && job.id < bestJob.id) {
          bestJob = job;
        }
      }
    }

    if (!bestJob) {
      return { jobId: null, reason: 'Holding pool is empty.' };
    }

    return {
      jobId: bestJob.id,
      reason: `Select the shortest service-time job ${bestJob.id} (${bestJob.serviceTime} min).`,
    };
  }
}
