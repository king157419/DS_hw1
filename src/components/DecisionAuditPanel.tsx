import type { DecisionReason } from '@/lib/benchmark-types';

interface DecisionAuditPanelProps {
  decisions: DecisionReason[];
  currentTime: number;
}

export default function DecisionAuditPanel({
  decisions,
  currentTime,
}: DecisionAuditPanelProps) {
  const recentDecisions = decisions
    .filter((decision) => decision.time <= currentTime)
    .slice(-8)
    .reverse();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-900">决策审计</div>

      {recentDecisions.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          当前时间点还没有可展示的调度决策
        </div>
      ) : (
        <div className="space-y-3">
          {recentDecisions.map((decision, index) => (
            <article
              key={`${decision.time}-${decision.jobId}-${decision.action}-${index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-xs text-slate-500">
                  t = {decision.time.toFixed(1)}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    decision.action === 'arrival'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {decision.action === 'arrival' ? '到达决策' : '派发决策'}
                </span>
              </div>

              <div className="mt-2 text-sm text-slate-800">
                客户 <span className="font-semibold">#{decision.jobId}</span>
                {decision.serverId !== null ? (
                  <span className="text-slate-500"> → 窗口 {decision.serverId}</span>
                ) : null}
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-600">{decision.reason}</p>

              {decision.candidateScores ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Candidate Scores
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(decision.candidateScores)
                      .sort((left, right) => Number(left[0]) - Number(right[0]))
                      .map(([serverId, score]) => (
                        <span
                          key={serverId}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                        >
                          窗口 {serverId}: {score.toFixed(1)}
                        </span>
                      ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
