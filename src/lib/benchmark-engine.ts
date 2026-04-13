import type {
  BenchmarkConfig,
  BenchmarkRunResult,
  BenchmarkState,
  DecisionReason,
  Job,
  PlaybackEvent,
  PlaybackFrame,
  PlaybackQueueId,
  QueueStructureKind,
  Server,
  TimelineEvent,
} from './benchmark-types';
import { calculateMetrics } from './benchmark-metrics';
import { EventPriorityQueue, type Event } from './data-structures/event-priority-queue';

export class BenchmarkEngine {
  private currentTime = 0;
  private eventSequence = 0;

  private readonly jobs: Job[] = [];
  private readonly servers: Server[] = [];
  private readonly sharedQueue: number[] = [];
  private readonly holdingPool: number[] = [];
  private readonly events = new EventPriorityQueue();
  private readonly timeline: TimelineEvent[] = [];
  private readonly decisions: DecisionReason[] = [];
  private readonly snapshots: BenchmarkState[] = [];
  private readonly playbackFrames: PlaybackFrame[] = [];
  private readonly playbackEvents: PlaybackEvent[] = [];

  private readonly policy: BenchmarkConfig['policy'];
  private readonly queueStructure: QueueStructureKind;

  constructor(config: BenchmarkConfig) {
    this.policy = config.policy;
    this.queueStructure = config.policy.queueStructure;

    for (let index = 0; index < config.serverCount; index += 1) {
      this.servers.push({
        id: index + 1,
        busyUntil: 0,
        currentJobId: null,
        queueJobIds: [],
        busyTime: 0,
        idleTime: 0,
      });
    }

    config.jobs.forEach((jobData, index) => {
      const job: Job = {
        id: index + 1,
        arrivalTime: jobData.arrivalTime,
        serviceTime: jobData.serviceTime,
        startTime: -1,
        endTime: -1,
        assignedServerId: -1,
        status: 'waiting',
        queueEnterTime: -1,
        holdingEnterTime: -1,
      };

      this.jobs.push(job);
      this.enqueueEvent({
        time: job.arrivalTime,
        type: 'arrival',
        jobId: job.id,
      });
    });
  }

  run(): BenchmarkRunResult {
    this.recordSnapshot();
    this.recordPlaybackFrame('arrival', 'Simulation ready');

    while (!this.events.isEmpty()) {
      const event = this.events.poll();
      if (!event) {
        break;
      }

      this.currentTime = event.time;

      if (event.type === 'arrival' && event.jobId !== undefined) {
        this.handleArrival(event.jobId);
      }

      if (event.type === 'departure' && event.serverId !== undefined) {
        this.handleDeparture(event.serverId);
      }

      const lastTimelineEvent = this.timeline[this.timeline.length - 1];
      const playbackEventType =
        lastTimelineEvent?.type === 'start_service'
          ? 'start_service'
          : event.type === 'departure'
            ? 'departure'
            : 'arrival';

      this.recordSnapshot();
      this.recordPlaybackFrame(
        playbackEventType,
        lastTimelineEvent?.description ?? `${event.type} @ ${this.currentTime.toFixed(1)}`,
      );
    }

    const totalSimulationTime = Math.max(0, ...this.jobs.map((job) => job.endTime));
    const metrics = calculateMetrics(
      this.jobs,
      this.servers,
      totalSimulationTime,
      this.snapshots,
    );

    return {
      algorithmId: this.policy.id,
      algorithmName: this.policy.name,
      queueStructure: this.queueStructure,
      metrics,
      timeline: [...this.timeline],
      snapshots: [...this.snapshots],
      decisions: [...this.decisions],
      jobs: this.cloneJobs(),
      servers: this.cloneServers(),
      playbackFrames: [...this.playbackFrames],
      playbackEvents: this.playbackEvents.map((event) => ({ ...event })),
    };
  }

