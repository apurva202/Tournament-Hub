import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Trophy,
  PlusCircle,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Users,
  Calendar,
  Layers,
  ChevronRight,
  AlertCircle,
  Loader2,
  Star
} from 'lucide-react';
import api from '../services/api';

export default function MyTournamentsPage() {
  const [activeTab, setActiveTab] = useState('organizing');
  const [tournaments, setTournaments] = useState({ organizing: [], scoring: [], following: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Join Modal State
  const [searchParams, setSearchParams] = useSearchParams();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchTournaments();
    const queryJoin = searchParams.get('join');
    if (queryJoin) {
      setInviteCodeInput(queryJoin.toUpperCase());
      setJoinModalOpen(true);
    }
  }, []);

  const fetchTournaments = async () => {
    setLoading(false);
    try {
      setLoading(true);
      const res = await api.get('/tournaments/mine');
      setTournaments(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setJoinError('');
    setJoinLoading(true);

    try {
      const res = await api.post('/tournaments/join', { inviteCode: inviteCodeInput.trim().toUpperCase() });
      setJoinModalOpen(false);
      setInviteCodeInput('');
      // Clean query parameter
      setSearchParams({});
      // Refresh tournaments list and switch to scoring tab
      await fetchTournaments();
      setActiveTab('scoring');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Invalid invite code or unable to join');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleUnfollow = async (tournamentId) => {
    try {
      await api.delete(`/tournaments/${tournamentId}/save`);
      setTournaments((prev) => ({
        ...prev,
        following: prev.following.filter((t) => t._id !== tournamentId)
      }));
    } catch (err) {
      console.error('Failed to unfollow tournament:', err);
    }
  };

  const currentList = tournaments[activeTab] || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Tournaments</h1>
          <p className="text-slate-400 text-sm mt-1">Manage events, record live scores, and track tournaments</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setJoinModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-sm font-semibold transition-colors"
          >
            <KeyRound className="w-4 h-4 text-lime-400" />
            <span>Join as Scorer</span>
          </button>

          <Link
            to="/create"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-lime-500 text-slate-950 text-sm font-bold hover:bg-lime-400 transition-all glow-lime-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Tournament</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8 space-x-2 sm:space-x-4">
        {[
          { key: 'organizing', label: 'Organizing', count: tournaments.organizing?.length || 0 },
          { key: 'scoring', label: 'Scoring', count: tournaments.scoring?.length || 0 },
          { key: 'following', label: 'Following', count: tournaments.following?.length || 0 }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-lime-400 text-lime-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === tab.key ? 'bg-lime-500/20 text-lime-400' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-card p-6 rounded-2xl border border-slate-800 animate-pulse h-48" />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center max-w-lg mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-4">
            <Trophy className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            No {activeTab} tournaments yet
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            {activeTab === 'organizing' && "You haven't created any tournaments yet. Spin one up in under a minute!"}
            {activeTab === 'scoring' && "You haven't joined any tournaments as a scorer. Enter an invite code from the organizer."}
            {activeTab === 'following' && "You haven't followed any tournaments. Explore public events and star your favorites."}
          </p>
          {activeTab === 'organizing' ? (
            <Link
              to="/create"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-400 transition-all glow-lime-sm text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Tournament</span>
            </Link>
          ) : activeTab === 'scoring' ? (
            <button
              onClick={() => setJoinModalOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-400 transition-all glow-lime-sm text-sm"
            >
              <KeyRound className="w-4 h-4" />
              <span>Enter Scorer Code</span>
            </button>
          ) : (
            <Link
              to="/discover"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all text-sm"
            >
              <span>Browse Discover</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentList.map((t) => (
            <div
              key={t._id}
              className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full ${
                      t.status === 'live'
                        ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30 animate-pulse'
                        : t.status === 'completed'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {t.status}
                  </span>

                  <span className="text-xs text-slate-500 capitalize">
                    {t.visibility} &bull; {t.participantType}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-lime-400 transition-colors line-clamp-1 mb-2">
                  {t.name}
                </h3>

                {/* Scorer Invite Code Widget (for organizers) */}
                {activeTab === 'organizing' && (
                  <div className="my-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Scorer Code:</span>
                    <button
                      onClick={() => handleCopy(t.inviteCode)}
                      className="flex items-center space-x-1.5 font-mono font-bold text-lime-400 hover:text-lime-300"
                      title="Click to copy invite code"
                    >
                      <span>{t.inviteCode}</span>
                      {copiedCode === t.inviteCode ? (
                        <Check className="w-3.5 h-3.5 text-lime-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                <Link
                  to={`/t/${t.slug}`}
                  target="_blank"
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Public Page</span>
                </Link>

                {activeTab === 'organizing' ? (
                  <Link
                    to={`/manage/${t._id}`}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-lime-500/10 text-lime-400 hover:bg-lime-500/20 border border-lime-500/30 font-semibold text-xs transition-colors"
                  >
                    <span>Manage</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : activeTab === 'scoring' ? (
                  <Link
                    to={`/score/${t._id}`}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 font-semibold text-xs transition-colors"
                  >
                    <span>Score Console</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUnfollow(t._id)}
                      title="Unfollow Tournament"
                      className="p-1.5 rounded-lg text-amber-400 hover:text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      <Star className="w-4 h-4 fill-amber-400" />
                    </button>
                    <Link
                      to={`/t/${t.slug}`}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-lime-500/10 text-lime-400 hover:bg-lime-500/20 border border-lime-500/30 font-semibold text-xs transition-colors"
                    >
                      <span>View Hub</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Join as Scorer Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-1">Join as Scorer</h2>
            <p className="text-slate-400 text-xs mb-6">
              Enter the 6-character code provided by the tournament organizer to gain live scoring rights.
            </p>

            {joinError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  6-Character Invite Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 7A8B9C"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono uppercase text-center text-xl tracking-widest focus:outline-none focus:border-lime-500 transition-colors"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setJoinModalOpen(false);
                    setJoinError('');
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading || inviteCodeInput.trim().length !== 6}
                  className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-sm font-bold transition-all glow-lime-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Join Now</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
