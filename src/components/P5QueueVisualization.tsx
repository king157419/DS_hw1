'use client';

import { useEffect, useRef } from 'react';
import type {
  BenchmarkRunResult,
  Job,
  PlaybackEvent,
  PlaybackQueueId,
  QueueStructureKind,
} from '@/lib/benchmark-types';

export interface P5QueueVisualizationProps {
  result: BenchmarkRunResult;
  isPlaying: boolean;
  speed: number;
  currentTime: number;
  onPlayingChange: (isPlaying: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onTimeChange: (time: number) => void;
}

interface Point {
  x: number;
  y: number;
}

interface ServerLayout {
  id: number;
  position: Point;
}

interface LayoutModel {
  width: number;
  height: number;
  entrance: Point;
  exit: Point;
  servers: ServerLayout[];
}

interface RuntimeModel {
  queues: Map<PlaybackQueueId, number[]>;
  queueAdvanceTimes: Map<PlaybackQueueId, number>;
  latestDecision: DisplayPlaybackEvent<'decision'> | null;
}

interface ActorRenderState {
  id: number;
  phase: 'entering' | 'queuing' | 'walking_to_server' | 'being_served' | 'leaving';
  position: Point;
  color: string;
  serverId?: number;
}

type DisplayPlaybackEvent<T extends PlaybackEvent['type'] = PlaybackEvent['type']> =
  Extract<PlaybackEvent, { type: T }> & { displayAt: number };

const ENTER_DURATION = 1.05;
const WALK_DURATION = 0.95;
const LEAVE_DURATION = 1.05;
const QUEUE_SHIFT_DURATION = 0.55;
const DECISION_HIGHLIGHT_DURATION = 1.15;
const ARRIVAL_STAGGER = 0.18;
const MIN_SERVICE_DURATION = 0.45;

export default function P5QueueVisualization({
  result,
  isPlaying,
  speed,
  currentTime,
  onPlayingChange,
  onSpeedChange,
  onTimeChange,
}: P5QueueVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<any>(null);
  const resultRef = useRef(result);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const currentTimeRef = useRef(currentTime);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onTimeChangeRef = useRef(onTimeChange);
  const lastRealTimeRef = useRef(0);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    if (currentTime === 0) {
      lastRealTimeRef.current = 0;
    }
  }, [currentTime]);

  useEffect(() => {
    onPlayingChangeRef.current = onPlayingChange;
  }, [onPlayingChange]);

  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);

  useEffect(() => {
    if (!containerRef.current || p5Ref.current) {
      return;
    }

    let mounted = true;

    import('p5').then((module) => {
      if (!mounted || !containerRef.current) {
        return;
      }

      const p5 = module.default;
      let lastSyncTime = 0;

      const sketch = (p: any) => {
        p.setup = () => {
          const { width, height } = getCanvasSize(containerRef.current?.clientWidth ?? 880);
          p.createCanvas(width, height);
          p.frameRate(60);
        };

        p.draw = () => {
          const activeResult = resultRef.current;
          const totalTime = getTotalTime(activeResult);

          if (isPlayingRef.current) {
            const now = performance.now();
            if (lastRealTimeRef.current === 0) {
              lastRealTimeRef.current = now;
            }

            const delta = now - lastRealTimeRef.current;
            lastRealTimeRef.current = now;

            const nextTime = Math.min(
              currentTimeRef.current + (delta / 1000) * speedRef.current,
              totalTime,
            );

            currentTimeRef.current = nextTime;

            if (now - lastSyncTime > 100 || nextTime >= totalTime) {
              onTimeChangeRef.current(Number(nextTime.toFixed(3)));
              lastSyncTime = now;
            }

            if (nextTime >= totalTime) {
              onPlayingChangeRef.current(false);
            }
          } else {
            lastRealTimeRef.current = 0;
          }

          const { width, height } = getCanvasSize(containerRef.current?.clientWidth ?? 880);
          if (p.width !== width || p.height !== height) {
            p.resizeCanvas(width, height);
          }

          drawScene(p, activeResult, currentTimeRef.current, width, height);
        };
      };

      p5Ref.current = new p5(sketch, containerRef.current);
    });

    return () => {
      mounted = false;
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  }, []);

  const totalTime = getTotalTime(result);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPlayingChange(!isPlaying)}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            {isPlaying ? '暂停' : '播放'}
          </button>
          <button
            type="button"
            onClick={() => {
              onPlayingChange(false);
              onTimeChange(0);
            }}
            disabled={currentTime === 0}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            重置
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-500">播放速度</label>
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.25"
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            className="w-28"
          />
          <span className="w-12 text-right text-sm font-semibold text-slate-700">
            {speed.toFixed(1)}x
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-2xl shadow-slate-900/10"
      />

      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max={Math.max(totalTime, 0)}
          step="0.1"
          value={Math.min(currentTime, totalTime)}
          onChange={(event) => onTimeChange(Number(event.target.value))}
          className="w-full accent-sky-500"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>0.0m</span>
          <span>
            {currentTime.toFixed(1)} / {totalTime.toFixed(1)}m
          </span>
          <span>{totalTime.toFixed(1)}m</span>
        </div>
      </div>
    </div>
  );
}

