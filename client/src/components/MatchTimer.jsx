import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const PERIOD_LABELS = {
  not_started: 'Not Started',
  '1st_half': '1st Half',
  half_time: 'Half Time',
  '2nd_half': '2nd Half',
  full_time: 'Full Time',
  et_1st_half: 'Extra Time (1st)',
  et_break: 'ET Break',
  et_2nd_half: 'Extra Time (2nd)',
  et_full_time: 'ET Full Time',
  penalties: 'Penalty Shootout',
  completed: 'Match Ended'
};

export const getElapsedSeconds = (timer) => {
  if (!timer) return 0;
  let secs = timer.secondsElapsed || 0;
  if (timer.isRunning && timer.lastStartedAt) {
    const delta = Math.floor((Date.now() - new Date(timer.lastStartedAt).getTime()) / 1000);
    secs += Math.max(0, delta);
  }
  return secs;
};

export default function MatchTimer({
  timer,
  status = 'scheduled',
  size = 'md',
  showPeriod = true,
  className = ''
}) {
  const [displaySeconds, setDisplaySeconds] = useState(() => getElapsedSeconds(timer));

  useEffect(() => {
    setDisplaySeconds(getElapsedSeconds(timer));

    if (timer?.isRunning) {
      const interval = setInterval(() => {
        setDisplaySeconds(getElapsedSeconds(timer));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer?.isRunning, timer?.lastStartedAt, timer?.secondsElapsed]);

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const stoppage = timer?.stoppageMinutes || 0;
  const period = timer?.period || 'not_started';
  const periodLabel = PERIOD_LABELS[period] || period;

  const isLive = status === 'live' || timer?.isRunning;
  const isPaused = !timer?.isRunning && Boolean(timer?.pauseReason);

  if (size === 'sm') {
    return (
      <div className={`inline-flex flex-wrap items-center gap-1.5 font-mono text-xs ${className}`}>
        {isLive && !isPaused && <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />}
        <span className="font-bold text-lime-400">{timeFormatted}</span>
        {stoppage > 0 && <span className="text-[10px] text-amber-400 font-bold">+{stoppage}'</span>}
        {showPeriod && (
          <span className="text-[10px] text-slate-400 font-medium">({periodLabel})</span>
        )}
        {isPaused && (
          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">
            ⏸️ Paused: {timer.pauseReason}
          </span>
        )}
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/80 border border-slate-800 ${className}`}>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-1.5">
          {isPaused ? (
            <span className="flex items-center space-x-1 text-[11px] font-mono font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              <span>⏸️ PAUSED</span>
            </span>
          ) : isLive ? (
            <span className="flex items-center space-x-1 text-[11px] font-mono font-bold text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full border border-lime-500/20">
              <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
              <span>LIVE</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
              <Clock className="w-3 h-3 inline mr-1" />
              <span>{status.toUpperCase()}</span>
            </span>
          )}
          <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900/90 px-2.5 py-0.5 rounded-full border border-slate-800">
            {periodLabel}
          </span>
        </div>

        <div className="flex items-baseline space-x-2 font-mono my-0.5">
          <span className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
            {timeFormatted}
          </span>
          {stoppage > 0 && (
            <span className="text-xl sm:text-2xl font-bold text-amber-400 animate-pulse">
              +{stoppage}'
            </span>
          )}
        </div>

        {/* Live Pause Reason Banner if currently paused */}
        {isPaused && (
          <div className="mt-2 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center space-x-1.5 animate-in fade-in">
            <span>Reason:</span>
            <span className="text-white font-medium">{timer.pauseReason}</span>
          </div>
        )}
      </div>
    );
  }

  // Default 'md'
  return (
    <div className={`inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono ${className}`}>
      {isLive && !isPaused && <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />}
      <span className="font-extrabold text-white">{timeFormatted}</span>
      {stoppage > 0 && <span className="text-amber-400 font-bold">+{stoppage}'</span>}
      {showPeriod && (
        <span className="text-slate-400 text-[11px] border-l border-slate-800 pl-2">
          {periodLabel}
        </span>
      )}
      {isPaused && (
        <span className="text-amber-400 text-[10px] font-bold border-l border-slate-800 pl-2">
          ⏸️ {timer.pauseReason}
        </span>
      )}
    </div>
  );
}
