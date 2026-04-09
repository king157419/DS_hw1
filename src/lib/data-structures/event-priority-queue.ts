import { MinHeap } from './min-heap';

export interface Event {
  time: number;
  type: 'arrival' | 'departure';
  priority: number;
  sequence: number;
  jobId?: number;
  serverId?: number;
}

function compareEvents(a: Event, b: Event): number {
  if (a.time !== b.time) {
    return a.time - b.time;
  }

  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  if (a.sequence !== b.sequence) {
    return a.sequence - b.sequence;
  }

  if (a.type === 'arrival') {
    return (a.jobId ?? 0) - (b.jobId ?? 0);
  }

  return (a.serverId ?? 0) - (b.serverId ?? 0);
}

export class EventPriorityQueue {
  private readonly heap: MinHeap<Event>;

  constructor() {
    this.heap = new MinHeap<Event>(compareEvents);
  }

  add(event: Event): void {
    this.heap.insert(event);
  }

  poll(): Event | undefined {
    return this.heap.extractMin();
  }

  peek(): Event | undefined {
    return this.heap.peek();
  }

  size(): number {
    return this.heap.size();
  }

  isEmpty(): boolean {
    return this.heap.isEmpty();
  }
}
