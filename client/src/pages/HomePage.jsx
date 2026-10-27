import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, ShieldCheck, Zap, Users, Play, Radio } from 'lucide-react';

export default function HomePage() {
  const [inviteCode, setInviteCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      navigate(`/login?join=${inviteCode.trim()}`);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-lime-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center relative z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 text-xs font-medium text-slate-300 mb-8 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-lime-400 animate-pulse"></span>
          <span>Next-Gen Tournament Management</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Run complete tournaments in <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-emerald-400">minutes</span>, not spreadsheets.
        </h1>

        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed">
          Create tournaments, draw groups, auto-generate knockout brackets, assign mobile scorers, and stream live standings with zero refresh.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            to="/create"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-400 transition-all glow-lime text-base"
          >
            Create Tournament
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>

          {/* Enter Scorer Invite Code Box */}
          <form onSubmit={handleJoin} className="w-full sm:w-auto flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 focus-within:border-lime-500 transition-colors">
            <input
              type="text"
              placeholder="Enter 6-char Scorer Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="bg-transparent text-white px-4 py-2 font-mono uppercase tracking-wider text-sm focus:outline-none placeholder:text-slate-500 w-52"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors"
            >
              Join
            </button>
          </form>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto pt-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400 mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Automated Draw & Fixtures</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Circle method round-robin and bracket generator with automatic bye handling for odd numbers.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Realtime Live Scoring</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mobile scorer console pushes match events over WebSockets with under 1s latency to all viewers.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Derived Standings & Ties</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Tables are computed directly from results with configurable tie-breakers and cutoff conflict detection.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