function drawScene(
  p: any,
  result: BenchmarkRunResult,
  currentTime: number,
  width: number,
  height: number,
) {
  const displayEvents = buildDisplayEvents(result.playbackEvents);
  const layout = buildLayout(width, height, result.jobs.length, result.servers.length);
  const runtime = buildRuntimeModel(displayEvents, currentTime);
  const actors = result.jobs
    .map((job) => getActorRenderState(job, displayEvents, runtime, layout, currentTime))
    .filter((actor): actor is ActorRenderState => actor !== null)
    .sort((left, right) => drawPhaseOrder(left.phase) - drawPhaseOrder(right.phase));

  p.background(15, 23, 42);
  drawBackdrop(p, width, height);
  drawEntrances(p, layout);
  drawQueueStructure(p, layout, result.queueStructure, runtime);
  drawServers(p, layout, result.queueStructure, runtime, currentTime);
  drawActors(p, actors);
}

function drawBackdrop(p: any, width: number, height: number) {
  p.noStroke();
  p.fill(30, 41, 59, 100);
  p.circle(width * 0.16, height * 0.25, 180);
  p.fill(15, 118, 110, 45);
  p.circle(width * 0.72, height * 0.8, 240);
}

function drawEntrances(p: any, layout: LayoutModel) {
  p.stroke(148, 163, 184, 80);
  p.strokeWeight(2);
  p.line(layout.entrance.x + 18, layout.entrance.y, layout.exit.x - 18, layout.exit.y);

  drawMarker(p, layout.entrance, '#f8fafc', '入口');
  drawMarker(p, layout.exit, '#38bdf8', '出口');
}

function drawQueueStructure(
  p: any,
  layout: LayoutModel,
  queueStructure: QueueStructureKind,
  runtime: RuntimeModel,
) {
  if (queueStructure === 'dedicated') {
    layout.servers.forEach((server) => {
      p.noFill();
      p.stroke(148, 163, 184, 70);
      p.strokeWeight(1.5);
      for (let index = 0; index < 6; index += 1) {
        const slot = getQueuePosition(layout, `server-${server.id}`, index);
        p.circle(slot.x, slot.y, 22);
      }

      p.noStroke();
      p.fill(203, 213, 225);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(11);
      p.text(`Window ${server.id} queue`, server.position.x - 162, server.position.y - 28);
    });
    return;
  }

  if (queueStructure === 'shared') {
    p.noFill();
    p.stroke(148, 163, 184, 70);
    p.strokeWeight(1.5);
    for (let index = 0; index < 10; index += 1) {
      const slot = getQueuePosition(layout, 'shared-main', index);
      p.circle(slot.x, slot.y, 22);
    }
    p.noStroke();
    p.fill(203, 213, 225);
    p.textAlign(p.LEFT, p.CENTER);
    p.textSize(12);
    p.text('Shared queue', layout.width * 0.17, layout.height * 0.34);
    return;
  }

  p.noFill();
  p.stroke(148, 163, 184, 70);
  p.strokeWeight(1.5);
  p.rect(layout.width * 0.16, layout.height * 0.28, layout.width * 0.22, layout.height * 0.42, 22);
  for (let index = 0; index < 8; index += 1) {
    const slot = getQueuePosition(layout, 'holding-main', index);
    p.circle(slot.x, slot.y, 22);
  }
  p.noStroke();
  p.fill(203, 213, 225);
  p.textAlign(p.LEFT, p.CENTER);
  p.textSize(12);
  p.text('Holding pool', layout.width * 0.17, layout.height * 0.24);

  const holdingCount = runtime.queues.get('holding-main')?.length ?? 0;
  p.textSize(10);
  p.fill(148, 163, 184);
  p.text(`${holdingCount} waiting`, layout.width * 0.17, layout.height * 0.68);
}