  private handleArrival(jobId: number): void {
    const job = this.getJob(jobId);
    if (!job) {
      return;
    }

    this.recordPlaybackEvent({
      type: 'arrival',
      at: this.currentTime,
      customerId: job.id,
    });

    const decision = this.policy.onArrival(job, this.captureState());
    this.recordDecision(job.id, decision.serverId, 'arrival', decision.reason, decision.candidateScores);

    if (this.queueStructure === 'dedicated') {
      this.handleDedicatedArrival(job, decision.serverId);
      return;
    }

    if (this.queueStructure === 'shared') {
      job.queueEnterTime = this.currentTime;
      this.sharedQueue.push(job.id);
      this.recordPlaybackEvent({
        type: 'join_queue',
        at: this.currentTime,
        customerId: job.id,
        queueId: 'shared-main',
        position: this.sharedQueue.length - 1,
      });
      this.timeline.push({
        time: this.currentTime,
        type: 'arrival',
        jobId: job.id,
        description: `Customer ${job.id} joined the shared queue.`,
      });

      const idleServer = this.servers.find((server) => server.currentJobId === null);
      if (idleServer) {
        this.dispatchFromSharedQueue(idleServer);
      }
      return;
    }

    job.holdingEnterTime = this.currentTime;
    this.holdingPool.push(job.id);
    this.recordPlaybackEvent({
      type: 'join_queue',
      at: this.currentTime,
      customerId: job.id,
      queueId: 'holding-main',
      position: this.holdingPool.length - 1,
    });
    this.timeline.push({
      time: this.currentTime,
      type: 'arrival',
      jobId: job.id,
      description: `Customer ${job.id} entered the holding pool.`,
    });

    const idleServer = this.servers.find((server) => server.currentJobId === null);
    if (idleServer) {
      this.dispatchFromHoldingPool(idleServer);
    }
  }

  private handleDedicatedArrival(job: Job, serverId: number | null): void {
    if (serverId === null) {
      return;
    }

    const server = this.getServer(serverId);
    if (!server) {
      return;
    }

    if (server.currentJobId === null) {
      this.timeline.push({
        time: this.currentTime,
        type: 'arrival',
        jobId: job.id,
        serverId: server.id,
        description: `Customer ${job.id} arrived and immediately started at window ${server.id}.`,
      });
      this.startService(job, server);
      return;
    }

    job.queueEnterTime = this.currentTime;
    server.queueJobIds.push(job.id);
    this.recordPlaybackEvent({
      type: 'join_queue',
      at: this.currentTime,
      customerId: job.id,
      queueId: this.serverQueueId(server.id),
      position: server.queueJobIds.length - 1,
      serverId: server.id,
    });
    this.timeline.push({
      time: this.currentTime,
      type: 'arrival',
      jobId: job.id,
      serverId: server.id,
      description: `Customer ${job.id} joined window ${server.id}'s queue.`,
    });
  }

  private handleDeparture(serverId: number): void {
    const server = this.getServer(serverId);
    if (!server || server.currentJobId === null) {
      return;
    }

    const job = this.getJob(server.currentJobId);
    if (!job) {
      return;
    }

    job.endTime = this.currentTime;
    job.status = 'completed';
    server.currentJobId = null;
    server.busyUntil = this.currentTime;

    this.recordPlaybackEvent({
      type: 'end_service',
      at: this.currentTime,
      customerId: job.id,
      serverId: server.id,
    });
    this.recordPlaybackEvent({
      type: 'leave_system',
      at: this.currentTime,
      customerId: job.id,
      serverId: server.id,
    });

    this.timeline.push({
      time: this.currentTime,
      type: 'end_service',
      jobId: job.id,
      serverId: server.id,
      description: `Customer ${job.id} finished service at window ${server.id}.`,
    });

    if (this.queueStructure === 'dedicated') {
      if (server.queueJobIds.length === 0) {
        return;
      }

      const nextJobId = server.queueJobIds.shift();
      if (nextJobId === undefined) {
        return;
      }

      const nextJob = this.getJob(nextJobId);
      if (nextJob) {
        this.startService(nextJob, server);
      }
      return;
    }

    if (this.queueStructure === 'shared') {
      this.dispatchFromSharedQueue(server);
      return;
    }

    this.dispatchFromHoldingPool(server);
  }

