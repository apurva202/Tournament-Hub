import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Trophy,
  Play,
  Pause,
  AlertCircle,
  Plus,
  Minus,
  Radio,
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  AlertTriangle,
  Lock,
  Award,
} from "lucide-react";
import api from "../services/api";
import { useTournamentSocket } from "../services/socket";
import MatchTimer, {
  PERIOD_LABELS,
  getElapsedSeconds,
} from "../components/MatchTimer";

export default function ScoreConsolePage() {
  const { id } = useParams();

  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [penaltyScoreA, setPenaltyScoreA] = useState(0);
  const [penaltyScoreB, setPenaltyScoreB] = useState(0);

  // Timer live tick helper for whistle unlocking
  const [currentElapsed, setCurrentElapsed] = useState(0);

  // Real-time socket events subscription
  useTournamentSocket(id, {
    onMatchUpdate: (updatedMatch) => {
      setMatches((prev) =>
        prev.map((m) =>
          m._id === updatedMatch._id ? { ...m, ...updatedMatch } : m,
        ),
      );
      if (selectedMatch?._id === updatedMatch._id) {
        setSelectedMatch(updatedMatch);
        setScoreA(
          updatedMatch.result?.regularScore?.scoreA ??
            updatedMatch.result?.scoreA ??
            0,
        );
        setScoreB(
          updatedMatch.result?.regularScore?.scoreB ??
            updatedMatch.result?.scoreB ??
            0,
        );
        setPenaltyScoreA(updatedMatch.result?.penalties?.scoreA ?? 0);
        setPenaltyScoreB(updatedMatch.result?.penalties?.scoreB ?? 0);
      }
    },
    onStageAdvanced: () => {
      loadMatches();
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Pause Reason Modal state
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReasonInput, setPauseReasonInput] = useState("");

  // 2. Tie decision modals
  const [tieModalOpen, setTieModalOpen] = useState(false);
  const [etTieModalOpen, setEtTieModalOpen] = useState(false);

  // 3. Early Termination Modal state
  const [earlyEndModalOpen, setEarlyEndModalOpen] = useState(false);
  const [earlyEndReason, setEarlyEndReason] = useState(
    "Adverse Weather / Pitch Conditions",
  );
  const [earlyEndNote, setEarlyEndNote] = useState("");
  const [earlyEndOutcome, setEarlyEndOutcome] = useState("keep_score");

  // 4. Regular End match confirmation dialog
  const [endModalOpen, setEndModalOpen] = useState(false);

  useEffect(() => {
    loadMatches();
  }, [id]);

  // Keep a local 1-second interval to check whistle lock status when match is live
  useEffect(() => {
    if (selectedMatch?.timer) {
      setCurrentElapsed(getElapsedSeconds(selectedMatch.timer));
      if (selectedMatch.timer.isRunning) {
        const interval = setInterval(() => {
          setCurrentElapsed(getElapsedSeconds(selectedMatch.timer));
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [
    selectedMatch?.timer?.isRunning,
    selectedMatch?.timer?.lastStartedAt,
    selectedMatch?.timer?.secondsElapsed,
  ]);

  const loadMatches = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/tournaments/${id}/matches`);
      const allMatches = res.data.matches;
      setMatches(allMatches);

      if (!selectedMatch) {
        const liveMatch = allMatches.find((m) => m.status === "live");
        const firstMatch =
          liveMatch ||
          allMatches.find((m) => m.status === "scheduled") ||
          allMatches[0];
        if (firstMatch) {
          selectMatch(firstMatch);
        }
      } else {
        const updated = allMatches.find((m) => m._id === selectedMatch._id);
        if (updated) selectMatch(updated);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load matches for scoring",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectMatch = (match) => {
    setSelectedMatch(match);
    setScoreA(match.result?.regularScore?.scoreA ?? match.result?.scoreA ?? 0);
    setScoreB(match.result?.regularScore?.scoreB ?? match.result?.scoreB ?? 0);
    setPenaltyScoreA(match.result?.penalties?.scoreA ?? 0);
    setPenaltyScoreB(match.result?.penalties?.scoreB ?? 0);
    setCurrentElapsed(getElapsedSeconds(match.timer));
    setError("");
  };

  const formatMatchSchedule = (scheduledAt, venue) => {
    if (!scheduledAt && !venue) return null;
    const parts = [];
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      parts.push(
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
          ", " +
          d.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }),
      );
    }
    if (venue) {
      parts.push(venue);
    }
    return parts.join(" • ");
  };

  // Start match
  const handleStartMatch = async () => {
    if (!selectedMatch) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await api.patch(`/matches/${selectedMatch._id}/start`);
      selectMatch(res.data.match);
      await loadMatches();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start match");
    } finally {
      setActionLoading(false);
    }
  };

  // Click Pause -> Opens Reason modal
  const handleOpenPauseModal = () => {
    setPauseReasonInput("Player Injury");
    setPauseModalOpen(true);
  };

  // Confirm Pause with Reason
  const handleConfirmPause = async () => {
    if (!pauseReasonInput.trim()) {
      setError("Please provide a reason to pause the clock.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const res = await api.patch(`/matches/${selectedMatch._id}/timer`, {
        action: "pause",
        pauseReason: pauseReasonInput.trim(),
      });
      selectMatch(res.data.match);
      setPauseModalOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to pause clock");
    } finally {
      setActionLoading(false);
    }
  };

  // Resume Clock -> Starts clock and removes pause reason from display
  const handleResumeClock = async () => {
    if (!selectedMatch) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await api.patch(`/matches/${selectedMatch._id}/timer`, {
        action: "start",
      });
      selectMatch(res.data.match);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resume clock");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPeriod = async (period) => {
    if (!selectedMatch) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await api.patch(`/matches/${selectedMatch._id}/timer`, {
        action: "set_period",
        period,
      });
      selectMatch(res.data.match);
      setTieModalOpen(false);
      setEtTieModalOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to switch period");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddStoppage = async (minutes) => {
    if (!selectedMatch) return;
    try {
      const current = selectedMatch.timer?.stoppageMinutes || 0;
      const res = await api.patch(`/matches/${selectedMatch._id}/timer`, {
        action: "set_stoppage",
        stoppageMinutes: current + minutes,
      });
      selectMatch(res.data.match);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add stoppage time");
    }
  };

  const handleResetStoppage = async () => {
    if (!selectedMatch) return;
    try {
      const res = await api.patch(`/matches/${selectedMatch._id}/timer`, {
        action: "set_stoppage",
        stoppageMinutes: 0,
      });
      selectMatch(res.data.match);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset stoppage time");
    }
  };

  // Update open play score
  const handleUpdateScore = async (newScoreA, newScoreB) => {
    setScoreA(newScoreA);
    setScoreB(newScoreB);
    if (!selectedMatch || selectedMatch.status !== "live") return;

    try {
      await api.patch(`/matches/${selectedMatch._id}/score`, {
        scoreA: newScoreA,
        scoreB: newScoreB,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update score");
    }
  };

  // Update penalty shootout score
  const handleUpdatePenalties = async (newPenA, newPenB) => {
    setPenaltyScoreA(newPenA);
    setPenaltyScoreB(newPenB);
    if (!selectedMatch) return;

    try {
      await api.patch(`/matches/${selectedMatch._id}/penalties`, {
        penaltyScoreA: newPenA,
        penaltyScoreB: newPenB,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update penalties");
    }
  };

  // Whistle full time
  const handleWhistleFullTime = () => {
    if (scoreA === scoreB) {
      setTieModalOpen(true);
    } else {
      handleSetPeriod("full_time");
    }
  };

  // Whistle ET full time
  const handleWhistleEtFullTime = () => {
    if (scoreA === scoreB) {
      setEtTieModalOpen(true);
    } else {
      handleSetPeriod("et_full_time");
    }
  };

  // Finalize / End match normally
  const handleConfirmEndMatch = async (
    explicitWinner = null,
    decidedBy = null,
  ) => {
    if (!selectedMatch) return;
    setActionLoading(true);
    setError("");

    try {
      const payload = {};
      const isPenalties =
        selectedMatch.timer?.period === "penalties" ||
        (selectedMatch.result?.penalties?.scoreA != null &&
          selectedMatch.result?.penalties?.scoreB != null);

      if (isPenalties || decidedBy === "penalties") {
        if (penaltyScoreA === penaltyScoreB) {
          setError(
            "Penalty shootout score cannot end tied. One team must win.",
          );
          setActionLoading(false);
          return;
        }
        payload.penalties = { scoreA: penaltyScoreA, scoreB: penaltyScoreB };
        payload.decidedBy = "penalties";
      } else if (explicitWinner) {
        payload.winner = explicitWinner;
        payload.decidedBy =
          decidedBy || (explicitWinner === "draw" ? "draw" : "manual");
      }

      const res = await api.patch(`/matches/${selectedMatch._id}/end`, payload);
      setEndModalOpen(false);
      setTieModalOpen(false);
      setEtTieModalOpen(false);
      selectMatch(res.data.match);
      await loadMatches();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to end match");
    } finally {
      setActionLoading(false);
    }
  };

  // Early Termination End Match
  const handleConfirmEarlyTermination = async () => {
    if (!selectedMatch) return;
    if (!earlyEndReason.trim()) {
      setError("A reason is required to end the match early.");
      return;
    }
    setActionLoading(true);
    setError("");

    try {
      const payload = {
        earlyTermination: {
          isTerminatedEarly: true,
          reason: earlyEndReason.trim(),
          note: earlyEndNote.trim(),
          endedAtMinute: Math.floor(currentElapsed / 60),
          endedAtPeriod: selectedMatch.timer?.period || "1st_half",
        },
      };

      if (earlyEndOutcome === "win_a") {
        payload.winner = "A";
        payload.decidedBy = "manual";
      } else if (earlyEndOutcome === "win_b") {
        payload.winner = "B";
        payload.decidedBy = "manual";
      } else if (earlyEndOutcome === "draw") {
        payload.winner = "draw";
        payload.decidedBy = "draw";
      } else {
        // keep_score: derive winner from current score
        if (scoreA > scoreB) {
          payload.winner = "A";
          payload.decidedBy = "regular";
        } else if (scoreB > scoreA) {
          payload.winner = "B";
          payload.decidedBy = "regular";
        } else {
          payload.winner = "draw";
          payload.decidedBy = "draw";
        }
      }

      const res = await api.patch(`/matches/${selectedMatch._id}/end`, payload);
      setEarlyEndModalOpen(false);
      selectMatch(res.data.match);
      await loadMatches();
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to terminate match early",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lime-400 mb-3" />
        <p className="text-slate-400 text-sm">Loading scorer console...</p>
      </div>
    );
  }

  const liveMatches = matches.filter((m) => m.status === "live");
  const scheduledMatches = matches.filter((m) => m.status === "scheduled");
  const completedMatches = matches.filter((m) => m.status === "completed");

  const currentPeriod = selectedMatch?.timer?.period || "not_started";
  const isPenaltiesMode = currentPeriod === "penalties";
  const isClockRunning = selectedMatch?.timer?.isRunning || false;
  const isPausedWithReason =
    !isClockRunning && Boolean(selectedMatch?.timer?.pauseReason);
  const isPlayingHalf = [
    "1st_half",
    "2nd_half",
    "et_1st_half",
    "et_2nd_half",
  ].includes(currentPeriod);

  // Whistle 5-minute unlock checks
  let isWhistleUnlocked = false;
  let whistleLockMessage = "";

  if (currentPeriod === "1st_half") {
    // 45 min regular. Unlocks at 40:00 (2400 seconds)
    if (currentElapsed >= 2400) {
      isWhistleUnlocked = true;
    } else {
      const minsLeft = Math.ceil((2400 - currentElapsed) / 60);
      whistleLockMessage = `Whistle unlocks at 40' (${minsLeft}m left)`;
    }
  } else if (currentPeriod === "2nd_half") {
    // 90 min regular. Unlocks at 85:00 (5100 seconds)
    if (currentElapsed >= 5100) {
      isWhistleUnlocked = true;
    } else {
      const minsLeft = Math.ceil((5100 - currentElapsed) / 60);
      whistleLockMessage = `Whistle unlocks at 85' (${minsLeft}m left)`;
    }
  } else if (currentPeriod === "et_1st_half") {
    // 105 min regular. Unlocks at 100:00 (6000 seconds)
    if (currentElapsed >= 6000) {
      isWhistleUnlocked = true;
    } else {
      const minsLeft = Math.ceil((6000 - currentElapsed) / 60);
      whistleLockMessage = `Whistle unlocks at 100' (${minsLeft}m left)`;
    }
  } else if (currentPeriod === "et_2nd_half") {
    // 120 min regular. Unlocks at 115:00 (6900 seconds)
    if (currentElapsed >= 6900) {
      isWhistleUnlocked = true;
    } else {
      const minsLeft = Math.ceil((6900 - currentElapsed) / 60);
      whistleLockMessage = `Whistle unlocks at 115' (${minsLeft}m left)`;
    }
  }

  // Real total scores including penalties
  const realTotalA =
    scoreA +
    (selectedMatch?.result?.penalties?.scoreA != null ? penaltyScoreA : 0);
  const realTotalB =
    scoreB +
    (selectedMatch?.result?.penalties?.scoreB != null ? penaltyScoreB : 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-lime-500/10 border border-lime-500/30 text-[11px] font-mono font-bold text-lime-400 mb-2">
            <Radio className="w-3 h-3 animate-pulse text-lime-400" />
            <span>Official Scorer Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Live Match Scoring & Clock
          </h1>
        </div>

        <Link
          to={`/manage/${id}`}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
        >
          <span>Tournament Manage</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">
            No Matches Scheduled
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            The organizer has not generated fixtures for this tournament yet.
          </p>
          <Link
            to={`/manage/${id}`}
            className="px-4 py-2 rounded-xl bg-lime-500 text-slate-950 font-bold text-xs"
          >
            Go to Tournament Manage
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Scoring Box */}
          <div className="lg:col-span-2 space-y-6">
            {selectedMatch ? (
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-32 bg-lime-500/10 blur-[90px] rounded-full pointer-events-none" />

                {/* Match Meta Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      {selectedMatch.roundLabel ||
                        `Round ${selectedMatch.round}`}
                    </span>
                    {selectedMatch.group && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-lime-400 font-bold">
                        {selectedMatch.group}
                      </span>
                    )}
                    {(selectedMatch.scheduledAt || selectedMatch.venue) && (
                      <span className="text-xs text-lime-400 font-mono font-medium flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {formatMatchSchedule(
                            selectedMatch.scheduledAt,
                            selectedMatch.venue,
                          )}
                        </span>
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-xs font-mono uppercase font-bold px-3 py-1 rounded-full ${
                      selectedMatch.status === "live"
                        ? "bg-lime-500/20 text-lime-400 border border-lime-500/30 animate-pulse"
                        : selectedMatch.status === "completed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    {selectedMatch.status}
                  </span>
                </div>

                {/* PAUSED WITH REASON ALERT BANNER */}
                {isPausedWithReason && (
                  <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center space-x-2.5">
                      <Pause className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
                      <div>
                        <span className="font-mono text-xs font-black uppercase tracking-wider block">
                          Match Paused on Referee's Call
                        </span>
                        <span className="text-sm font-semibold text-white">
                          Reason: {selectedMatch.timer.pauseReason}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleResumeClock}
                      className="px-3.5 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs glow-lime-sm flex items-center space-x-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  </div>
                )}

                {/* EARLY TERMINATION COMPLETED BANNER */}
                {selectedMatch.earlyTermination?.isTerminatedEarly && (
                  <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 space-y-1 animate-in fade-in">
                    <div className="flex items-center space-x-2 text-xs font-mono font-bold text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>
                        MATCH TERMINATED EARLY (Minute{" "}
                        {selectedMatch.earlyTermination.endedAtMinute}')
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      Reason: {selectedMatch.earlyTermination.reason}
                    </div>
                    {selectedMatch.earlyTermination.note && (
                      <div className="text-xs text-slate-300 italic">
                        "{selectedMatch.earlyTermination.note}"
                      </div>
                    )}
                  </div>
                )}

                {/* 1. FOOTBALL MATCH TIMER & STOPPAGE CONTROLS */}
                {selectedMatch.status === "live" && (
                  <div className="mb-6 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Big Digital Clock */}
                      <MatchTimer
                        timer={selectedMatch.timer}
                        status={selectedMatch.status}
                        size="lg"
                        className="w-full sm:w-auto"
                      />

                      {/* Timer Actions & Next Period Controls */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                        {!isPenaltiesMode &&
                          (isClockRunning ? (
                            <button
                              onClick={handleOpenPauseModal}
                              disabled={actionLoading}
                              className="px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all"
                            >
                              <Pause className="w-4 h-4" />
                              <span>Pause Match (Reason Req.)</span>
                            </button>
                          ) : (
                            <button
                              onClick={handleResumeClock}
                              disabled={actionLoading}
                              className="px-4 py-2.5 rounded-xl bg-lime-500 text-slate-950 hover:bg-lime-400 font-bold text-xs glow-lime-sm flex items-center space-x-1.5 transition-all"
                            >
                              <Play className="w-4 h-4" />
                              <span>Resume Clock</span>
                            </button>
                          ))}

                        {/* Transition Period Buttons based on currentPeriod */}
                        {currentPeriod === "1st_half" &&
                          (isWhistleUnlocked ? (
                            <button
                              onClick={() => handleSetPeriod("half_time")}
                              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                            >
                              Whistle Half-Time
                            </button>
                          ) : (
                            <button
                              disabled
                              title={whistleLockMessage}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-mono font-bold text-xs cursor-not-allowed flex items-center space-x-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{whistleLockMessage}</span>
                            </button>
                          ))}

                        {currentPeriod === "half_time" && (
                          <button
                            onClick={() => handleSetPeriod("2nd_half")}
                            className="px-4 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs glow-lime-sm"
                          >
                            Start 2nd Half (45')
                          </button>
                        )}

                        {currentPeriod === "2nd_half" &&
                          (isWhistleUnlocked ? (
                            <button
                              onClick={handleWhistleFullTime}
                              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                            >
                              Whistle Full-Time (90')
                            </button>
                          ) : (
                            <button
                              disabled
                              title={whistleLockMessage}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-mono font-bold text-xs cursor-not-allowed flex items-center space-x-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{whistleLockMessage}</span>
                            </button>
                          ))}

                        {currentPeriod === "full_time" && (
                          <div className="flex items-center gap-2">
                            {scoreA === scoreB && (
                              <button
                                onClick={() => setTieModalOpen(true)}
                                className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs"
                              >
                                Tie Options
                              </button>
                            )}
                            <button
                              onClick={() => setEndModalOpen(true)}
                              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                            >
                              Finalize Match
                            </button>
                          </div>
                        )}

                        {/* Extra Time Transitions */}
                        {currentPeriod === "et_1st_half" &&
                          (isWhistleUnlocked ? (
                            <button
                              onClick={() => handleSetPeriod("et_break")}
                              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                            >
                              Whistle ET Half-Time
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-mono font-bold text-xs cursor-not-allowed flex items-center space-x-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{whistleLockMessage}</span>
                            </button>
                          ))}

                        {currentPeriod === "et_break" && (
                          <button
                            onClick={() => handleSetPeriod("et_2nd_half")}
                            className="px-4 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs glow-lime-sm"
                          >
                            Start ET 2nd Half (105')
                          </button>
                        )}

                        {currentPeriod === "et_2nd_half" &&
                          (isWhistleUnlocked ? (
                            <button
                              onClick={handleWhistleEtFullTime}
                              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                            >
                              Whistle ET Full-Time (120')
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-mono font-bold text-xs cursor-not-allowed flex items-center space-x-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{whistleLockMessage}</span>
                            </button>
                          ))}

                        {currentPeriod === "et_full_time" && (
                          <div className="flex items-center gap-2">
                            {scoreA === scoreB && (
                              <button
                                onClick={() => setEtTieModalOpen(true)}
                                className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs"
                              >
                                ET Tie Options
                              </button>
                            )}
                            <button
                              onClick={() => setEndModalOpen(true)}
                              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                            >
                              Finalize Match
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stoppage Time Adding Mode (Available in all 4 playing periods!) */}
                    {isPlayingHalf && (
                      <div className="pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Referee Additional Time:</span>
                          <span className="text-amber-400 font-bold">
                            +{selectedMatch.timer?.stoppageMinutes || 0}' mins
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          {[1, 2, 3, 5].map((m) => (
                            <button
                              key={m}
                              onClick={() => handleAddStoppage(m)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 font-mono text-xs font-bold transition-colors"
                            >
                              +{m}'
                            </button>
                          ))}
                          {(selectedMatch.timer?.stoppageMinutes || 0) > 0 && (
                            <button
                              onClick={handleResetStoppage}
                              title="Clear added stoppage time"
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/40 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. REGULAR / EXTRA TIME SCORE CONTROLS */}
                <div className="my-6">
                  <div className="text-center mb-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                      {isPenaltiesMode
                        ? "Open Play / Extra Time Score"
                        : "Match Score"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center text-center">
                    {/* Team A */}
                    <div className="space-y-4">
                      <h3 className="font-bold text-lg sm:text-xl text-white line-clamp-1">
                        {selectedMatch.teamA?.name || "Team A"}
                      </h3>

                      <div className="flex items-center justify-center">
                        <span className="font-mono text-6xl sm:text-7xl font-black text-white tracking-tighter">
                          {scoreA}
                        </span>
                      </div>

                      {selectedMatch.status === "live" && !isPenaltiesMode && (
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() =>
                              handleUpdateScore(Math.max(0, scoreA - 1), scoreB)
                            }
                            disabled={scoreA <= 0}
                            className="w-12 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold flex items-center justify-center disabled:opacity-40"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateScore(scoreA + 1, scoreB)
                            }
                            className="w-12 h-12 rounded-2xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold flex items-center justify-center glow-lime-sm"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Team B */}
                    <div className="space-y-4">
                      <h3 className="font-bold text-lg sm:text-xl text-white line-clamp-1">
                        {selectedMatch.teamB?.name || "Team B"}
                      </h3>

                      <div className="flex items-center justify-center">
                        <span className="font-mono text-6xl sm:text-7xl font-black text-white tracking-tighter">
                          {scoreB}
                        </span>
                      </div>

                      {selectedMatch.status === "live" && !isPenaltiesMode && (
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() =>
                              handleUpdateScore(scoreA, Math.max(0, scoreB - 1))
                            }
                            disabled={scoreB <= 0}
                            className="w-12 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold flex items-center justify-center disabled:opacity-40"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateScore(scoreA, scoreB + 1)
                            }
                            className="w-12 h-12 rounded-2xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold flex items-center justify-center glow-lime-sm"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. DEDICATED LIVE PENALTY SHOOTOUT CONSOLE & TOTAL REAL SCORE */}
                {(isPenaltiesMode ||
                  selectedMatch.result?.penalties?.scoreA != null) && (
                  <div className="my-6 p-5 rounded-2xl bg-slate-900/90 border border-amber-500/40 relative overflow-hidden space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                          Penalty Shootout
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Added directly into Total Real Score
                      </span>
                    </div>

                    {/* Total Real Score Display (Regular + Penalty) */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block mb-1">
                        Combined Total Real Score (Regular + Penalties)
                      </span>
                      <div className="flex items-center justify-center space-x-4 font-mono">
                        <span className="text-2xl font-black text-white">
                          {selectedMatch.teamA?.name}: {realTotalA}
                        </span>
                        <span className="text-slate-600 font-bold">-</span>
                        <span className="text-2xl font-black text-white">
                          {selectedMatch.teamB?.name}: {realTotalB}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-mono text-amber-400/90">
                        ({scoreA} + {penaltyScoreA} pens) - ({scoreB} +{" "}
                        {penaltyScoreB} pens)
                      </div>
                    </div>

                    {/* Live Penalty Buttons */}
                    <div className="grid grid-cols-2 gap-4 text-center">
                      {/* Team A Penalties */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-white block truncate">
                          {selectedMatch.teamA?.name} Penalties
                        </span>
                        <div className="font-mono text-4xl font-black text-amber-400">
                          {penaltyScoreA}
                        </div>
                        {selectedMatch.status === "live" && (
                          <div className="flex items-center justify-center space-x-2 pt-1">
                            <button
                              onClick={() =>
                                handleUpdatePenalties(
                                  Math.max(0, penaltyScoreA - 1),
                                  penaltyScoreB,
                                )
                              }
                              disabled={penaltyScoreA <= 0}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center disabled:opacity-40"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleUpdatePenalties(
                                  penaltyScoreA + 1,
                                  penaltyScoreB,
                                )
                              }
                              className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Team B Penalties */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-white block truncate">
                          {selectedMatch.teamB?.name} Penalties
                        </span>
                        <div className="font-mono text-4xl font-black text-amber-400">
                          {penaltyScoreB}
                        </div>
                        {selectedMatch.status === "live" && (
                          <div className="flex items-center justify-center space-x-2 pt-1">
                            <button
                              onClick={() =>
                                handleUpdatePenalties(
                                  penaltyScoreA,
                                  Math.max(0, penaltyScoreB - 1),
                                )
                              }
                              disabled={penaltyScoreB <= 0}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center disabled:opacity-40"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleUpdatePenalties(
                                  penaltyScoreA,
                                  penaltyScoreB + 1,
                                )
                              }
                              className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shootout status */}
                    {penaltyScoreA !== penaltyScoreB && (
                      <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/20 text-xs font-bold text-lime-400 text-center font-mono">
                        {penaltyScoreA > penaltyScoreB
                          ? `${selectedMatch.teamA?.name} leading shootout (${penaltyScoreA}-${penaltyScoreB})`
                          : `${selectedMatch.teamB?.name} leading shootout (${penaltyScoreB}-${penaltyScoreA})`}
                      </div>
                    )}
                  </div>
                )}

                {/* State Machine Action Controls */}
                <div className="pt-6 border-t border-slate-800/80 mt-6 flex flex-col sm:flex-row items-center gap-3">
                  {selectedMatch.status === "scheduled" &&
                    (selectedMatch.scheduledAt &&
                    new Date() < new Date(selectedMatch.scheduledAt) ? (
                      <div className="w-full space-y-3">
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-2.5 text-amber-300 text-xs font-medium">
                          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>
                            Scheduled kickoff:{" "}
                            {new Date(
                              selectedMatch.scheduledAt,
                            ).toLocaleString()}
                            . Match cannot be started before scheduled time.
                          </span>
                        </div>
                        <button
                          disabled
                          className="w-full py-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span>Cannot Start Before Schedule Time</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartMatch}
                        disabled={
                          actionLoading ||
                          !selectedMatch.teamA ||
                          !selectedMatch.teamB
                        }
                        className="w-full py-4 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-extrabold text-base transition-all glow-lime flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                        <span>Start Match (1st Half Kickoff)</span>
                      </button>
                    ))}

                  {selectedMatch.status === "live" && (
                    <div className="w-full">
                      {["full_time", "et_full_time", "penalties"].includes(
                        currentPeriod,
                      ) ? (
                        /* Regulation or Overtime Concluded: Normal Match Finalization */
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 text-xs font-mono font-bold text-center">
                            Regulation time concluded (
                            {PERIOD_LABELS[currentPeriod] || currentPeriod}).
                            Finalize the official match result below.
                          </div>
                          <button
                            onClick={() => {
                              if (scoreA === scoreB) {
                                if (currentPeriod === "full_time")
                                  setTieModalOpen(true);
                                else if (currentPeriod === "et_full_time")
                                  setEtTieModalOpen(true);
                                else setEndModalOpen(true);
                              } else {
                                setEndModalOpen(true);
                              }
                            }}
                            className="w-full py-4 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-black text-sm transition-all glow-lime flex items-center justify-center space-x-2"
                          >
                            <span>Finalize Official Match Result</span>
                          </button>
                        </div>
                      ) : (
                        /* Ongoing Match Play: Normal end not allowed without whistle. Only early end with mandatory reason */
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                          <div className="text-left">
                            <span className="text-xs font-mono font-bold text-slate-300 block">
                              Match in Progress (
                              {PERIOD_LABELS[currentPeriod] || currentPeriod})
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Blow the whistle at full-time to finalize
                              normally, or terminate early with a recorded
                              incident reason.
                            </span>
                          </div>
                          <button
                            onClick={() => setEarlyEndModalOpen(true)}
                            className="w-full sm:w-auto px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 flex-shrink-0"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span>End Match Early (Reason Req.)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMatch.status === "completed" && (
                    <div className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                      <span className="text-xs text-slate-400 block mb-1">
                        Final Result
                      </span>
                      <span className="font-extrabold text-white text-base">
                        {selectedMatch.result?.winner === "draw"
                          ? "Match Drawn"
                          : `Winner: ${
                              selectedMatch.result?.winner === "A"
                                ? selectedMatch.teamA?.name
                                : selectedMatch.teamB?.name
                            }`}
                      </span>

                      {/* Display breakdown */}
                      <div className="mt-2 text-xs font-mono font-bold text-lime-400">
                        Total Real Score: {selectedMatch.result?.scoreA} -{" "}
                        {selectedMatch.result?.scoreB}
                      </div>
                      {selectedMatch.result?.penalties?.scoreA != null && (
                        <div className="mt-1 text-xs font-mono font-bold text-amber-400">
                          (Open Play:{" "}
                          {selectedMatch.result.regularScore?.scoreA} -{" "}
                          {selectedMatch.result.regularScore?.scoreB} |
                          Penalties: {selectedMatch.result.penalties.scoreA} -{" "}
                          {selectedMatch.result.penalties.scoreB})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center text-slate-400">
                Select a match from the schedule to score
              </div>
            )}
          </div>

          {/* Right Column: Match List by State */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Fixtures Selection
            </h3>

            {/* LIVE MATCHES */}
            {liveMatches.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-lime-400 flex items-center space-x-1 mb-2">
                  <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
                  <span>Live Matches ({liveMatches.length})</span>
                </span>
                <div className="space-y-2">
                  {liveMatches.map((m) => (
                    <button
                      key={m._id}
                      onClick={() => selectMatch(m)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        selectedMatch?._id === m._id
                          ? "bg-lime-500/10 border-lime-400 text-white glow-lime-sm"
                          : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex justify-between text-xs mb-1 font-mono text-slate-400">
                        <span>{m.roundLabel || `Round ${m.round}`}</span>
                        <div className="flex items-center space-x-1.5">
                          {m.timer && (
                            <MatchTimer
                              timer={m.timer}
                              status={m.status}
                              size="sm"
                              showPeriod={false}
                            />
                          )}
                          <span className="text-lime-400 font-bold">
                            {m.result?.scoreA} - {m.result?.scoreB}
                          </span>
                        </div>
                      </div>
                      <div className="font-bold text-sm text-white line-clamp-1">
                        {m.teamA?.name || "TBD"} vs {m.teamB?.name || "TBD"}
                      </div>
                      {m.timer?.pauseReason && !m.timer.isRunning && (
                        <div className="mt-1 text-[10px] text-amber-400 font-mono">
                          ⏸️ Paused: {m.timer.pauseReason}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SCHEDULED MATCHES */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                Scheduled ({scheduledMatches.length})
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {scheduledMatches.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => selectMatch(m)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      selectedMatch?._id === m._id
                        ? "bg-lime-500/10 border-lime-400 text-white glow-lime-sm"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] mb-1 font-mono text-slate-500">
                      <span>{m.roundLabel || `Round ${m.round}`}</span>
                      <span>{m.group}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-200 line-clamp-1">
                      {m.teamA?.name || "TBD"} vs {m.teamB?.name || "TBD"}
                    </div>
                    {(m.scheduledAt || m.venue) && (
                      <div className="text-[10px] text-lime-400/90 font-mono flex items-center space-x-1 mt-1">
                        <Clock className="w-3 h-3 text-lime-400" />
                        <span>
                          {formatMatchSchedule(m.scheduledAt, m.venue)}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* COMPLETED MATCHES */}
            {completedMatches.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-2">
                  Completed ({completedMatches.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {completedMatches.map((m) => (
                    <button
                      key={m._id}
                      onClick={() => selectMatch(m)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                        selectedMatch?._id === m._id
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-950/60 border-slate-900 text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="line-clamp-1 mr-2">
                          {m.teamA?.name} vs {m.teamB?.name}
                        </span>
                        <div className="font-mono text-xs font-bold text-lime-400 flex items-center space-x-1">
                          <span>
                            {m.result?.scoreA} - {m.result?.scoreB}
                          </span>
                          {m.result?.penalties?.scoreA != null && (
                            <span className="text-[10px] text-amber-400">
                              ({m.result.penalties.scoreA}-
                              {m.result.penalties.scoreB}p)
                            </span>
                          )}
                        </div>
                      </div>
                      {m.earlyTermination?.isTerminatedEarly && (
                        <div className="text-[9px] text-rose-400 font-mono truncate mt-0.5">
                          ⚠️ Early End ({m.earlyTermination.endedAtMinute}'):{" "}
                          {m.earlyTermination.reason}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: PAUSE MATCH REASON */}
      {pauseModalOpen && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-400">
              <Pause className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">
                Pause Match Clock
              </h3>
            </div>
            <p className="text-slate-400 text-xs">
              Select or provide a reason for pausing the match clock. If
              cancelled or left blank, the clock continues running.
            </p>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "Player Injury",
                "VAR Review",
                "Water Break",
                "Referee Discussion",
                "Equipment / Pitch Issue",
                "Disciplinary Issue",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPauseReasonInput(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                    pauseReasonInput === preset
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Reason Input */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 font-bold block mb-1">
                Pause Reason / Note:
              </label>
              <input
                type="text"
                value={pauseReasonInput}
                onChange={(e) => setPauseReasonInput(e.target.value)}
                placeholder="e.g. Player Injury - Head collision"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPauseModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel (Keep Running)
              </button>
              <button
                type="button"
                onClick={handleConfirmPause}
                disabled={actionLoading || !pauseReasonInput.trim()}
                className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center space-x-1 disabled:opacity-40"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Confirm & Pause</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: 90' FULL TIME TIE DECISION (WITH MANUAL WINNER OPTION & DRAW) */}
      {tieModalOpen && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="text-center">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
                Full-Time Whistle (90 Minutes)
              </span>
              <h3 className="text-xl font-black text-white">
                Match Tied {scoreA} - {scoreB}
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                How should this tied match conclude or proceed?
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* Option A: End as Draw */}
              <button
                type="button"
                onClick={() => handleConfirmEndMatch("draw")}
                disabled={actionLoading}
                className="w-full p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-lime-400">
                    End Match as a Draw
                  </div>
                  <div className="text-xs text-slate-400">
                    Conclude match as draw without extra time or penalties.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              {/* Option B: Manual Winner Selection */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Manual Winner Decision (Coin toss / Organizer)</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmEndMatch("A", "manual")}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-lime-500 hover:text-slate-950 text-white font-bold text-xs truncate transition-colors"
                  >
                    Award: {selectedMatch.teamA?.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmEndMatch("B", "manual")}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-lime-500 hover:text-slate-950 text-white font-bold text-xs truncate transition-colors"
                  >
                    Award: {selectedMatch.teamB?.name}
                  </button>
                </div>
              </div>

              {/* Option C: Extra Time (30 mins: 15m + 15m) */}
              <button
                type="button"
                onClick={() => handleSetPeriod("et_1st_half")}
                disabled={actionLoading}
                className="w-full p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-lime-400">
                    Start Extra Time (30 mins)
                  </div>
                  <div className="text-xs text-slate-400">
                    Play two 15-minute halves with referee stoppage time.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              {/* Option D: Straight to Penalties */}
              <button
                type="button"
                onClick={() => handleSetPeriod("penalties")}
                disabled={actionLoading}
                className="w-full p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-amber-400">
                    Straight to Penalty Shootout
                  </div>
                  <div className="text-xs text-slate-400">
                    Skip extra time and enter live penalty kicks shootout.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setTieModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-semibold"
              >
                Cancel / Resume 2nd Half
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: 120' ET FULL TIME TIE DECISION */}
      {etTieModalOpen && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="text-center">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
                Extra Time Full-Time (120 Minutes)
              </span>
              <h3 className="text-xl font-black text-white">
                Match Still Tied {scoreA} - {scoreB}
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Select how to decide or conclude this match:
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* Option A: Penalties */}
              <button
                type="button"
                onClick={() => handleSetPeriod("penalties")}
                disabled={actionLoading}
                className="w-full p-3.5 rounded-xl bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-lime-400">
                    Proceed to Penalty Shootout
                  </div>
                  <div className="text-xs text-slate-300">
                    Decide the winner via spot kicks.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-lime-400" />
              </button>

              {/* Option B: Manual Winner Selection */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Manual Winner Decision (Coin toss / Organizer)</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmEndMatch("A", "manual")}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-lime-500 hover:text-slate-950 text-white font-bold text-xs truncate transition-colors"
                  >
                    Award: {selectedMatch.teamA?.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmEndMatch("B", "manual")}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-lime-500 hover:text-slate-950 text-white font-bold text-xs truncate transition-colors"
                  >
                    Award: {selectedMatch.teamB?.name}
                  </button>
                </div>
              </div>

              {/* Option C: Draw */}
              <button
                type="button"
                onClick={() => handleConfirmEndMatch("draw")}
                disabled={actionLoading}
                className="w-full p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-sm text-white">
                    End Match as a Draw
                  </div>
                  <div className="text-xs text-slate-400">
                    Conclude match as draw without shootout.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setEtTieModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-semibold"
              >
                Cancel / Resume ET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: END MATCH EARLY / ONGOING TERMINATION WITH MANDATORY REASON */}
      {earlyEndModalOpen && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-rose-500/40 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">End Match Early</h3>
            </div>
            <p className="text-slate-400 text-xs">
              Terminate this ongoing match before regulation time. A mandatory
              reason and note will be permanently recorded and displayed to all
              viewers.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 font-bold block mb-1">
                  Termination Reason:
                </label>
                <select
                  value={earlyEndReason}
                  onChange={(e) => setEarlyEndReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-400 font-mono"
                >
                  <option value="Adverse Weather / Pitch Conditions">
                    Adverse Weather / Pitch Conditions
                  </option>
                  <option value="Team Walkout / Forfeit">
                    Team Walkout / Forfeit
                  </option>
                  <option value="Disciplinary / Abandoned by Referee">
                    Disciplinary / Abandoned by Referee
                  </option>
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Mutual Agreement">Mutual Agreement</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 font-bold block mb-1">
                  Incident Note / Explanation:
                </label>
                <textarea
                  rows="2"
                  value={earlyEndNote}
                  onChange={(e) => setEarlyEndNote(e.target.value)}
                  placeholder="e.g. Heavy lightning storm at minute 62. Pitch submerged and unplayable."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 font-bold block mb-1">
                  Final Result Decision:
                </label>
                <select
                  value={earlyEndOutcome}
                  onChange={(e) => setEarlyEndOutcome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-400 font-mono"
                >
                  <option value="keep_score">
                    Keep Current Score ({scoreA} - {scoreB})
                  </option>
                  <option value="win_a">
                    Award Walkover Win to {selectedMatch.teamA?.name}
                  </option>
                  <option value="win_b">
                    Award Walkover Win to {selectedMatch.teamB?.name}
                  </option>
                  <option value="draw">Conclude as Draw</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEarlyEndModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEarlyTermination}
                disabled={actionLoading || !earlyEndReason.trim()}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center space-x-1 disabled:opacity-40"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Confirm Termination</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REGULAR END MATCH CONFIRMATION */}
      {endModalOpen && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Finalize Match</h3>
            <p className="text-slate-400 text-xs">
              Confirm the final score:{" "}
              <strong>
                {selectedMatch.teamA?.name} {scoreA} - {scoreB}{" "}
                {selectedMatch.teamB?.name}
              </strong>
              .
            </p>

            {isPenaltiesMode && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-mono">
                Total Real Score will be recorded as{" "}
                <strong>
                  {realTotalA} - {realTotalB}
                </strong>{" "}
                (including {penaltyScoreA}-{penaltyScoreB} penalties).
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEndModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold"
              >
                Back to Scoring
              </button>
              <button
                type="button"
                onClick={() => handleConfirmEndMatch()}
                disabled={
                  actionLoading ||
                  (isPenaltiesMode && penaltyScoreA === penaltyScoreB)
                }
                className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold glow-lime-sm flex items-center justify-center space-x-1 disabled:opacity-40"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Confirm & Complete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
