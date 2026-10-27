import React from 'react';
import { useParams } from 'react-router-dom';

export default function MatchDetailPage() {
  const { slug, id } = useParams();
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Match Detail</h1>
      <p className="text-slate-400 mb-6">Tournament: {slug} | Match: {id}</p>
      <div className="glass-card p-8 rounded-2xl border border-slate-800 text-center text-slate-500">
        Match details and timeline scaffolded for Phase 3.
      </div>
    </div>
  );
}
