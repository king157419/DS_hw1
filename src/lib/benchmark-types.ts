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

export interface Server {
  id: number;
  busyUntil: number;
  currentJobId: number | null;
  queueJobIds: number[];
  busyTime: number;
  idleTime: number;
}

export type QueueStructureKind = 'dedicated' | 'shared' | 'holding';
export type CandidateScoreMap = Record<number, number>;

export interface DecisionReason {
  time: number;
  jobId: number;
  serverId: number | null;
  action: 'arrival' | 'dispatch';
  reason: string;
  candidateScores?: CandidateScoreMap;
}

export interface TimelineEvent {
  time: number;
  type: 'arrival' | 'start_service' | 'end_service';
  jobId: number;
  serverId?: number;
  description: string;
}

export interface BenchmarkState {
  currentTime: number;
  jobs: Job[];
  servers: Server[];
  sharedQueue: number[];
  holdingPool: number[];
  queueStructure: QueueStructureKind;
}

export interface BenchmarkMetrics {
  avgWait: number;
  p95Wait: number;
  avgStay: number;
  serviceLevel5m: number;
  jainFairnessWait: number;
  utilizationStd: number;
  maxQueueLength: number;
  maxWait: number;
  starvedCount: number;
}

export interface PlaybackFrame {
  time: number;
  currentTime: number;
  eventType: 'arrival' | 'departure' | 'start_service';
  jobs: Job[];
  servers: Server[];
  sharedQueue: number[];
  holdingPool: number[];
  queueStructure: QueueStructureKind;
  description: string;
}

export interface BenchmarkRunResult {
  algorithmId: string;
  algorithmName: string;
  algorithmShortName?: string;
  queueStructure: QueueStructureKind;
  metrics: BenchmarkMetrics;
  timeline: TimelineEvent[];
  snapshots: BenchmarkState[];
  decisions: DecisionReason[];
  jobs: Job[];
  servers: Server[];
  playbackFrames: PlaybackFrame[];
}

export interface ArrivalDecision {
  serverId: number | null;
  reason: string;
  candidateScores?: CandidateScoreMap;
}

export interface DispatchDecision {
  jobId: number | null;
  reason: string;
  candidateScores?: CandidateScoreMap;
}

export interface SchedulingPolicy {
  id: string;
  name: string;
  queueStructure: QueueStructureKind;
  onArrival(job: Job, state: BenchmarkState): ArrivalDecision;
  onServerIdle(serverId: number, state: BenchmarkState): DispatchDecision;
}

export interface BenchmarkConfig {
  serverCount: number;
  jobs: Array<{ arrivalTime: number; serviceTime: number }>;
  policy: SchedulingPolicy;
}

export type Differentiation = 'strong' | 'medium' | 'weak';
export type Difficulty = 'high' | 'medium' | 'low';
export type RecommendedFor = 'demo' | 'sanity-check' | 'fairness';

export interface BenchmarkPreset {
  id: string;
  name: string;
  description: string;
  serverCount: number;
  jobs: Array<{ arrivalTime: number; serviceTime: number }>;
  differentiation: Differentiation;
  difficulty: Difficulty;
  recommendedFor: RecommendedFor;
}
