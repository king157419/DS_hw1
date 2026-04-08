/**
 * QueueLab Benchmark Types
 * 调度实验平台核心类型定义
 */

// Job（客户/任务）
export interface Job {
  id: number;
  arrivalTime: number;
  serviceTime: number;
  startTime: number;
  endTime: number;
  assignedServerId: number;
  status: 'waiting' | 'serving' | 'completed';
  queueEnterTime: number;
  holdingEnterTime: number;
}

// Server（窗口/服务器）
export interface Server {
  id: number;
  busyUntil: number;
  currentJobId: number | null;
  queueJobIds: number[];
  busyTime: number;
  idleTime: number;
}

// 队列结构类型
export type QueueStructureKind = 'dedicated' | 'shared' | 'holding';

// 决策原因
export interface DecisionReason {
  time: number;
  jobId: number;
  serverId: number | null;
  action: 'arrival' | 'dispatch';
  reason: string;
  candidateScores?: Record<number, number>;
}

// 时间线事件
export interface TimelineEvent {
  time: number;
  type: 'arrival' | 'start_service' | 'end_service';
  jobId: number;
  serverId?: number;
  description: string;
}

// Benchmark状态快照
export interface BenchmarkState {
  currentTime: number;
  jobs: Job[];
  servers: Server[];
  sharedQueue: number[];  // job ids
  holdingPool: number[];  // job ids
  queueStructure: QueueStructureKind;
}

// Benchmark指标
export interface BenchmarkMetrics {
  avgWait: number;
  p95Wait: number;
  avgStay: number;
  serviceLevel5m: number;
  jainFairnessWait: number;
  utilizationStd: number;
}

// Benchmark运行结果
export interface BenchmarkRunResult {
  algorithmName: string;
  queueStructure: QueueStructureKind;
  metrics: BenchmarkMetrics;
  timeline: TimelineEvent[];
  snapshots: BenchmarkState[];
  decisions: DecisionReason[];
  jobs: Job[];
  servers: Server[];
}

// 调度策略接口
export interface SchedulingPolicy {
  name: string;
  queueStructure: QueueStructureKind;

  /**
   * 当新任务到达时调用
   * @returns serverId（dedicated模式）或null（shared/holding模式）
   */
  onArrival(job: Job, state: BenchmarkState): { serverId: number | null; reason: string };

  /**
   * 当服务器空闲时调用
   * @returns jobId或null
   */
  onServerIdle(serverId: number, state: BenchmarkState): { jobId: number | null; reason: string };
}

// Benchmark配置
export interface BenchmarkConfig {
  serverCount: number;
  jobs: Array<{ arrivalTime: number; serviceTime: number }>;
  policy: SchedulingPolicy;
}

// Preset场景
export interface BenchmarkPreset {
  name: string;
  description: string;
  serverCount: number;
  jobs: Array<{ arrivalTime: number; serviceTime: number }>;
}
