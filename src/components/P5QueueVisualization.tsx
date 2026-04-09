'use client';

import { useEffect, useRef } from 'react';
import type { BenchmarkRunResult, Job, PlaybackFrame, Server } from '@/lib/benchmark-types';

export interface P5QueueVisualizationProps {
  result: BenchmarkRunResult;
  isPlaying: boolean;
  speed: number;
  currentTime: number;
  onPlayingChange: (isPlaying: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onTimeChange: (time: number) => void;
  showHud?: boolean;
}

interface FrameState {
  currentTime: number;
  jobs: Job[];
  servers: Server[];
  sharedQueue: number[];
  holdingPool: number[];
  description: string;
  queueStructure: BenchmarkRunResult['queueStructure'];
}

export default function P5QueueVisualization({
  result,
  isPlaying,
  speed,
  currentTime,
  onPlayingChange,
  onSpeedChange,
  onTimeChange,
  showHud = true,
}: P5QueueVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<any>(null);
  const resultRef = useRef(result);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const currentTimeRef = useRef(currentTime);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onTimeChangeRef = useRef(onTimeChange);
  const showHudRef = useRef(showHud);
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
    showHudRef.current = showHud;
  }, [showHud]);

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
      const width = 920;
      const height = 540;
      let lastSyncTime = 0;

      const sketch = (p: any) => {
        p.setup = () => {
          p.createCanvas(width, height);
          p.frameRate(24);
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

            if (now - lastSyncTime > 120 || nextTime >= totalTime) {
              onTimeChangeRef.current(Number(nextTime.toFixed(3)));
              lastSyncTime = now;
            }

            if (nextTime >= totalTime) {
              onPlayingChangeRef.current(false);
            }
          } else {
            lastRealTimeRef.current = 0;
          }

          const frame = getFrameAtTime(activeResult, currentTimeRef.current);
          drawScene(p, activeResult, frame, width, height, showHudRef.current);
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
          <label className="text-sm text-slate-500">速度</label>
          <input
            type="range"
            min="0.5"
            max="8"
            step="0.5"
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
  frame: FrameState,
  width: number,
  height: number,
  showHud: boolean,
) {
  p.background(15, 23, 42);

  p.noStroke();
  p.fill(11, 18, 33);
  p.rect(0, 0, width, 68);
  p.fill(226, 232, 240);
  p.textSize(18);
  p.textAlign(p.LEFT, p.CENTER);
  p.text(result.algorithmName, 28, 26);
  p.textSize(11);
  p.fill(148, 163, 184);
  p.text(queueStructureLabel(frame.queueStructure), 28, 50);
  p.textAlign(p.RIGHT, p.CENTER);
  p.text(`t = ${frame.currentTime.toFixed(1)}m`, width - 28, 34);

  const totalTime = getTotalTime(result);
  p.fill(30, 41, 59);
  p.rect(0, 68, width, 6);
  p.fill(56, 189, 248);
  p.rect(0, 68, width * (totalTime === 0 ? 0 : frame.currentTime / totalTime), 6);

  const serverCount = frame.servers.length;
  const gap = 18;
  const cardWidth = Math.max(150, Math.min(180, (width - 100 - gap * (serverCount - 1)) / serverCount));
  const startX = (width - serverCount * cardWidth - gap * (serverCount - 1)) / 2;
  const cardY = 120;
  const cardHeight = 164;
  const jobMap = new Map(frame.jobs.map((job) => [job.id, job]));

  frame.servers.forEach((server, index) => {
    const x = startX + index * (cardWidth + gap);
    const currentJob = server.currentJobId ? jobMap.get(server.currentJobId) ?? null : null;
    const queueJobs = server.queueJobIds
      .map((jobId) => jobMap.get(jobId))
      .filter((job): job is Job => Boolean(job));

    p.noStroke();
    p.fill(22, 34, 58);
    p.rect(x, cardY, cardWidth, cardHeight, 18);

    p.fill(226, 232, 240);
    p.textAlign(p.LEFT, p.TOP);
    p.textSize(13);
    p.text(`窗口 ${server.id}`, x + 16, cardY + 16);

    if (currentJob) {
      const waitTime = Math.max(0, currentJob.startTime - currentJob.arrivalTime);
      const [r, g, b] = colorForWait(waitTime, result.metrics.avgWait);
      p.fill(r, g, b);
      p.circle(x + cardWidth / 2, cardY + 72, 44);
      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(14);
      p.text(`#${currentJob.id}`, x + cardWidth / 2, cardY + 70);
      p.textSize(10);
      p.text(`等待 ${waitTime.toFixed(1)}m`, x + cardWidth / 2, cardY + 100);
    } else {
      p.fill(100, 116, 139);
      p.circle(x + cardWidth / 2, cardY + 72, 34);
      p.fill(241, 245, 249);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(12);
      p.text('空闲', x + cardWidth / 2, cardY + 72);
    }

    p.textAlign(p.LEFT, p.TOP);
    p.fill(148, 163, 184);
    p.textSize(11);
    p.text(
      frame.queueStructure === 'dedicated' ? '本地队列' : '服务窗口',
      x + 16,
      cardY + 116,
    );

    if (frame.queueStructure === 'dedicated') {
      drawQueueBlocks(p, queueJobs, x + 16, cardY + 136, cardWidth - 32, 1);
    } else {
      p.fill(148, 163, 184);
      p.textSize(10);
      p.text(`busyUntil ${server.busyUntil.toFixed(1)}m`, x + 16, cardY + 138);
    }
  });

  if (frame.queueStructure !== 'dedicated') {
    const poolJobs =
      frame.queueStructure === 'shared'
        ? frame.sharedQueue
            .map((jobId) => jobMap.get(jobId))
            .filter((job): job is Job => Boolean(job))
        : frame.holdingPool
            .map((jobId) => jobMap.get(jobId))
            .filter((job): job is Job => Boolean(job));

    const poolY = 330;
    p.fill(18, 29, 50);
    p.rect(56, poolY, width - 112, 132, 22);
    p.fill(226, 232, 240);
    p.textAlign(p.LEFT, p.TOP);
    p.textSize(14);
    p.text(queueStructureLabel(frame.queueStructure), 80, poolY + 18);
    p.fill(148, 163, 184);
    p.textSize(11);
    p.text(`当前排队 ${poolJobs.length} 人`, 80, poolY + 42);
    drawQueueBlocks(p, poolJobs, 80, poolY + 70, width - 160, 2);
  }

  if (showHud) {
    const waiting = frame.jobs.filter((job) => job.status === 'waiting').length;
    const serving = frame.jobs.filter((job) => job.status === 'serving').length;
    const completed = frame.jobs.filter((job) => job.status === 'completed').length;

    p.fill(8, 15, 28, 220);
    p.rect(width - 210, 96, 170, 104, 18);
    p.fill(226, 232, 240);
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`等待中: ${waiting}`, width - 190, 116);
    p.text(`服务中: ${serving}`, width - 190, 142);
    p.text(`已完成: ${completed}`, width - 190, 168);
  }

  p.fill(226, 232, 240);
  p.textAlign(p.LEFT, p.BOTTOM);
  p.textSize(12);
  p.text(frame.description || '等待事件推进…', 28, height - 20);
}

