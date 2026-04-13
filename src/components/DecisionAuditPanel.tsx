import type { DecisionReason } from '@/lib/benchmark-types';

interface DecisionAuditPanelProps {
  decisions: DecisionReason[];
  currentTime: number;
}

export default function DecisionAuditPanel({
  decisions,
  currentTime,
}: DecisionAuditPanelProps) {
  const visibleDecisions = decisions.filter((decision) => decision.time <= currentTime);
  const latestDecision = visibleDecisions[visibleDecisions.length - 1] ?? null;
  const recentDecisions = visibleDecisions.slice(-6).reverse();
  const shouldShowDetails =
    recentDecisions.length > 1 ||
    recentDecisions.some((decision) => getCandidateEntries(decision).length > 0);

  if (!latestDecision) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Decision Audit</div>
        <p className="mt-2 text-sm text-slate-500">
          No scheduling decision has happened at the current playback time yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Decision Audit</div>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Latest key decision
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            latestDecision.action === 'arrival'
              ? 'bg-sky-100 text-sky-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {latestDecision.action === 'arrival' ? 'Arrival' : 'Dispatch'}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-white px-2.5 py-1 font-mono text-xs text-slate-500">
            t = {latestDecision.time.toFixed(1)}
          </span>
          <span className="font-medium text-slate-900">Customer #{latestDecision.jobId}</span>
          {latestDecision.serverId !== null ? (
            <span>was routed to window {latestDecision.serverId}.</span>
          ) : (
            <span>entered a waiting structure.</span>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{latestDecision.reason}</p>
      </div>

      {shouldShowDetails ? (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700">
            View recent decisions
          </summary>
          <div className="space-y-3 border-t border-slate-200 px-4 py-4">
            {recentDecisions.map((decision, index) => {
              const candidateEntries = getCandidateEntries(decision);
              return (
                <article
                  key={`${decision.time}-${decision.jobId}-${decision.action}-${index}`}
                  className="rounded-2xl bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-xs text-slate-500">
                      t = {decision.time.toFixed(1)}
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      Customer #{decision.jobId}
                      {decision.serverId !== null ? ` -> Window ${decision.serverId}` : ''}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{decision.reason}</p>

                  {candidateEntries.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidateEntries.map(([candidateId, score]) => (
                        <span
                          key={candidateId}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                        >
                          Option {candidateId}: {score.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function getCandidateEntries(decision: DecisionReason): Array<[string, number]> {
  if (!decision.candidateScores) {
    return [];
  }

  return Object.entries(decision.candidateScores)
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
    .sort((left, right) => Number(left[0]) - Number(right[0]));
}
