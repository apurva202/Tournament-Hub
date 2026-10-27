import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Eye,
  Lock,
  Globe,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import api from '../services/api';

export default function CreateTournamentPage() {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('unlisted');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Football preset values
  const footballPreset = {
    key: 'football',
    label: 'Football (Soccer)',
    participantType: 'team',
    scoreboardType: 'score',
    scoreLabel: 'Goals',
    allowDraw: true,
    points: { win: 3, draw: 1, loss: 0 },
    tieBreakers: ['points', 'scoreDifference', 'scoredFor', 'headToHead'],
    roster: { min: 5, max: 11 }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tournament name is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        presetKey: 'football',
        visibility
      };

      const res = await api.post('/tournaments', payload);
      navigate(`/manage/${res.data.tournament._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create tournament. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create a Football Tournament</h1>
        <p className="text-slate-400 text-sm mt-1">
          Standard football rules: 3 pts for a win, 1 pt for a draw, goals scored, and goal difference standings.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Preset Display */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Sport Format
            </label>
            <div className="p-4 rounded-xl border bg-lime-500/10 border-lime-400/40 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-lime-500/20 text-lime-400 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Football (Soccer)</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Team format &bull; Goals scoring &bull; Win: 3pts, Draw: 1pt
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-lime-400/20 text-lime-400 font-semibold border border-lime-400/30">
                Preset Active
              </span>
            </div>
          </div>

          {/* Tournament Name */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Scaler Champions League"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm font-medium transition-colors"
            />
          </div>

          {/* Visibility Options */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Visibility
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  key: 'unlisted',
                  title: 'Unlisted',
                  desc: 'Anyone with the direct link can view (Default)',
                  icon: Eye
                },
                {
                  key: 'public',
                  title: 'Public',
                  desc: 'Listed on Discover & search engine indexed',
                  icon: Globe
                },
                {
                  key: 'private',
                  title: 'Private',
                  desc: 'Organizers and scorers only (404 to guests)',
                  icon: Lock
                }
              ].map((vis) => {
                const isSelected = visibility === vis.key;
                const Icon = vis.icon;
                return (
                  <button
                    key={vis.key}
                    type="button"
                    onClick={() => setVisibility(vis.key)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-lime-500/10 border-lime-400 text-white glow-lime-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-2 ${isSelected ? 'text-lime-400' : 'text-slate-400'}`} />
                    <div className="font-bold text-sm">{vis.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{vis.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-base transition-all glow-lime flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Create & Configure Tournament</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Live Summary Card */}
        <div>
          <div className="sticky top-24 glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Tournament Summary
            </h3>

            <div className="space-y-4 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-1">Name</span>
                <span className="font-bold text-white text-base">
                  {name.trim() || 'Untitled Tournament'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/60">
                  <span className="text-slate-500 block mb-0.5">Preset</span>
                  <span className="font-semibold text-lime-400">Football</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/60">
                  <span className="text-slate-500 block mb-0.5">Visibility</span>
                  <span className="font-semibold capitalize text-white">{visibility}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-1.5">Rules & Points</span>
                <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                  <span>Win: <strong className="text-lime-400">+3 pts</strong></span>
                  <span>Draw: <strong className="text-slate-200">+1 pt</strong></span>
                  <span>Loss: <strong className="text-slate-400">0 pts</strong></span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Score Unit:</span>
                  <strong className="text-white">Goals</strong>
                </div>
                <div className="flex justify-between">
                  <span>Standings:</span>
                  <strong className="text-white text-[11px]">Points &bull; GD &bull; Scored &bull; H2H</strong>
                </div>
                <div className="flex justify-between">
                  <span>Roster:</span>
                  <strong className="text-white">5 to 11 players</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/20 text-xs text-lime-300">
                &bull; A 6-char Scorer Invite Code and public slug will be generated automatically.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
