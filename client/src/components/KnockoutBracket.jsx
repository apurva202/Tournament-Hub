import React from 'react';
import { Trophy, Clock, ChevronRight, Award } from 'lucide-react';
import MatchTimer from './MatchTimer';

export default function KnockoutBracket({ matches = [], stageName = 'Knockout Stage' }) {
  if (!matches || matches.length === 0) {
    return (
      <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center text-slate-400">
        <Trophy className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h4 className="font-bold text-white text-base mb-1">No Knockout Fixtures Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Complete the group stage and click "Advance to Knockout" to populate this bracket.
        </p>
      </div>
    );
  }

  // Group matches by round number
  const roundsMap = new Map();
  matches.forEach((m) => {
    const r = m.round || 1;
    if (!roundsMap.has(r)) {
      roundsMap.set(r, {
        roundNumber: r,
        roundLabel: m.roundLabel || `Round ${r}`,
        matches: []
      });
    }
    roundsMap.get(r).matches.push(m);
  });

  // Sort rounds ascending
  const sortedRounds = Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);

  // Check if final round is completed and has a champion
  const finalRound = sortedRounds[sortedRounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  const champion =
    finalMatch && finalMatch.status === 'completed'
      ? finalMatch.result?.winner === 'A'
        ? finalMatch.teamA
        : finalMatch.result?.winner === 'B'
        ? finalMatch.teamB
        : null
      : null;

  return (
    <div className="space-y-8">
      {/* Champion Banner if final is completed */}
      {champion && (
        <div className="p-6 rounded-2xl glass-panel border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 text-center relative overflow-hidden animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
            <Trophy className="w-7 h-7" />
          </div>
          <span className="text-xs uppercase tracking-widest font-mono text-amber-400 font-extrabold block">
            Tournament Champion
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
            {champion.name}
          </h2>
        </div>
      )}

      {/* Bracket Rounds Tree */}
      <div className="overflow-x-auto pb-6">
        <div className="flex items-stretch space-x-6 sm:space-x-8 min-w-max">
          {sortedRounds.map((roundObj, rIdx) => {
            const isLastRound = rIdx === sortedRounds.length - 1;

            return (
              <div key={roundObj.roundNumber} className="w-64 sm:w-72 flex flex-col">
                {/* Round Header */}
                <div className="mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-lime-400" />
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-wider font-mono">
                      {roundObj.roundLabel}
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {roundObj.matches.length} {roundObj.matches.length === 1 ? 'Match' : 'Matches'}
                  </span>
                </div>

                {/* Match Cards in this round */}
                <div className="flex-1 flex flex-col justify-around space-y-4">
                  {roundObj.matches.map((m) => {
                    const isCompleted = m.status === 'completed';
                    const isLive = m.status === 'live';
                    const winnerA = isCompleted && m.result?.winner === 'A';
                    const winnerB = isCompleted && m.result?.winner === 'B';
                    const hasPenalties = m.result?.penalties?.scoreA != null && m.result?.penalties?.scoreB != null;

                    return (
                      <div
                        key={m._id}
                        className={`glass-card p-3.5 rounded-xl border transition-all ${
                          isLive
                            ? 'border-lime-500/40 bg-lime-950/20 glow-lime-sm'
                            : isCompleted
                            ? 'border-slate-800 bg-slate-900/60'
                            : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        {/* Match Number, Live Timer, and Status */}
                        <div className="flex items-center justify-between text-[10px] font-mono mb-2 text-slate-500">
                          <span>Match #{m.matchNumber || m._id.slice(-4)}</span>
                          {isLive && m.timer ? (
                            <MatchTimer timer={m.timer} status={m.status} size="sm" showPeriod={false} />
                          ) : (
                            <span
                              className={`uppercase px-2 py-0.5 rounded-full font-bold ${
                                isCompleted
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-slate-900 text-slate-400'
                              }`}
                            >
                              {m.status}
                            </span>
                          )}
                        </div>

                        {/* Team A Slot */}
                        <div
                          className={`flex items-center justify-between p-2 rounded-lg mb-1 transition-colors ${
                            winnerA
                              ? 'bg-lime-500/15 border border-lime-500/30 text-lime-300 font-bold'
                              : 'bg-slate-900/60 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {winnerA && <Award className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />}
                            <span className="text-xs truncate font-medium">
                              {m.teamA?.name || (m.isBye ? 'BYE' : 'TBD (Winner)')}
                            </span>
                          </div>
                          <div className="font-mono text-xs font-black ml-2 flex items-center space-x-1.5 flex-shrink-0">
                            {/* Total Real Score */}
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-white font-black">
                              {isCompleted || isLive ? m.result?.scoreA : '-'}
                            </span>
                            {/* Side Penalty Count */}
                            {hasPenalties && (
                              <span className="text-[10px] text-amber-400 font-bold" title="Penalty Shootout Score">
                                ({m.result.penalties.scoreA}p)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Team B Slot */}
                        <div
                          className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                            winnerB
                              ? 'bg-lime-500/15 border border-lime-500/30 text-lime-300 font-bold'
                              : 'bg-slate-900/60 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {winnerB && <Award className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />}
                            <span className="text-xs truncate font-medium">
                              {m.teamB?.name || (m.isBye ? 'BYE' : 'TBD (Winner)')}
                            </span>
                          </div>
                          <div className="font-mono text-xs font-black ml-2 flex items-center space-x-1.5 flex-shrink-0">
                            {/* Total Real Score */}
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-white font-black">
                              {isCompleted || isLive ? m.result?.scoreB : '-'}
                            </span>
                            {/* Side Penalty Count */}
                            {hasPenalties && (
                              <span className="text-[10px] text-amber-400 font-bold" title="Penalty Shootout Score">
                                ({m.result.penalties.scoreB}p)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Penalty Breakdown Sub-banner if match went to shootout */}
                        {hasPenalties && (
                          <div className="mt-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-[9px] font-mono text-amber-400 font-semibold">
                            <span>Open Play: {m.result?.regularScore?.scoreA ?? (m.result.scoreA - m.result.penalties.scoreA)} - {m.result?.regularScore?.scoreB ?? (m.result.scoreB - m.result.penalties.scoreB)}</span>
                            <span>Pens: {m.result.penalties.scoreA}-{m.result.penalties.scoreB}</span>
                          </div>
                        )}

                        {/* Early Termination Sub-banner if terminated early */}
                        {m.earlyTermination?.isTerminatedEarly && (
                          <div className="mt-1.5 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] font-mono text-rose-400 font-semibold truncate">
                            ⚠️ Early End ({m.earlyTermination.endedAtMinute}'): {m.earlyTermination.reason}
                          </div>
                        )}

                        {/* Match Schedule / Venue if set */}
                        {(m.scheduledAt || m.venue) && (
                          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
                            <Clock className="w-3 h-3 text-lime-400" />
                            <span className="truncate">
                              {m.scheduledAt && new Date(m.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              {m.venue && ` • ${m.venue}`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
