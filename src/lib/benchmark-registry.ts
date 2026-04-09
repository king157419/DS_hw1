import type { QueueStructureKind, SchedulingPolicy } from './benchmark-types';
import {
  defaultPresetId,
  getAllPresets,
  isPresetId,
  type PresetId,
} from './benchmark-presets';
import { HoldingPoolSPTPolicy } from './policies/holdingPoolSpt';
import { JSQPolicy } from './policies/jsq';
import { LeastWorkloadPolicy } from './policies/leastWorkload';
import { RoundRobinPolicy } from './policies/rr';
import { SingleQueueFCFSPolicy } from './policies/singleQueueFcfs';

export const algorithmIds = [
  'jsq',
  'rr',
  'lew',
  'single_queue_fcfs',
  'holding_pool_spt',
] as const;

export type AlgorithmId = typeof algorithmIds[number];

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  shortName: string;
  description: string;
  queueStructure: QueueStructureKind;
  createPolicy: () => SchedulingPolicy;
}

export type BenchmarkPresetMeta = ReturnType<typeof getAllPresets>[number];

export type { PresetId };

export const algorithmRegistry: Record<AlgorithmId, AlgorithmMeta> = {
  jsq: {
    id: 'jsq',
    name: 'JSQ - Shortest Queue',
    shortName: 'JSQ',
    description: 'Assign each arrival to the window with the shortest current queue.',
    queueStructure: 'dedicated',
    createPolicy: () => new JSQPolicy(),
  },
  rr: {
    id: 'rr',
    name: 'RR - Round Robin',
    shortName: 'RR',
    description: 'Rotate arrivals across windows in a fixed cyclic order.',
    queueStructure: 'dedicated',
    createPolicy: () => new RoundRobinPolicy(),
  },
  lew: {
    id: 'lew',
    name: 'LEW - Least Workload',
    shortName: 'LEW',
    description: 'Choose the window with the smallest remaining total workload.',
    queueStructure: 'dedicated',
    createPolicy: () => new LeastWorkloadPolicy(),
  },
  single_queue_fcfs: {
    id: 'single_queue_fcfs',
    name: 'Single Queue FCFS',
    shortName: 'SQ-FCFS',
    description: 'All jobs enter one shared queue and idle windows pull from the head.',
    queueStructure: 'shared',
    createPolicy: () => new SingleQueueFCFSPolicy(),
  },
  holding_pool_spt: {
    id: 'holding_pool_spt',
    name: 'Holding Pool + SPT',
    shortName: 'HP-SPT',
    description: 'Idle windows pull the shortest service-time job from a holding pool.',
    queueStructure: 'holding',
    createPolicy: () => new HoldingPoolSPTPolicy(),
  },
};

export function isAlgorithmId(value: string): value is AlgorithmId {
  return value in algorithmRegistry;
}

export function getAlgorithmMeta(id: AlgorithmId): AlgorithmMeta {
  return algorithmRegistry[id];
}

export function getAllAlgorithmMetas(): AlgorithmMeta[] {
  return algorithmIds.map((id) => algorithmRegistry[id]);
}

export function createPolicyById(id: AlgorithmId): SchedulingPolicy {
  return algorithmRegistry[id].createPolicy();
}

export function getAllPresetMetas(): BenchmarkPresetMeta[] {
  return getAllPresets();
}

export function getDefaultPresetId(): PresetId {
  return defaultPresetId;
}

export { isPresetId };