function drawServers(
  p: any,
  layout: LayoutModel,
  queueStructure: QueueStructureKind,
  runtime: RuntimeModel,
  currentTime: number,
) {
  const highlightServerId =
    runtime.latestDecision &&
    runtime.latestDecision.chosenServerId !== null &&
    currentTime - runtime.latestDecision.displayAt <= DECISION_HIGHLIGHT_DURATION
      ? runtime.latestDecision.chosenServerId
      : null;

  layout.servers.forEach((server) => {
    const isHighlighted = highlightServerId === server.id;
    if (isHighlighted) {
      p.noFill();
      p.stroke(56, 189, 248, 180);
      p.strokeWeight(4);
      p.circle(server.position.x, server.position.y, 62);
    }

    p.noStroke();
    p.fill(queueStructure === 'holding' ? '#14b8a6' : queueStructure === 'shared' ? '#38bdf8' : '#f97316');
    p.circle(server.position.x, server.position.y, 44);

    p.fill(15, 23, 42);
    p.circle(server.position.x, server.position.y, 20);

    p.fill(226, 232, 240);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(12);
    p.text(`W${server.id}`, server.position.x, server.position.y - 54);
  });
}

function drawActors(p: any, actors: ActorRenderState[]) {
  actors.forEach((actor) => {
    const radius = actor.phase === 'being_served' ? 12 : 10;

    p.noStroke();
    p.fill(actor.color);
    p.circle(actor.position.x, actor.position.y, radius * 2);

    if (actor.phase === 'being_served') {
      p.noFill();
      p.stroke(255, 255, 255, 140);
      p.strokeWeight(1.5);
      p.circle(actor.position.x, actor.position.y, 32);
    }

    p.noStroke();
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(8);
    p.text(`#${actor.id}`, actor.position.x, actor.position.y);
  });
}

function getActorRenderState(
  job: Job,
  displayEvents: DisplayPlaybackEvent[],
  runtime: RuntimeModel,
  layout: LayoutModel,
  currentTime: number,
): ActorRenderState | null {
  const events = displayEvents.filter(
    (event) => event.customerId === job.id && event.type !== 'decision',
  );

  if (events.length === 0) {
    return null;
  }

  let previousEvent: DisplayPlaybackEvent | null = null;
  let lastEvent: DisplayPlaybackEvent | null = null;
  let nextEvent: DisplayPlaybackEvent | null = null;

  for (const event of events) {
    if (event.displayAt <= currentTime) {
      previousEvent = lastEvent;
      lastEvent = event;
    } else {
      nextEvent = event;
      break;
    }
  }

  if (!lastEvent) {
    return null;
  }

  const color = waitColor(job);

  if (lastEvent.type === 'arrival') {
    const target =
      nextEvent?.type === 'join_queue'
        ? getQueuePosition(layout, nextEvent.queueId, nextEvent.position)
        : nextEvent?.type === 'start_service'
          ? getServerPosition(layout, nextEvent.serverId)
          : layout.entrance;

    return {
      id: job.id,
      phase: 'entering',
      position: interpolatePoint(
        layout.entrance,
        target,
        clamp01((currentTime - lastEvent.displayAt) / ENTER_DURATION),
      ),
      color,
    };
  }

  if (lastEvent.type === 'join_queue') {
    const queue = runtime.queues.get(lastEvent.queueId) ?? [];
    const currentIndex = queue.indexOf(job.id);
    if (currentIndex === -1) {
      return null;
    }

    const target = getQueuePosition(layout, lastEvent.queueId, currentIndex);
    const lastAdvanceAt = runtime.queueAdvanceTimes.get(lastEvent.queueId);
    const source =
      lastAdvanceAt !== undefined &&
      lastAdvanceAt >= lastEvent.at &&
      currentTime - lastAdvanceAt <= QUEUE_SHIFT_DURATION
        ? getQueuePosition(layout, lastEvent.queueId, currentIndex + 1)
        : target;

    return {
      id: job.id,
      phase: 'queuing',
      position: interpolatePoint(
        source,
        target,
        lastAdvanceAt === undefined
          ? 1
          : clamp01((currentTime - lastAdvanceAt) / QUEUE_SHIFT_DURATION),
      ),
      color,
      serverId: lastEvent.serverId,
    };
  }

  if (lastEvent.type === 'start_service') {
    const source =
      previousEvent?.type === 'join_queue'
        ? getQueuePosition(layout, previousEvent.queueId, 0)
        : previousEvent?.type === 'arrival'
          ? getServerPosition(layout, lastEvent.serverId)
          : layout.entrance;
    const target = getServerPosition(layout, lastEvent.serverId);
    const progress = clamp01((currentTime - lastEvent.displayAt) / WALK_DURATION);

    if (progress < 1) {
      return {
        id: job.id,
        phase: 'walking_to_server',
        position: interpolatePoint(source, target, progress),
        color,
        serverId: lastEvent.serverId,
      };
    }

    return {
      id: job.id,
      phase: 'being_served',
      position: target,
      color,
      serverId: lastEvent.serverId,
    };
  }

  if (lastEvent.type === 'end_service' || lastEvent.type === 'leave_system') {
    const from = getServerPosition(layout, lastEvent.serverId);
    const progress = clamp01((currentTime - lastEvent.displayAt) / LEAVE_DURATION);

    if (progress >= 1) {
      return null;
    }

    return {
      id: job.id,
      phase: 'leaving',
      position: interpolatePoint(from, layout.exit, progress),
      color,
      serverId: lastEvent.serverId,
    };
  }

  return null;
}