function drawQueueBlocks(
  p: any,
  jobs: Job[],
  startX: number,
  startY: number,
  availableWidth: number,
  rows: number,
) {
  if (jobs.length === 0) {
    p.fill(100, 116, 139);
    p.textSize(10);
    p.text('无排队客户', startX, startY + 12);
    return;
  }

  const gap = 8;
  const blockHeight = 30;
  const perRow = Math.max(1, Math.floor((availableWidth + gap) / (72 + gap)));
  const limit = Math.max(perRow * rows, 1);

  jobs.slice(0, limit).forEach((job, index) => {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    const x = startX + column * (72 + gap);
    const y = startY + row * (blockHeight + gap);
    const [r, g, b] = colorForWait(Math.max(0, job.startTime - job.arrivalTime), 3);

    p.fill(r, g, b);
    p.rect(x, y, 72, blockHeight, 10);
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(10);
    p.text(`#${job.id}`, x + 18, y + blockHeight / 2);
    p.text(`${job.serviceTime}m`, x + 50, y + blockHeight / 2);
  });

  if (jobs.length > limit) {
    p.fill(148, 163, 184);
    p.textAlign(p.LEFT, p.CENTER);
    p.textSize(10);
    p.text(`+${jobs.length - limit} 个未展开`, startX, startY + rows * (blockHeight + gap) + 10);
  }
}

function getFrameAtTime(result: BenchmarkRunResult, currentTime: number): FrameState {
  const frames = result.playbackFrames;

  if (frames.length === 0) {
    return {
      currentTime,
      jobs: result.jobs,
      servers: result.servers,
      sharedQueue: [],
      holdingPool: [],
      description: '',
      queueStructure: result.queueStructure,
    };
  }

  let activeFrame: PlaybackFrame = frames[0];

  for (const frame of frames) {
    if (frame.currentTime <= currentTime) {
      activeFrame = frame;
    } else {
      break;
    }
  }

  return {
    currentTime: activeFrame.currentTime,
    jobs: activeFrame.jobs,
    servers: activeFrame.servers,
    sharedQueue: activeFrame.sharedQueue,
    holdingPool: activeFrame.holdingPool,
    description: activeFrame.description,
    queueStructure: activeFrame.queueStructure,
  };
}

function getTotalTime(result: BenchmarkRunResult): number {
  const finalFrame = result.playbackFrames[result.playbackFrames.length - 1];
  if (finalFrame) {
    return finalFrame.currentTime;
  }

  return Math.max(...result.jobs.map((job) => job.endTime), 0);
}

function colorForWait(waitTime: number, avgWait: number): [number, number, number] {
  const normalized = Math.min(1, waitTime / Math.max(avgWait * 1.5, 1));

  if (normalized < 0.5) {
    return [56, 189, 248];
  }

  if (normalized < 0.8) {
    return [245, 158, 11];
  }

  return [251, 113, 133];
}

function queueStructureLabel(structure: BenchmarkRunResult['queueStructure']): string {
  switch (structure) {
    case 'shared':
      return '共享队列';
    case 'holding':
      return '待派池';
    default:
      return '独立队列';
  }
}
