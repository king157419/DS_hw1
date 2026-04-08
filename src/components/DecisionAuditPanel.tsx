/**
 * Decision Audit Panel
 * 显示算法决策过程的右侧面板
 */

import React from 'react';
import type { DecisionReason } from '@/lib/benchmark-types';

interface DecisionAuditPanelProps {
  decisions: DecisionReason[];
  currentTime: number;
}

export default function DecisionAuditPanel({ decisions, currentTime }: DecisionAuditPanelProps) {
  // 只显示最近的10条决策
  const recentDecisions = decisions
    .filter(d => d.time <= currentTime)
    .slice(-10)
    .reverse();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-bold text-gray-800 mb-3">决策审计</h3>

      {recentDecisions.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-8">
          暂无决策记录
        </div>
      ) : (
        <div className="space-y-2">
          {recentDecisions.map((decision, index) => (
            <div
              key={`${decision.time}-${decision.jobId}-${index}`}
              className="bg-gray-50 rounded p-2 text-xs border border-gray-200"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-gray-500">
                  t={decision.time.toFixed(1)}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  decision.action === 'arrival' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {decision.action === 'arrival' ? '到达' : '调度'}
                </span>
              </div>

              <div className="text-gray-700 mb-1">
                <span className="font-bold">客户 #{decision.jobId}</span>
                {decision.serverId && (
                  <span> → 窗口 {decision.serverId}</span>
                )}
              </div>

              <div className="text-gray-600 text-xs">
                {decision.reason}
              </div>

              {decision.candidateScores && (
                <div className="mt-1 pt-1 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    候选评分: {Object.entries(decision.candidateScores)
                      .map(([id, score]) => `窗口${id}=${score.toFixed(1)}`)
                      .join(', ')}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