function buildRuntimeModel(events: DisplayPlaybackEvent[], currentTime: number): RuntimeModel {
  const queues = new Map<PlaybackQueueId, number[]>();
  const queueAdvanceTimes = new Map<PlaybackQueueId, number>();
  let latestDecision: DisplayPlaybackEvent<'decision'> | null = null;

  for (const event of events) {
    if (event.displayAt > currentTime) {
      break;
    }

    if (event.type === 'decision') {
      latestDecision = event;
      continue;
    }

    if (event.type === 'join_queue') {
      const queue = queues.get(event.queueId) ?? [];
      if (!queue.includes(event.customerId)) {
        queue.push(event.customerId);
      }
      queues.set(event.queueId, queue);
      continue;
    }

    if (event.type === 'start_service') {
      for (const [queueId, queue] of queues.entries()) {
        const queueIndex = queue.indexOf(event.customerId);
      if (queueIndex !== -1) {
        queue.splice(queueIndex, 1);
        queues.set(queueId, queue);
        queueAdvanceTimes.set(queueId, event.displayAt);
        break;
      }
      }
    }
  }

  return {
    queues,
    queueAdvanceTimes,
    latestDecision,
  };
}

function buildLayout(
  width: number,
  height: number,
  customerCount: number,
  serverCount: number,
): LayoutModel {
  const topPadding = 80;
  const bottomPadding = 70;
  const serverX = width * 0.77;
  const serverSpacing =
    serverCount === 1 ? 0 : (height - topPadding - bottomPadding) / Math.max(serverCount - 1, 1);

  return {
    width,
    height,
    entrance: {
      x: 76,
      y: height * 0.5,
    },
    exit: {
      x: width - 72,
      y: height * 0.18,
    },
    servers: Array.from({ length: serverCount }, (_, index) => ({
      id: index + 1,
      position: {
        x: serverX,
        y: serverCount === 1 ? height * 0.5 : topPadding + serverSpacing * index,
      },
    })),
  };
}

function getQueuePosition(layout: LayoutModel, queueId: PlaybackQueueId, index: number): Point {
  if (queueId === 'shared-main') {
    return {
      x: layout.width * 0.2 + index * 34,
      y: layout.height * 0.5,
    };
  }

  if (queueId === 'holding-main') {
    const columns = 3;
    return {
      x: layout.width * 0.2 + (index % columns) * 42,
      y: layout.height * 0.38 + Math.floor(index / columns) * 42,
    };
  }

  const serverId = Number(queueId.replace('server-', ''));
  const server = layout.servers.find((item) => item.id === serverId);
  if (!server) {
    return layout.entrance;
  }

  return {
    x: server.position.x - 72 - index * 36,
    y: server.position.y,
  };
}

