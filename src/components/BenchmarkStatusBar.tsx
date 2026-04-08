/**
 * Benchmark Status Bar
 * 显示当前模拟状态的顶部状态栏
 */

import React from 'react';
import type { BenchmarkState } from '@/lib/benchmark-types';

interface BenchmarkStatusBarProps {
  state: BenchmarkState | null;
  algorithmName: string;
  isPlaying: boolean;
  speed: number;
}

export default function BenchmarkStatusBar({
  state,
  algorithmName,
  isPlaying,
  speed
}: BenchmarkStatusBarProps) {
  if (!state) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200 px-6 py-3">
        <div className="text-sm text-gray-500">等待开始模拟...</div>
      </div>
    );
  }

  const waitingCount = state.jobs.filter(j => j.status === 'waiting').length;
  const servingCount = state.jobs.filter(j => j.status === 'serving').length;
  const completedCount = state.jobs.filter(j => j.status === 'completed').length;
  const inSystemCount = waitingCount + servingCount;

  const longestQueue = Math.max(
    ...state.servers.map(s => s.queueJobIds.length),
    0
  );

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">算法</span>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">
              {algorithmName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">时间</span>
            <span className="text-sm font-mono font-bold text-indigo-700">
              {state.currentTime.toFixed(1)} 分钟
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">系统内</span>
            <span className="text-sm font-bold text-orange-600">{inSystemCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">等待</span>
            <span className="text-sm font-bold text-yellow-600">{waitingCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">服务中</span>
            <span className="text-sm font-bold text-green-600">{servingCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">已完成</span>
            <span className="text-sm font-bold text-gray-600">{completedCount}</span>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">最长队列</span>
            <span className="text-sm font-bold text-red-600">{longestQueue}</span>
          </div>

          {state.queueStructure === 'shared' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">共享队列</span>
              <span className="text-sm font-bold text-purple-600">{state.sharedQueue.length}</span>
            </div>
          )}

          {state.queueStructure === 'holding' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">待派池</span>
              <span className="text-sm font-bold text-purple-600">{state.holdingPool.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-600">
            {isPlaying ? `播放中 (${speed}x)` : '已暂停'}
          </span>
        </div>
      </div>
    </div>
  );
}
