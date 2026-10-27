import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  Search,
  Trophy,
  Users,
  Calendar,
  Layers,
  Star,
  Radio,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DiscoverPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'live' | 'draft' | 'completed'

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Set of saved tournament IDs for the logged-in user
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load user's saved tournaments if logged in
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }

    const fetchSaved = async () => {
      try {
        const res = await api.get('/saved');
        const ids = new Set((res.data.saved || []).map((t) => t._id));
        setSavedIds(ids);
      } catch (err) {
        console.error('Failed to load saved tournaments:', err);
      }
    };

    fetchSaved();
  }, [user]);

  // Fetch public tournaments
  const fetchPublicTournaments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: currentPage,
        limit: 9
      };
      if (debouncedQuery.trim()) {
        params.q = debouncedQuery.trim();
      }

      const res = await api.get('/public/search', { params });
      let list = res.data.tournaments || [];

      // Filter by status if selected
      if (statusFilter !== 'all') {
        list = list.filter((t) => t.status === statusFilter);
      }

      setTournaments(list);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search public tournaments');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, currentPage, statusFilter]);

  useEffect(() => {
    fetchPublicTournaments();
  }, [fetchPublicTournaments]);

  // Handle Save / Unsave tournament
  const handleToggleSave = async (e, tournamentId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/login');
      return;
    }

    setSavingId(tournamentId);
    const isCurrentlySaved = savedIds.has(tournamentId);

    try {
      if (isCurrentlySaved) {
        await api.delete(`/tournaments/${tournamentId}/save`);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(tournamentId);
          return next;
        });
      } else {
        await api.post(`/tournaments/${tournamentId}/save`);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.add(tournamentId);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update save status:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <Compass className="w-3.5 h-3.5" />
            <span>Community Arena</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Discover Public Tournaments
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Explore live and upcoming football tournaments worldwide. Track tables, review fixtures, and follow your favorite events.
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tournaments by name..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-lime-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="flex items-center space-x-2">
          {[
            { key: 'all', label: 'All Events' },
            { key: 'live', label: 'Live Now', icon: Radio },
            { key: 'draft', label: 'Draft / Upcoming' },
            { key: 'completed', label: 'Completed' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-lime-500 text-slate-950 glow-lime-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {Icon && (
                  <Icon
                    className={`w-3 h-3 ${isSelected ? 'text-slate-950 animate-pulse' : 'text-lime-400'}`}
                  />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Showing {tournaments.length} of {totalCount} public tournaments
        </span>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-lime-400 mb-3" />
          <p className="text-slate-400 text-xs">Searching tournaments...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-400 text-sm">
          {error}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center max-w-md mx-auto my-8">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No Tournaments Found</h3>
          <p className="text-slate-400 text-xs mb-6">
            {debouncedQuery
              ? `No public tournaments match "${debouncedQuery}". Try a different keyword.`
              : 'There are no public tournaments in this category right now.'}
          </p>
          {user && (
            <Link
              to="/create"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create the First Public Tournament</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => {
            const isSaved = savedIds.has(t._id);
            const isSaving = savingId === t._id;

            return (
              <div
                key={t._id}
                onClick={() => navigate(`/t/${t.slug}`)}
                className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-lime-500/40 transition-all cursor-pointer flex flex-col justify-between group hover:-translate-y-0.5"
              >
                <div>
                  {/* Card Header: Badges & Star Button */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          t.status === 'live'
                            ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30 animate-pulse'
                            : t.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        Football
                      </span>
                    </div>

                    {/* Star / Follow Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleSave(e, t._id)}
                      disabled={isSaving}
                      title={isSaved ? 'Unfollow Tournament' : 'Follow Tournament'}
                      className={`p-2 rounded-xl transition-all border ${
                        isSaved
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-amber-400 hover:border-slate-700'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      ) : (
                        <Star
                          className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                            isSaved ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      )}
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white group-hover:text-lime-400 transition-colors line-clamp-1 mb-2">
                    {t.name}
                  </h3>

                  {/* Meta stats */}
                  <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Teams</span>
                      <span className="font-extrabold text-white text-sm">
                        {t.counts?.participants || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Stages</span>
                      <span className="font-extrabold text-white text-sm">
                        {t.counts?.stages || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Matches</span>
                      <span className="font-extrabold text-white text-sm">
                        {t.counts?.matches || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">
                    /t/{t.slug}
                  </span>
                  <span className="text-lime-400 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center space-x-1">
                    <span>View Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-3 mt-10">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-400 px-3">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
