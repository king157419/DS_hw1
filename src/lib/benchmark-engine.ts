/**
 * QueueLab Benchmark Engine
 * 统一的离散事件模拟引擎，支持三种队列结构
 */

import type {
  Job,
  Server,
  BenchmarkState,
  BenchmarkRunResult,
  BenchmarkConfig,
  SchedulingPolicy,
  TimelineEvent,
  DecisionReason,
  QueueStructureKind
} from './benchmark-types';
import { calculateMetrics } from './benchmark-metrics';

interface Event {
  time: number;
  type: 'arrival' | 'departure';
  jobId?: number;
  serverId?: number;
}

export class BenchmarkEngine {
  private currentTime = 0;
  private jobs: Job[] = [];
  private servers: Server[] = [];
  private sharedQueue: number[] = [];
  private holdingPool: number[] = [];
  private events: Event[] = [];
  private timeline: TimelineEvent[] = [];
  private decisions: DecisionReason[] = [];
  private snapshots: BenchmarkState[] = [];

  private policy: SchedulingPolicy;
  private queueStructure: QueueStructureKind;

  constructor(config: BenchmarkConfig) {
    this.policy = config.policy;
    this.queueStructure = config.policy.queueStructure;

    // 初始化服务器
    for (let i = 0; i < config.serverCount; i++) {
      this.servers.push({
        id: i + 1,
        busyUntil: 0,
        currentJobId: null,
        queueJobIds: [],
        busyTime: 0,
        idleTime: 0
      });
    }

    // 初始化任务和到达事件
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
        holdingEnterTime: -1
      };
      this.jobs.push(job);
      this.events.push({
        time: job.arrivalTime,
        type: 'arrival',
        jobId: job.id
      });
    });
  }

  /**
   * 运行模拟
   */
  run(): BenchmarkRunResult {
    while (this.events.length > 0) {
      // 按时间排序事件
      this.events.sort((a, b) => a.time - b.time);

      const event = this.events.shift()!;
      this.currentTime = event.time;

      if (event.type === 'arrival' && event.jobId) {
        this.handleArrival(event.jobId);
      } else if (event.type === 'departure' && event.serverId) {
        this.handleDeparture(event.serverId);
      }

      // 定期记录快照（每10个时间单位）
      if (this.snapshots.length === 0 || this.currentTime - this.snapshots[this.snapshots.length - 1].currentTime >= 10) {
        this.snapshots.push(this.captureState());
      }
    }

    // 计算指标
    const totalSimulationTime = Math.max(...this.jobs.map(j => j.endTime));
    const metrics = calculateMetrics(this.jobs, this.servers, totalSimulationTime);

    return {
      algorithmName: this.policy.name,
      queueStructure: this.queueStructure,
      metrics,
      timeline: this.timeline,
      snapshots: this.snapshots,
      decisions: this.decisions,
      jobs: this.jobs,
      servers: this.servers
    };
  }

  /**
   * 处理任务到达
   */
  private handleArrival(jobId: number): void {
    const job = this.jobs.find(j => j.id === jobId)!;
    const state = this.captureState();

    // 调用策略决定如何处理到达
    const decision = this.policy.onArrival(job, state);

    this.decisions.push({
      time: this.currentTime,
      jobId: job.id,
      serverId: decision.serverId,
      action: 'arrival',
      reason: decision.reason
    });

    if (this.queueStructure === 'dedicated') {
      // Dedicated queues: 策略直接指定服务器
      if (decision.serverId !== null) {
        const server = this.servers.find(s => s.id === decision.serverId)!;
        if (server.currentJobId === null) {
          // 服务器空闲，直接服务
          this.startService(job, server);
        } else {
          // 服务器忙，加入队列
          job.queueEnterTime = this.currentTime;
          server.queueJobIds.push(job.id);
          this.timeline.push({
            time: this.currentTime,
            type: 'arrival',
            jobId: job.id,
            serverId: server.id,
            description: `客户${job.id}到达，加入窗口${server.id}队列`
          });
        }
      }
    } else if (this.queueStructure === 'shared') {
      // Shared queue: 所有任务进入共享队列
      job.queueEnterTime = this.currentTime;
      this.sharedQueue.push(job.id);
      this.timeline.push({
        time: this.currentTime,
        type: 'arrival',
        jobId: job.id,
        description: `客户${job.id}到达，加入共享队列`
      });

      // 检查是否有空闲服务器
      const idleServer = this.servers.find(s => s.currentJobId === null);
      if (idleServer) {
        this.dispatchFromSharedQueue(idleServer);
      }
    } else if (this.queueStructure === 'holding') {
      // Holding pool: 所有任务进入待派池
      job.holdingEnterTime = this.currentTime;
      this.holdingPool.push(job.id);
      this.timeline.push({
        time: this.currentTime,
        type: 'arrival',
        jobId: job.id,
        description: `客户${job.id}到达，进入待派池`
      });

      // 检查是否有空闲服务器
      const idleServer = this.servers.find(s => s.currentJobId === null);
      if (idleServer) {
        this.dispatchFromHoldingPool(idleServer);
      }
    }
  }

  /**
   * 处理服务完成
   */
  private handleDeparture(serverId: number): void {
    const server = this.servers.find(s => s.id === serverId)!;
    const job = this.jobs.find(j => j.id === server.currentJobId)!;

    job.endTime = this.currentTime;
    job.status = 'completed';
    server.currentJobId = null;

    this.timeline.push({
      time: this.currentTime,
      type: 'end_service',
      jobId: job.id,
      serverId: server.id,
      description: `客户${job.id}完成服务，离开窗口${server.id}`
    });

    // 服务器空闲，尝试调度下一个任务
    if (this.queueStructure === 'dedicated') {
      if (server.queueJobIds.length > 0) {
        const nextJobId = server.queueJobIds.shift()!;
        const nextJob = this.jobs.find(j => j.id === nextJobId)!;
        this.startService(nextJob, server);
      }
    } else if (this.queueStructure === 'shared') {
      this.dispatchFromSharedQueue(server);
    } else if (this.queueStructure === 'holding') {
      this.dispatchFromHoldingPool(server);
    }
  }

  /**
   * 从共享队列调度
   */
  private dispatchFromSharedQueue(server: Server): void {
    if (this.sharedQueue.length === 0) return;

    const jobId = this.sharedQueue.shift()!;
    const job = this.jobs.find(j => j.id === jobId)!;

    this.decisions.push({
      time: this.currentTime,
      jobId: job.id,
      serverId: server.id,
      action: 'dispatch',
      reason: `从共享队列取队首任务`
    });

    this.startService(job, server);
  }

  /**
   * 从待派池调度
   */
  private dispatchFromHoldingPool(server: Server): void {
    if (this.holdingPool.length === 0) return;

    const state = this.captureState();
    const decision = this.policy.onServerIdle(server.id, state);

    if (decision.jobId !== null) {
      const jobIndex = this.holdingPool.indexOf(decision.jobId);
      if (jobIndex !== -1) {
        this.holdingPool.splice(jobIndex, 1);
        const job = this.jobs.find(j => j.id === decision.jobId)!;

        this.decisions.push({
          time: this.currentTime,
          jobId: job.id,
          serverId: server.id,
          action: 'dispatch',
          reason: decision.reason
        });

        this.startService(job, server);
      }
    }
  }

  /**
   * 开始服务
   */
  private startService(job: Job, server: Server): void {
    job.startTime = this.currentTime;
    job.endTime = this.currentTime + job.serviceTime;
    job.assignedServerId = server.id;
    job.status = 'serving';

    server.currentJobId = job.id;
    server.busyUntil = job.endTime;
    server.busyTime += job.serviceTime;

    this.timeline.push({
      time: this.currentTime,
      type: 'start_service',
      jobId: job.id,
      serverId: server.id,
      description: `客户${job.id}在窗口${server.id}开始服务`
    });

    // 添加离开事件
    this.events.push({
      time: job.endTime,
      type: 'departure',
      serverId: server.id
    });
  }

  /**
   * 捕获当前状态快照
   */
  private captureState(): BenchmarkState {
    return {
      currentTime: this.currentTime,
      jobs: JSON.parse(JSON.stringify(this.jobs)),
      servers: JSON.parse(JSON.stringify(this.servers)),
      sharedQueue: [...this.sharedQueue],
      holdingPool: [...this.holdingPool],
      queueStructure: this.queueStructure
    };
  }
}
