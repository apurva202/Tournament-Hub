import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DiscoverPage from './pages/DiscoverPage';
import MyTournamentsPage from './pages/MyTournamentsPage';
import CreateTournamentPage from './pages/CreateTournamentPage';
import ManageTournamentPage from './pages/ManageTournamentPage';
import ScoreConsolePage from './pages/ScoreConsolePage';
import PublicTournamentPage from './pages/PublicTournamentPage';
import MatchDetailPage from './pages/MatchDetailPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-lime-500 selection:text-black">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/my" element={<MyTournamentsPage />} />
              <Route path="/create" element={<CreateTournamentPage />} />
              <Route path="/manage/:id" element={<ManageTournamentPage />} />
              <Route path="/score/:id" element={<ScoreConsolePage />} />
              <Route path="/t/:slug" element={<PublicTournamentPage />} />
              <Route path="/t/:slug/match/:id" element={<MatchDetailPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
            <p>Tournament Hub &bull; Live fixtures, tables, and knockout advancement</p>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
