import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Calendar,
  Table as TableIcon,
  Info,
  Radio,
  ExternalLink,
  Share2,
  Check,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Clock,
  MapPin,
  Star
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTournamentSocket } from '../services/socket';
import KnockoutBracket from '../components/KnockoutBracket';
import MatchTimer from '../components/MatchTimer';

export default function PublicTournamentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState('');

  // Real-time socket events subscription
  useTournamentSocket(tournament?._id, {
    onMatchUpdate: (updatedMatch) => {
      setMatches((prev) =>
        prev.map((m) => (m._id === updatedMatch._id ? { ...m, ...updatedMatch } : m))
      );
    },
    onStandingsUpdate: () => {
      if (selectedStageId) {
        loadStageStandings(selectedStageId);
      }
    },
    onStageAdvanced: () => {
      loadPublicData();
    }
  });

  const formatMatchSchedule = (scheduledAt, venue) => {
    if (!scheduledAt && !venue) return null;
    const parts = [];
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      parts.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    }
    if (venue) {
      parts.push(venue);
    }
    return parts.join(' • ');
  };

  const [activeTab, setActiveTab] = useState('fixtures');
  const [fixtureFilter, setFixtureFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    loadPublicData();
  }, [slug]);

  useEffect(() => {
    if (selectedStageId) {
      loadStageStandings(selectedStageId);
    }
  }, [selectedStageId]);

  const loadPublicData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tRes, mRes] = await Promise.all([
        api.get(`/public/t/${slug}`),
        api.get(`/public/t/${slug}/matches`)
      ]);

      setTournament(tRes.data.tournament);
      setStages(tRes.data.stages);
      setParticipants(tRes.data.participants);
      setMatches(mRes.data.matches);

      if (tRes.data.stages.length > 0) {
        setSelectedStageId(tRes.data.stages[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Tournament not found or private');
    } finally {
      setLoading(false);
    }
  };

  const loadStageStandings = async (stageId) => {
    try {
      const res = await api.get(`/public/stages/${stageId}/standings`);
      setStandings(res.data.standings || []);
    } catch (err) {
      console.error('Failed to load standings:', err);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Check saved/following status
  useEffect(() => {
    if (!user || !tournament) {
      setIsSaved(false);
      return;
    }

    const checkSaved = async () => {
      try {
        const res = await api.get(`/tournaments/${tournament._id}/saved`);
        setIsSaved(!!res.data.saved);
      } catch {
        setIsSaved(false);
      }
    };

    checkSaved();
  }, [user, tournament]);

  // Toggle Save / Follow
  const handleToggleSave = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!tournament) return;

    setSavingStatus(true);
    try {
      if (isSaved) {
        await api.delete(`/tournaments/${tournament._id}/save`);
        setIsSaved(false);
      } else {
        await api.post(`/tournaments/${tournament._id}/save`);
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Failed to toggle save status:', err);
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lime-400 mb-3" />
        <p className="text-slate-400 text-sm">Loading tournament...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center glass-panel rounded-2xl border border-slate-800">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Tournament Unavailable</h2>
        <p className="text-slate-400 text-sm mb-6">
          {error || 'This tournament does not exist or has been made private by the organizer.'}
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-lime-500 text-slate-950 font-bold text-xs"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'scheduled');
  const finishedMatches = matches.filter(m => m.status === 'completed');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Live Strip Banner if any match is live */}
      {liveMatches.length > 0 && (
        <div className="mb-6 p-3.5 rounded-2xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-lime-400 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-lime-400">Match in progress:</span>
            <span className="text-white font-semibold">
              {liveMatches[0].teamA?.name} {liveMatches[0].result?.scoreA} - {liveMatches[0].result?.scoreB} {liveMatches[0].teamB?.name}
            </span>
          </div>
          <button
            onClick={() => setActiveTab('fixtures')}
            className="text-lime-400 hover:underline font-mono font-bold text-[11px]"
          >
            View Live Match &rarr;
          </button>
        </div>
      )}

      {/* Main Tournament Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-lime-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span
                className={`text-[11px] font-mono uppercase font-bold px-3 py-0.5 rounded-full ${
                  tournament.status === 'live'
                    ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30 animate-pulse'
                    : tournament.status === 'completed'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {tournament.status}
              </span>

              <span className="text-xs text-slate-400 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-medium">
                Football &bull; Goals
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {tournament.name}
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              {participants.length} Teams competing &bull; Points: Win 3, Draw 1, Loss 0
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Star / Follow Button */}
            <button
              onClick={handleToggleSave}
              disabled={savingStatus}
              title={isSaved ? 'Following Tournament (Click to unfollow)' : 'Follow / Save Tournament'}
              className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                isSaved
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              {savingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Star
                  className={`w-4 h-4 ${isSaved ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`}
                />
              )}
              <span>{isSaved ? 'Following' : 'Follow'}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4 text-lime-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Page'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8 space-x-2 sm:space-x-4">
        {[
          { key: 'fixtures', label: `Fixtures (${matches.length})`, icon: Calendar },
          { key: 'tables', label: 'Standings Tables', icon: TableIcon },
          { key: 'bracket', label: 'Knockout Bracket', icon: Trophy },
          { key: 'info', label: 'Tournament Info', icon: Info }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
                isActive
                  ? 'border-lime-400 text-lime-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FIXTURES */}
      {activeTab === 'fixtures' && (() => {
        const renderMatchCard = (m) => {
          const isWinnerA = m.status === 'completed' && m.result?.winner === 'A';
          const isWinnerB = m.status === 'completed' && m.result?.winner === 'B';
          const isDraw = m.status === 'completed' && m.result?.winner === 'draw';

          return (
            <div
              key={m._id}
              className={`glass-card p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between ${
                m.status === 'live'
                  ? 'border-lime-500/60 bg-gradient-to-r from-lime-950/20 to-slate-900/90 shadow-lg shadow-lime-500/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3 sm:space-x-6">
                <div className="text-left w-20 sm:w-28 space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono text-xs text-slate-400 font-bold block">
                      {m.roundLabel || `Round ${m.round}`}
                    </span>
                    {m.status === 'live' && (
                      <span className="flex items-center space-x-1 text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded-full bg-lime-500/20 text-lime-400 border border-lime-500/40 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                        <span>LIVE</span>
                      </span>
                    )}
                  </div>
                  {m.group && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-lime-400 font-bold inline-block">
                      {m.group}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center space-x-2 sm:space-x-4 text-sm sm:text-base font-bold">
                    {/* Team A */}
                    <div
                      className={`text-right w-28 sm:w-44 flex items-center justify-end space-x-1.5 ${
                        isWinnerA
                          ? 'text-lime-400 font-extrabold'
                          : isWinnerB
                          ? 'text-slate-400 font-normal'
                          : 'text-white'
                      }`}
                    >
                      {isWinnerA && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30 uppercase font-black flex-shrink-0">
                          🏆 WINNER
                        </span>
                      )}
                      <span className="line-clamp-1">{m.teamA?.name || 'TBD'}</span>
                    </div>

                    <span className="text-slate-600 text-xs font-normal">vs</span>

                    {/* Team B */}
                    <div
                      className={`text-left w-28 sm:w-44 flex items-center justify-start space-x-1.5 ${
                        isWinnerB
                          ? 'text-lime-400 font-extrabold'
                          : isWinnerA
                          ? 'text-slate-400 font-normal'
                          : 'text-white'
                      }`}
                    >
                      <span className="line-clamp-1">{m.teamB?.name || 'TBD'}</span>
                      {isWinnerB && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30 uppercase font-black flex-shrink-0">
                          🏆 WINNER
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Kickoff schedule info */}
                  <div className="flex items-center space-x-2 mt-1 text-xs">
                    {m.scheduledAt || m.venue ? (
                      <span className="flex items-center space-x-1.5 text-lime-400 font-medium font-mono text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-lime-400" />
                        <span>{formatMatchSchedule(m.scheduledAt, m.venue)}</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-slate-500 text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Kickoff Time & Pitch TBD</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {m.status === 'live' ? (
                  <div className="flex flex-col items-end space-y-1">
                    {m.timer && <MatchTimer timer={m.timer} status={m.status} size="sm" />}
                    <div className="flex items-center space-x-2 font-mono text-xl sm:text-2xl font-black text-lime-400 bg-lime-500/10 border border-lime-500/30 px-3 py-1 rounded-xl">
                      <span>{m.result?.scoreA}</span>
                      <span>:</span>
                      <span>{m.result?.scoreB}</span>
                    </div>
                    {m.result?.penalties?.scoreA != null && (
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        Pens: {m.result.penalties.scoreA} - {m.result.penalties.scoreB}
                      </span>
                    )}
                  </div>
                ) : m.status === 'completed' ? (
                  <div className="flex flex-col items-end">
                    <div className="font-mono text-lg sm:text-xl font-bold text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-800 flex items-center space-x-1.5">
                      <span>{m.result?.scoreA}</span>
                      <span className="text-slate-500">-</span>
                      <span>{m.result?.scoreB}</span>
                      {isDraw && (
                        <span className="ml-1 text-[10px] font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                          DRAW
                        </span>
                      )}
                    </div>
                    {m.result?.penalties?.scoreA != null && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 mt-1">
                        Open Play: {m.result?.regularScore?.scoreA ?? (m.result.scoreA - m.result.penalties.scoreA)} - {m.result?.regularScore?.scoreB ?? (m.result.scoreB - m.result.penalties.scoreB)} | Pens: {m.result.penalties.scoreA} - {m.result.penalties.scoreB}
                      </span>
                    )}
                    {m.earlyTermination?.isTerminatedEarly &&
                      m.earlyTermination.reason !== 'Match ended before regulation full-time whistle' && (
                        <div className="mt-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-right">
                          ⚠️ Terminated Early ({m.earlyTermination.endedAtMinute}'): {m.earlyTermination.reason}
                          {m.earlyTermination.note && (
                            <span className="block text-slate-400 font-normal italic text-[9px]">"{m.earlyTermination.note}"</span>
                          )}
                        </div>
                      )}
                  </div>
                ) : (
                  <span className="text-[11px] font-mono text-slate-500 uppercase px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    Scheduled
                  </span>
                )}
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {matches.length === 0 ? (
              <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
                No fixtures scheduled yet.
              </div>
            ) : (
              <>
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pb-1">
                  <button
                    onClick={() => setFixtureFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                      fixtureFilter === 'all'
                        ? 'bg-lime-500 text-slate-950 glow-lime-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    All ({matches.length})
                  </button>
                  <button
                    onClick={() => setFixtureFilter('live')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      fixtureFilter === 'live'
                        ? 'bg-lime-500 text-slate-950 glow-lime-sm'
                        : liveMatches.length > 0
                        ? 'bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {liveMatches.length > 0 && <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />}
                    <span>Live ({liveMatches.length})</span>
                  </button>
                  <button
                    onClick={() => setFixtureFilter('upcoming')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                      fixtureFilter === 'upcoming'
                        ? 'bg-lime-500 text-slate-950 glow-lime-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Upcoming ({upcomingMatches.length})
                  </button>
                  <button
                    onClick={() => setFixtureFilter('finished')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                      fixtureFilter === 'finished'
                        ? 'bg-lime-500 text-slate-950 glow-lime-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Finished ({finishedMatches.length})
                  </button>
                </div>

                {/* 1. LIVE NOW SECTION */}
                {(fixtureFilter === 'all' || fixtureFilter === 'live') && liveMatches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-lime-400">
                      <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
                      <span>Live Now ({liveMatches.length})</span>
                    </div>
                    <div className="space-y-3">
                      {liveMatches.map(renderMatchCard)}
                    </div>
                  </div>
                )}

                {/* 2. UPCOMING SECTION */}
                {(fixtureFilter === 'all' || fixtureFilter === 'upcoming') && upcomingMatches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-400 pt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Upcoming Fixtures ({upcomingMatches.length})</span>
                    </div>
                    <div className="space-y-3">
                      {upcomingMatches.map(renderMatchCard)}
                    </div>
                  </div>
                )}

                {/* 3. FINISHED SECTION */}
                {(fixtureFilter === 'all' || fixtureFilter === 'finished') && finishedMatches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-400 pt-1">
                      <Trophy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Results & Finished ({finishedMatches.length})</span>
                    </div>
                    <div className="space-y-3">
                      {finishedMatches.map(renderMatchCard)}
                    </div>
                  </div>
                )}

                {/* Filter Empty States */}
                {fixtureFilter === 'live' && liveMatches.length === 0 && (
                  <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                    No matches currently in progress.
                  </div>
                )}
                {fixtureFilter === 'upcoming' && upcomingMatches.length === 0 && (
                  <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                    No upcoming fixtures scheduled.
                  </div>
                )}
                {fixtureFilter === 'finished' && finishedMatches.length === 0 && (
                  <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                    No completed matches yet.
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* TAB 2: STANDINGS TABLES */}
      {activeTab === 'tables' && (
        <div className="space-y-8">
          {standings.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
              Standings will appear once group fixtures are played.
            </div>
          ) : (
            standings.map((grp, gIdx) => (
              <div key={gIdx} className="glass-panel p-6 rounded-3xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-bold text-white">{grp.groupName}</h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Top 2 advance to Knockout
                    </span>
                  </div>

                  {grp.tiedPairs && grp.tiedPairs.length > 0 ? (
                    <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Tie Pending Resolution</span>
                    </div>
                  ) : grp.tiedAtCutoff ? (
                    <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Tie at Cutoff</span>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[11px]">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-2 text-center">P</th>
                        <th className="py-2.5 px-2 text-center">W</th>
                        <th className="py-2.5 px-2 text-center">D</th>
                        <th className="py-2.5 px-2 text-center">L</th>
                        <th className="py-2.5 px-2 text-center">GF</th>
                        <th className="py-2.5 px-2 text-center">GA</th>
                        <th className="py-2.5 px-2 text-center font-bold">GD</th>
                        <th className="py-2.5 px-3 text-center font-bold text-lime-400">PTS</th>
                        <th className="py-2.5 px-3 text-center hidden sm:table-cell">Form</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {grp.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={`hover:bg-slate-900/60 transition-colors ${
                            row.qualified ? 'border-l-4 border-l-lime-500' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-slate-400">{row.position}</td>
                          <td className="py-3 px-3 font-sans font-bold text-white">{row.name}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.played}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.won}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.drawn}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.lost}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.goalsFor}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.goalsAgainst}</td>
                          <td className={`py-3 px-2 text-center font-bold ${row.goalDifference > 0 ? 'text-lime-400' : row.goalDifference < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className="py-3 px-3 text-center font-extrabold text-lime-400 text-sm">
                            {row.points}
                          </td>
                          <td className="py-3 px-3 text-center hidden sm:table-cell">
                            <div className="flex items-center justify-center space-x-1">
                              {row.form && row.form.length > 0 ? (
                                row.form.map((res, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                      res === 'W'
                                        ? 'bg-lime-500 text-slate-950'
                                        : res === 'D'
                                        ? 'bg-slate-700 text-white'
                                        : 'bg-rose-500 text-white'
                                    }`}
                                  >
                                    {res}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: KNOCKOUT BRACKET */}
      {activeTab === 'bracket' && (
        <KnockoutBracket
          matches={matches.filter(m => m.stage?.format === 'knockout' || (!m.group && m.nextSlot))}
        />
      )}

      {/* TAB 4: INFO */}
      {activeTab === 'info' && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 max-w-2xl">
          <h3 className="text-lg font-bold text-white">Rules & Scoring System</h3>
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="font-bold text-white block">Points System</span>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Win: <strong className="text-lime-400">3 Points</strong></li>
                <li>Draw: <strong className="text-slate-200">1 Point</strong></li>
                <li>Loss: <strong className="text-slate-400">0 Points</strong></li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="font-bold text-white block">Tie-Breaker Hierarchy</span>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Points total</li>
                <li>Goal Difference (Goals Scored - Goals Conceded)</li>
                <li>Goals Scored (GF)</li>
                <li>Head-to-head match outcome</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
