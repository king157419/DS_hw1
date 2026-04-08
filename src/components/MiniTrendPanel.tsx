/**
 * Mini Trend Panel
 * 显示实时趋势的小图表
 */

import React from 'react';
import type { BenchmarkState } from '@/lib/benchmark-types';

interface MiniTrendPanelProps {
  snapshots: BenchmarkState[];
}

export default function MiniTrendPanel({ snapshots }: MiniTrendPanelProps) {
  if (snapshots.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-400 text-center">暂无趋势数据</div>
      </div>
    );
  }

  const waitingCounts = snapshots.map(s => s.jobs.filter(j => j.status === 'waiting').length);
  const inSystemCounts = snapshots.map(s =>
    s.jobs.filter(j => j.status === 'waiting' || j.status === 'serving').length
  );
  const longestQueues = snapshots.map(s =>
    Math.max(...s.servers.map(srv => srv.queueJobIds.length), 0)
  );

  const maxWaiting = Math.max(...waitingCounts, 1);
  const maxInSystem = Math.max(...inSystemCounts, 1);
  const maxQueue = Math.max(...longestQueues, 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="text-sm font-bold text-gray-800">实时趋势</h3>

      <MiniChart
        title="等待人数"
        data={waitingCounts}
        max={maxWaiting}
        color="rgb(234, 179, 8)"
      />

      <MiniChart
        title="系统内人数"
        data={inSystemCounts}
        max={maxInSystem}
        color="rgb(249, 115, 22)"
      />

      <MiniChart
        title="最长队列"
        data={longestQueues}
        max={maxQueue}
        color="rgb(239, 68, 68)"
      />
    </div>
  );
}

function MiniChart({ title, data, max, color }: { title: string; data: number[]; max: number; color: string }) {
  const points = data.slice(-20); // 只显示最近20个点
  const width = 200;
  const height = 40;

  const pathData = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{title}</span>
        <span className="text-xs font-bold text-gray-700">{points[points.length - 1] || 0}</span>
      </div>
      <svg width={width} height={height} className="w-full">
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
