import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, Compass, PlusCircle, User, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 group-hover:scale-105 group-hover:bg-lime-500/20 transition-all duration-200">
              <Trophy className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-lime-400 transition-colors">
                Tournament<span className="text-lime-400">Hub</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-mono uppercase px-2 py-0.5 rounded bg-lime-400/10 text-lime-400 border border-lime-400/20">
                v1.0
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            <Link
              to="/discover"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Discover</span>
            </Link>

            {user ? (
              <>
                <Link
                  to="/my"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Trophy className="w-4 h-4 text-slate-400" />
                  <span>My Tournaments</span>
                </Link>

                <Link
                  to="/create"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-lime-500 text-slate-950 font-semibold hover:bg-lime-400 transition-all glow-lime-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Create</span>
                </Link>

                <div className="flex items-center pl-2 ml-2 border-l border-slate-800 space-x-2">
                  <span className="text-xs font-medium text-slate-400 hidden md:inline">
                    {user.name}
                  </span>
                  <button
                    onClick={handleLogout}
                    title="Log out"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-lime-500 text-slate-950 hover:bg-lime-400 transition-all glow-lime-sm"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