  private dispatchFromSharedQueue(server: Server): void {
    if (this.sharedQueue.length === 0) {
      return;
    }

    const decision = this.policy.onServerIdle(server.id, this.captureState());
    if (decision.jobId === null) {
      return;
    }

    const queueIndex = this.sharedQueue.indexOf(decision.jobId);
    if (queueIndex === -1) {
      return;
    }

    this.sharedQueue.splice(queueIndex, 1);
    const job = this.getJob(decision.jobId);
    if (!job) {
      return;
    }

    this.recordDecision(job.id, server.id, 'dispatch', decision.reason, decision.candidateScores);
    this.startService(job, server);
  }

  private dispatchFromHoldingPool(server: Server): void {
    if (this.holdingPool.length === 0) {
      return;
    }

    const decision = this.policy.onServerIdle(server.id, this.captureState());
    if (decision.jobId === null) {
      return;
    }

    const poolIndex = this.holdingPool.indexOf(decision.jobId);
    if (poolIndex === -1) {
      return;
    }

    this.holdingPool.splice(poolIndex, 1);
    const job = this.getJob(decision.jobId);
    if (!job) {
      return;
    }

    this.recordDecision(job.id, server.id, 'dispatch', decision.reason, decision.candidateScores);
    this.startService(job, server);
  }

  private startService(job: Job, server: Server): void {
    job.startTime = this.currentTime;
    job.endTime = this.currentTime + job.serviceTime;
    job.assignedServerId = server.id;
    job.status = 'serving';

    server.currentJobId = job.id;
    server.busyUntil = job.endTime;
    server.busyTime += job.serviceTime;

    this.recordPlaybackEvent({
      type: 'start_service',
      at: this.currentTime,
      customerId: job.id,
      serverId: server.id,
    });

    this.timeline.push({
      time: this.currentTime,
      type: 'start_service',
      jobId: job.id,
      serverId: server.id,
      description: `Customer ${job.id} started service at window ${server.id}.`,
    });

    this.enqueueEvent({
      time: job.endTime,
      type: 'departure',
      serverId: server.id,
    });
  }

  private recordDecision(
    jobId: number,
    serverId: number | null,
    action: DecisionReason['action'],
    reason: string,
    candidateScores?: DecisionReason['candidateScores'],
  ): void {
    const decision: DecisionReason = {
      time: this.currentTime,
      jobId,
      serverId,
      action,
      reason,
      candidateScores,
    };

    this.decisions.push(decision);
    this.recordPlaybackEvent({
      type: 'decision',
      at: this.currentTime,
      customerId: jobId,
      action,
      chosenServerId: serverId,
      reason,
      candidateScores,
    });
  }

  private enqueueEvent(event: Omit<Event, 'priority' | 'sequence'>): void {
    this.events.add({
      ...event,
      priority: event.type === 'departure' ? 0 : 1,
      sequence: this.eventSequence,
    });
    this.eventSequence += 1;
  }

  private recordSnapshot(): void {
    this.snapshots.push(this.captureState());
  }

  private recordPlaybackFrame(
    eventType: PlaybackFrame['eventType'],
    description: string,
  ): void {
    const state = this.captureState();
    this.playbackFrames.push({
      time: this.currentTime,
      currentTime: this.currentTime,
      eventType,
      jobs: state.jobs,
      servers: state.servers,
      sharedQueue: state.sharedQueue,
      holdingPool: state.holdingPool,
      queueStructure: state.queueStructure,
      description,
    });
  }

  private recordPlaybackEvent(event: PlaybackEvent): void {
    this.playbackEvents.push(event);
  }

  private captureState(): BenchmarkState {
    return {
      currentTime: this.currentTime,
      jobs: this.cloneJobs(),
      servers: this.cloneServers(),
      sharedQueue: [...this.sharedQueue],
      holdingPool: [...this.holdingPool],
      queueStructure: this.queueStructure,
    };
  }

  private cloneJobs(): Job[] {
    return this.jobs.map((job) => ({ ...job }));
  }

  private cloneServers(): Server[] {
    return this.servers.map((server) => ({
      ...server,
      queueJobIds: [...server.queueJobIds],
    }));
  }

  private getJob(jobId: number): Job | undefined {
    return this.jobs.find((job) => job.id === jobId);
  }

  private getServer(serverId: number): Server | undefined {
    return this.servers.find((server) => server.id === serverId);
  }

  private serverQueueId(serverId: number): PlaybackQueueId {
    return `server-${serverId}`;
  }
}