function getServerPosition(layout: LayoutModel, serverId: number): Point {
  return layout.servers.find((server) => server.id === serverId)?.position ?? layout.exit;
}

function getCanvasSize(containerWidth: number) {
  const width = Math.max(320, Math.min(Math.floor(containerWidth), 980));
  const height = Math.max(300, Math.min(560, Math.floor(width * 0.58)));
  return { width, height };
}

function drawMarker(p: any, point: Point, color: string, label: string) {
  p.noStroke();
  p.fill(color);
  p.circle(point.x, point.y, 22);
  p.fill(203, 213, 225);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(11);
  p.text(label, point.x, point.y + 26);
}

function interpolatePoint(from: Point, to: Point, progress: number): Point {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getTotalTime(result: BenchmarkRunResult): number {
  const finalFrame = result.playbackFrames[result.playbackFrames.length - 1];
  const displayEvents = buildDisplayEvents(result.playbackEvents);
  const finalDisplayTime = displayEvents[displayEvents.length - 1]?.displayAt ?? 0;

  return Math.max(
    finalFrame?.currentTime ?? 0,
    finalDisplayTime + LEAVE_DURATION,
    Math.max(...result.jobs.map((job) => job.endTime), 0),
  );
}

function waitColor(job: Job) {
  const waitTime = Math.max(0, job.startTime - job.arrivalTime);

  if (waitTime < 2) {
    return '#38bdf8';
  }

  if (waitTime < 6) {
    return '#f59e0b';
  }

  return '#fb7185';
}

function drawPhaseOrder(phase: ActorRenderState['phase']) {
  switch (phase) {
    case 'entering':
      return 0;
    case 'queuing':
      return 1;
    case 'walking_to_server':
      return 2;
    case 'being_served':
      return 3;
    case 'leaving':
      return 4;
    default:
      return 10;
  }
}

function buildDisplayEvents(events: PlaybackEvent[]): DisplayPlaybackEvent[] {
  const arrivalCounts = new Map<string, number>();
  const arrivalOffsets = new Map<number, number>();
  const customerLastDisplayAt = new Map<number, number>();
  const customerLastEventType = new Map<number, PlaybackEvent['type']>();

  return events
    .map((event) => {
      let arrivalOffset = arrivalOffsets.get(event.customerId) ?? 0;

      if (event.type === 'arrival') {
        const key = event.at.toFixed(3);
        const count = arrivalCounts.get(key) ?? 0;
        arrivalOffset = count * ARRIVAL_STAGGER;
        arrivalCounts.set(key, count + 1);
        arrivalOffsets.set(event.customerId, arrivalOffset);
      }

      const previousDisplayAt = customerLastDisplayAt.get(event.customerId);
      const previousType = customerLastEventType.get(event.customerId);
      const baseDisplayAt = event.at + arrivalOffset + eventPhaseOffset(event.type);
      const displayAt =
        previousDisplayAt === undefined
          ? baseDisplayAt
          : Math.max(
              baseDisplayAt,
              previousDisplayAt + minGapBetween(previousType, event.type),
            );

      customerLastDisplayAt.set(event.customerId, displayAt);
      customerLastEventType.set(event.customerId, event.type);

      return {
        ...event,
        displayAt,
      };
    })
    .sort((left, right) => left.displayAt - right.displayAt || left.customerId - right.customerId);
}

function eventPhaseOffset(type: PlaybackEvent['type']) {
  switch (type) {
    case 'decision':
      return 0.06;
    case 'join_queue':
      return 0.12;
    case 'start_service':
      return 0.28;
    case 'leave_system':
      return 0.04;
    default:
      return 0;
  }
}

function minGapBetween(
  previousType: PlaybackEvent['type'] | undefined,
  nextType: PlaybackEvent['type'],
) {
  if (!previousType) {
    return 0;
  }

  if (previousType === 'arrival' && nextType === 'join_queue') {
    return ENTER_DURATION;
  }

  if (previousType === 'arrival' && nextType === 'start_service') {
    return ENTER_DURATION;
  }

  if (previousType === 'join_queue' && nextType === 'start_service') {
    return 0.16;
  }

  if (previousType === 'start_service' && nextType === 'end_service') {
    return WALK_DURATION + MIN_SERVICE_DURATION;
  }

  if (previousType === 'end_service' && nextType === 'leave_system') {
    return 0.08;
  }

  return 0;
}
