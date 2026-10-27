import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Layers,
  Calendar,
  KeyRound,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Shuffle,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { useTournamentSocket } from '../services/socket';
import KnockoutBracket from '../components/KnockoutBracket';
import MatchTimer from '../components/MatchTimer';

export default function ManageTournamentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [stages, setStages] = useState([]);
  const [matches, setMatches] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  const [fixtureFilter, setFixtureFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal States
  const [addTeamModal, setAddTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [playerInput, setPlayerInput] = useState('');
  const [teamSeed, setTeamSeed] = useState(0);
  const [submittingTeam, setSubmittingTeam] = useState(false);

  const [addStageModal, setAddStageModal] = useState(false);
  const [stageName, setStageName] = useState('Group Stage');
  const [stageFormat, setStageFormat] = useState('roundRobin');
  const [topPerGroup, setTopPerGroup] = useState(2);

  const [drawGroupCount, setDrawGroupCount] = useState(2);
  const [drawingGroups, setDrawingGroups] = useState(false);

  const [generatingFixtures, setGeneratingFixtures] = useState(false);
  const [fixtureRulesModal, setFixtureRulesModal] = useState(false);
  const [stageToGenerate, setStageToGenerate] = useState(null);

  const [manualMatchModal, setManualMatchModal] = useState(false);
  const [manualTeamA, setManualTeamA] = useState('');
  const [manualTeamB, setManualTeamB] = useState('');
  const [manualRound, setManualRound] = useState(1);
  const [manualVenue, setManualVenue] = useState('');
  const [manualSelectedStage, setManualSelectedStage] = useState('');

  // Match Scheduling Modal States
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedMatchForSchedule, setSelectedMatchForSchedule] = useState(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleVenue, setScheduleVenue] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Stage Advancement Modal States
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [stageToAdvance, setStageToAdvance] = useState(null);
  const [qualifiersData, setQualifiersData] = useState(null);
  const [loadingQualifiers, setLoadingQualifiers] = useState(false);
  const [advancingStage, setAdvancingStage] = useState(false);

  // Tie-breaker States
  const [tieModalOpen, setTieModalOpen] = useState(false);
  const [tieModalMode, setTieModalMode] = useState('options'); // 'options' | 'manual' | 'rematch'
  const [selectedTiePair, setSelectedTiePair] = useState(null);
  const [selectedTieStage, setSelectedTieStage] = useState(null);
  const [tieRematchDateTime, setTieRematchDateTime] = useState('');
  const [tieRematchVenue, setTieRematchVenue] = useState('Pitch 1');
  const [submittingTieAction, setSubmittingTieAction] = useState(false);

  // Settings tab states
  const [settingsName, setSettingsName] = useState('');
  const [settingsVisibility, setSettingsVisibility] = useState('unlisted');
  const [savingSettings, setSavingSettings] = useState(false);

  // Real-time socket events subscription
  useTournamentSocket(id, {
    onMatchUpdate: (updatedMatch) => {
      setMatches((prev) =>
        prev.map((m) => (m._id === updatedMatch._id ? { ...m, ...updatedMatch } : m))
      );
    },
    onStandingsUpdate: () => {
      loadTournamentData();
    },
    onStageAdvanced: () => {
      loadTournamentData();
      showNotification('Stage advanced to Knockout Stage!');
    }
  });

  // Expandable team roster toggle
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  useEffect(() => {
    loadTournamentData();
  }, [id]);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const loadTournamentData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tRes, pRes, sRes, mRes, memRes] = await Promise.all([
        api.get(`/tournaments/${id}`),
        api.get(`/tournaments/${id}/participants`),
        api.get(`/tournaments/${id}/stages`),
        api.get(`/tournaments/${id}/matches`),
        api.get(`/tournaments/${id}/members`)
      ]);

      setTournament(tRes.data.tournament);
      setParticipants(pRes.data.participants);
      setStages(sRes.data.stages);
      setMatches(mRes.data.matches);
      setMembers(memRes.data.members);
      setSettingsName(tRes.data.tournament.name);
      setSettingsVisibility(tRes.data.tournament.visibility || 'unlisted');

      if (sRes.data.stages.length > 0 && !manualSelectedStage) {
        setManualSelectedStage(sRes.data.stages[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tournament management data');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!tournament) return;
    navigator.clipboard.writeText(tournament.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPublicLink = () => {
    if (!tournament) return;
    const url = `${window.location.origin}/t/${tournament.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Add Team
  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setSubmittingTeam(true);
    setError('');

    try {
      const players = playerInput
        .split('\n')
        .map(p => p.trim())
        .filter(Boolean);

      const res = await api.post(`/tournaments/${id}/participants`, {
        name: teamName.trim(),
        players,
        seed: Number(teamSeed) || 0
      });

      setParticipants([...participants, res.data.participant]);
      setAddTeamModal(false);
      setTeamName('');
      setPlayerInput('');
      setTeamSeed(0);
      showNotification(`Team "${res.data.participant.name}" added successfully!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add team');
    } finally {
      setSubmittingTeam(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (pId, pName) => {
    if (!window.confirm(`Delete team "${pName}"?`)) return;
    try {
      await api.delete(`/participants/${pId}`);
      setParticipants(participants.filter(p => p._id !== pId));
      showNotification(`Team "${pName}" deleted`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete team');
    }
  };

  const handleOpenAddStageModal = () => {
    const hasGroup = stages.some(s => s.format === 'roundRobin');
    if (hasGroup) {
      setStageName('Knockout Stage');
      setStageFormat('knockout');
    } else {
      setStageName('Group Stage');
      setStageFormat('roundRobin');
    }
    setAddStageModal(true);
  };

  // Create Stage
  const handleCreateStage = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/tournaments/${id}/stages`, {
        name: stageName,
        format: stageFormat,
        advancement: { topPerGroup: Number(topPerGroup) }
      });
      setStages([...stages, res.data.stage]);
      setAddStageModal(false);
      showNotification(`Stage "${res.data.stage.name}" created!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create stage');
    }
  };

  // Draw Groups
  const handleDrawGroups = async (stageId) => {
    setDrawingGroups(true);
    setError('');
    try {
      const res = await api.post(`/stages/${stageId}/draw`, {
        groupCount: Number(drawGroupCount),
        mode: 'auto'
      });
      // Update stage in state
      setStages(stages.map(s => (s._id === stageId ? res.data.stage : s)));
      // Refresh participants to show group labels
      const pRes = await api.get(`/tournaments/${id}/participants`);
      setParticipants(pRes.data.participants);
      showNotification('Groups drawn successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to draw groups');
    } finally {
      setDrawingGroups(false);
    }
  };

  // Delete Stage
  const handleDeleteStage = async (stageId, stageName) => {
    if (!window.confirm(`Delete stage "${stageName}" and its scheduled matches?`)) return;
    try {
      await api.delete(`/stages/${stageId}`);
      showNotification(`Stage "${stageName}" deleted`);
      await loadTournamentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete stage');
    }
  };

  // Open rules confirmation before generating fixtures
  const promptGenerateFixtures = (stage) => {
    setStageToGenerate(stage);
    setFixtureRulesModal(true);
  };

  // Confirm and Generate Fixtures
  const handleConfirmGenerateFixtures = async () => {
    if (!stageToGenerate) return;
    setGeneratingFixtures(true);
    setError('');
    try {
      const res = await api.post(`/stages/${stageToGenerate._id}/fixtures`);
      setFixtureRulesModal(false);
      showNotification(res.data.message || 'Fixtures generated successfully!');
      await loadTournamentData();
      setActiveTab('fixtures');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate fixtures');
    } finally {
      setGeneratingFixtures(false);
    }
  };

  // Open advance modal and load qualifiers preview
  const handleOpenAdvanceModal = async (stage) => {
    setStageToAdvance(stage);
    setAdvanceModalOpen(true);
    setLoadingQualifiers(true);
    setQualifiersData(null);
    setError('');
    try {
      const res = await api.get(`/stages/${stage._id}/qualifiers`);
      setQualifiersData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load stage qualifiers');
    } finally {
      setLoadingQualifiers(false);
    }
  };

  // Confirm and advance stage to knockout
  const handleConfirmAdvance = async () => {
    if (!stageToAdvance) return;
    setAdvancingStage(true);
    setError('');
    try {
      const res = await api.post(`/stages/${stageToAdvance._id}/advance`);
      setAdvanceModalOpen(false);
      showNotification(res.data.message || 'Successfully advanced to Knockout Stage!');
      await loadTournamentData();
      setActiveTab('bracket');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to advance stage');
    } finally {
      setAdvancingStage(false);
    }
  };

  // Open Tie Resolution Modal
  const handleOpenTieModal = (stage, pair, initialMode = 'options') => {
    setSelectedTieStage(stage);
    setSelectedTiePair(pair);
    setTieModalMode(initialMode);
    setTieRematchDateTime('');
    setTieRematchVenue('Pitch 1');
    setTieModalOpen(true);
  };

  // Submit manual ranking order
  const handleResolveTieManual = async (ranking) => {
    if (!selectedTieStage || !selectedTiePair) return;
    setSubmittingTieAction(true);
    setError('');
    try {
      await api.post(`/stages/${selectedTieStage._id}/tie-breaker/resolve`, {
        group: selectedTiePair.groupName,
        ranking
      });
      showNotification(`Rank order saved for ${selectedTiePair.groupName}!`);
      setTieModalOpen(false);
      if (advanceModalOpen) {
        handleOpenAdvanceModal(selectedTieStage);
      }
      await loadTournamentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record manual ranking');
    } finally {
      setSubmittingTieAction(false);
    }
  };

  // Schedule tiebreaker rematch fixture
  const handleScheduleTieRematch = async (e) => {
    e.preventDefault();
    if (!selectedTieStage || !selectedTiePair) return;
    setSubmittingTieAction(true);
    setError('');
    try {
      await api.post(`/stages/${selectedTieStage._id}/tie-breaker/rematch`, {
        group: selectedTiePair.groupName,
        teamAId: selectedTiePair.teamA.participantId,
        teamBId: selectedTiePair.teamB.participantId,
        scheduledAt: tieRematchDateTime ? new Date(tieRematchDateTime).toISOString() : null,
        venue: tieRematchVenue.trim()
      });
      showNotification(`Rematch scheduled: ${selectedTiePair.teamA.name} vs ${selectedTiePair.teamB.name}!`);
      setTieModalOpen(false);
      if (advanceModalOpen) {
        handleOpenAdvanceModal(selectedTieStage);
      }
      await loadTournamentData();
      setActiveTab('fixtures');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule rematch');
    } finally {
      setSubmittingTieAction(false);
    }
  };

  // Create Manual Match
  const handleCreateManualMatch = async (e) => {
    e.preventDefault();
    if (!manualTeamA || !manualTeamB) return;
    try {
      const res = await api.post(`/stages/${manualSelectedStage}/matches`, {
        teamA: manualTeamA,
        teamB: manualTeamB,
        round: Number(manualRound) || 1,
        venue: manualVenue
      });
      setMatches([...matches, res.data.match]);
      setManualMatchModal(false);
      setManualTeamA('');
      setManualTeamB('');
      setManualVenue('');
      showNotification('Manual match fixture created!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create match');
    }
  };

  // Format match schedule date & venue
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

  // Open schedule modal
  const handleOpenScheduleModal = (match) => {
    setSelectedMatchForSchedule(match);
    if (match.scheduledAt) {
      const d = new Date(match.scheduledAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setScheduleDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setScheduleDateTime('');
    }
    setScheduleVenue(match.venue || '');
    setScheduleModalOpen(true);
  };

  // Save match schedule
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!selectedMatchForSchedule) return;
    setSavingSchedule(true);
    setError('');
    try {
      const res = await api.put(`/matches/${selectedMatchForSchedule._id}`, {
        scheduledAt: scheduleDateTime ? new Date(scheduleDateTime).toISOString() : null,
        venue: scheduleVenue.trim()
      });
      setMatches(matches.map(m => (m._id === selectedMatchForSchedule._id ? res.data.match : m)));
      setScheduleModalOpen(false);
      showNotification('Match schedule updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Regenerate Invite Code
  const handleRegenerateCode = async () => {
    if (!window.confirm('Regenerate invite code? The old code will stop working.')) return;
    try {
      const res = await api.post(`/tournaments/${id}/invite/regenerate`);
      setTournament({ ...tournament, inviteCode: res.data.inviteCode });
      showNotification('New invite code generated!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate code');
    }
  };

  // Remove Member
  const handleRemoveMember = async (userId, userName) => {
    if (!window.confirm(`Remove ${userName} from scorers?`)) return;
    try {
      await api.delete(`/tournaments/${id}/members/${userId}`);
      setMembers(members.filter(m => m.user._id !== userId));
      showNotification(`${userName} removed from scorers`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  // Delete Tournament
  const handleDeleteTournament = async () => {
    if (!window.confirm(`Are you SURE you want to permanently delete "${tournament?.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tournaments/${id}`);
      navigate('/my');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete tournament');
    }
  };

  // Save Tournament Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settingsName.trim()) return;
    setSavingSettings(true);
    setError('');
    try {
      const res = await api.put(`/tournaments/${id}`, {
        name: settingsName.trim(),
        visibility: settingsVisibility
      });
      setTournament(res.data.tournament);
      showNotification('Tournament settings saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lime-400 mb-3" />
        <p className="text-slate-400 text-sm">Loading organizer dashboard...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 text-center glass-panel rounded-2xl border border-slate-800">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Tournament Not Found</h2>
        <p className="text-slate-400 text-sm mb-4">You may not have permissions or it was deleted.</p>
        <Link to="/my" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700">
          Back to My Tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Banner & Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-lime-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span
                className={`text-xs font-mono uppercase font-bold px-2.5 py-0.5 rounded-full ${
                  tournament.status === 'live'
                    ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30 animate-pulse'
                    : tournament.status === 'completed'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {tournament.status}
              </span>

              <span className="text-xs text-slate-400 font-medium capitalize px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {tournament.visibility}
              </span>

              <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                Football &bull; Goals
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {tournament.name}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Scorer Invite Code Widget */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <KeyRound className="w-3.5 h-3.5 text-lime-400 mr-2" />
              <div className="text-left mr-3">
                <span className="text-[10px] text-slate-500 block uppercase leading-none font-semibold">Scorer Code</span>
                <span className="font-mono text-sm font-bold text-white">{tournament.inviteCode}</span>
              </div>
              <button
                onClick={handleCopyCode}
                title="Copy Scorer Code"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Public Link */}
            <button
              onClick={handleCopyPublicLink}
              title="Copy Public Link"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>{copiedLink ? 'Link Copied!' : 'Public Page'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center space-x-3 text-lime-400 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 mb-8 overflow-x-auto space-x-1 sm:space-x-3">
        {[
          { key: 'overview', label: 'Overview', icon: Trophy },
          { key: 'teams', label: `Teams (${participants.length})`, icon: Users },
          { key: 'stages', label: `Stages & Draw (${stages.length})`, icon: Layers },
          { key: 'fixtures', label: `Fixtures (${matches.length})`, icon: Calendar },
          { key: 'bracket', label: 'Bracket', icon: Trophy },
          { key: 'scorers', label: `Scorers (${members.length})`, icon: KeyRound },
          { key: 'settings', label: 'Settings', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 whitespace-nowrap transition-colors ${
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Registered Teams</span>
              <span className="text-2xl font-extrabold text-white">{participants.length}</span>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Stages</span>
              <span className="text-2xl font-extrabold text-white">{stages.length}</span>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Total Matches</span>
              <span className="text-2xl font-extrabold text-white">{matches.length}</span>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Assigned Scorers</span>
              <span className="text-2xl font-extrabold text-lime-400">{members.length}</span>
            </div>
          </div>

          {/* Quick Guide / Next Step */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Tournament Setup Workflow
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className={`p-4 rounded-xl border ${participants.length >= 4 ? 'bg-lime-500/10 border-lime-500/30 text-lime-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <div className="font-bold mb-1 flex items-center justify-between">
                  <span>1. Add Teams</span>
                  {participants.length >= 4 && <Check className="w-3.5 h-3.5 text-lime-400" />}
                </div>
                <span>{participants.length} teams registered (need at least 2)</span>
              </div>

              <div className={`p-4 rounded-xl border ${stages.length > 0 ? 'bg-lime-500/10 border-lime-500/30 text-lime-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <div className="font-bold mb-1 flex items-center justify-between">
                  <span>2. Create Stage</span>
                  {stages.length > 0 && <Check className="w-3.5 h-3.5 text-lime-400" />}
                </div>
                <span>{stages.length > 0 ? `${stages[0].name} (${stages[0].format})` : 'Create a Group or Knockout stage'}</span>
              </div>

              <div className={`p-4 rounded-xl border ${stages.some(s => s.groups?.length > 0) ? 'bg-lime-500/10 border-lime-500/30 text-lime-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <div className="font-bold mb-1 flex items-center justify-between">
                  <span>3. Draw Groups</span>
                  {stages.some(s => s.groups?.length > 0) && <Check className="w-3.5 h-3.5 text-lime-400" />}
                </div>
                <span>Auto-partition teams into balanced groups</span>
              </div>

              <div className={`p-4 rounded-xl border ${matches.length > 0 ? 'bg-lime-500/10 border-lime-500/30 text-lime-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <div className="font-bold mb-1 flex items-center justify-between">
                  <span>4. Generate Fixtures</span>
                  {matches.length > 0 && <Check className="w-3.5 h-3.5 text-lime-400" />}
                </div>
                <span>{matches.length > 0 ? `${matches.length} fixtures generated` : 'Generate round-robin or knockout matches'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Registered Teams</h2>
              <p className="text-slate-400 text-xs mt-0.5">Football team rosters (5 to 11 players each)</p>
            </div>
            <button
              onClick={() => setAddTeamModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-lime-500 text-slate-950 text-xs font-bold hover:bg-lime-400 transition-all glow-lime-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Team</span>
            </button>
          </div>

          {participants.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center">
              <Users className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No teams added yet</h3>
              <p className="text-slate-400 text-xs mb-4">Add teams and their player rosters to run the draw.</p>
              <button
                onClick={() => setAddTeamModal(true)}
                className="px-4 py-2 rounded-xl bg-lime-500 text-slate-950 text-xs font-bold"
              >
                Add Your First Team
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.map((p) => {
                const isExpanded = expandedTeamId === p._id;
                return (
                  <div key={p._id} className="glass-card p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400 font-bold flex items-center justify-center text-sm">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{p.name}</h4>
                          <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                            <span>{p.players?.length || 0} players</span>
                            {p.groupAssignment && (
                              <span className="font-mono text-lime-400 font-semibold bg-lime-400/10 px-1.5 py-0.5 rounded text-[10px]">
                                {p.groupAssignment.groupName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {p.players && p.players.length > 0 && (
                          <button
                            onClick={() => setExpandedTeamId(isExpanded ? null : p._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="View Players"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTeam(p._id, p.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete Team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Player List */}
                    {isExpanded && p.players && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5 animate-in fade-in">
                        {p.players.map((player, idx) => (
                          <span key={idx} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                            {player.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STAGES & DRAW */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Stages & Group Draw</h2>
              <p className="text-slate-400 text-xs mt-0.5">Create round-robin group stages or knockout brackets</p>
            </div>
            <button
              onClick={handleOpenAddStageModal}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-lime-500 text-slate-950 text-xs font-bold hover:bg-lime-400 transition-all glow-lime-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Stage</span>
            </button>
          </div>

          {/* Teams Requirement Warning if under 4 teams */}
          {participants.length < 4 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-300 text-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>You need at least 4 teams to draw groups (currently have {participants.length}/4).</span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('teams');
                  setAddTeamModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
              >
                + Add Teams Now
              </button>
            </div>
          )}

          {stages.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center">
              <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Stages Created Yet</h3>
              <p className="text-slate-400 text-xs mb-4 max-w-sm mx-auto">
                First, create a Group Stage (Round Robin). Then you will be able to draw teams into groups and generate matches.
              </p>
              <button
                onClick={handleOpenAddStageModal}
                className="px-5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group Stage</span>
              </button>
            </div>
          ) : (
            stages.map((stage) => (
              <div key={stage._id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-lime-400 font-bold">Stage {stage.order}</span>
                      <h3 className="text-lg font-bold text-white">{stage.name}</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {stage.format}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Advancement: Top {stage.advancement?.topPerGroup || 2} teams per group advance to knockout
                    </span>
                  </div>

                  {/* Actions for this stage */}
                  <div className="flex flex-wrap items-center gap-2">
                    {stage.format === 'roundRobin' && (
                      <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
                        <select
                          value={drawGroupCount}
                          onChange={(e) => setDrawGroupCount(e.target.value)}
                          className="bg-transparent text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                        >
                          <option value="2">2 Groups</option>
                          {participants.length >= 6 && <option value="3">3 Groups</option>}
                          {participants.length >= 8 && <option value="4">4 Groups</option>}
                        </select>
                        <button
                          onClick={() => handleDrawGroups(stage._id)}
                          disabled={drawingGroups || participants.length < 4}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm disabled:opacity-40"
                          title={participants.length < 4 ? 'Add at least 4 teams first' : 'Draw teams into groups'}
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>{drawingGroups ? 'Drawing...' : 'Draw Groups'}</span>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => promptGenerateFixtures(stage)}
                      disabled={generatingFixtures || (stage.format === 'roundRobin' && (!stage.groups || stage.groups.length === 0))}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors disabled:opacity-40"
                      title={stage.format === 'roundRobin' && (!stage.groups || stage.groups.length === 0) ? 'Draw groups first before generating fixtures' : 'Review rules & generate fixtures'}
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-lime-400" />
                      <span>Generate Fixtures</span>
                    </button>

                    {stage.format === 'roundRobin' && matches.some(m => (m.stage?._id || m.stage) === stage._id) && (
                      <button
                        onClick={() => handleOpenAdvanceModal(stage)}
                        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm"
                        title="Preview qualifiers and advance to Knockout stage"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Advance to Knockout</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteStage(stage._id, stage.name)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                      title="Delete Stage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Groups Display */}
                {stage.groups && stage.groups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stage.groups.map((grp, gIdx) => (
                      <div key={gIdx} className="glass-card p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-white text-sm">{grp.name}</span>
                          <span className="text-xs text-slate-400 font-mono">
                            {grp.participants?.length || 0} teams
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {grp.participants?.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs">
                              <span className="font-medium text-slate-200">{p.name || 'Team'}</span>
                              <span className="text-slate-500 text-[10px]">#{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    Groups not drawn yet. Click "Draw Groups" above to automatically seed teams into groups.
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: FIXTURES */}
      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Match Schedule</h2>
              <p className="text-slate-400 text-xs mt-0.5">{matches.length} matches created across all stages</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setManualMatchModal(true)}
                disabled={participants.length < 2 || stages.length === 0}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual Match</span>
              </button>
            </div>
          </div>

          {matches.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center">
              <Calendar className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No fixtures generated</h3>
              <p className="text-slate-400 text-xs mb-4">Go to Stages & Draw tab and click "Generate Fixtures".</p>
              <button
                onClick={() => setActiveTab('stages')}
                className="px-4 py-2 rounded-xl bg-lime-500 text-slate-950 text-xs font-bold"
              >
                Go to Stages & Draw
              </button>
            </div>
          ) : (
            (() => {
              const liveMatches = matches.filter(m => m.status === 'live');
              const upcomingMatches = matches.filter(m => m.status === 'scheduled');
              const finishedMatches = matches.filter(m => m.status === 'completed');

              const renderMatchCard = (m) => {
                const isWinnerA = m.status === 'completed' && m.result?.winner === 'A';
                const isWinnerB = m.status === 'completed' && m.result?.winner === 'B';
                const isDraw = m.status === 'completed' && m.result?.winner === 'draw';

                return (
                  <div
                    key={m._id}
                    className={`glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      m.status === 'live'
                        ? 'border-lime-500/60 bg-gradient-to-r from-lime-950/20 to-slate-900/90 shadow-lg shadow-lime-500/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="flex items-center space-x-2 w-28">
                        <span className="font-mono text-xs text-slate-400 font-semibold">
                          {m.roundLabel || `Round ${m.round}`}
                        </span>
                        {m.status === 'live' && (
                          <span className="flex items-center space-x-1 text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded-full bg-lime-500/20 text-lime-400 border border-lime-500/40 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                            <span>LIVE</span>
                          </span>
                        )}
                        {m.group && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-lime-400 font-bold">
                            {m.group}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2 sm:space-x-3 text-sm font-bold">
                          <span
                            className={`flex items-center space-x-1.5 ${
                              isWinnerA
                                ? 'text-lime-400 font-extrabold'
                                : isWinnerB
                                ? 'text-slate-400 font-normal'
                                : 'text-white'
                            }`}
                          >
                            <span>{m.teamA?.name || 'TBD'}</span>
                            {isWinnerA && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30 uppercase font-black">
                                🏆 WINNER
                              </span>
                            )}
                          </span>

                          <span className="text-slate-500 text-xs font-normal">vs</span>

                          <span
                            className={`flex items-center space-x-1.5 ${
                              isWinnerB
                                ? 'text-lime-400 font-extrabold'
                                : isWinnerA
                                ? 'text-slate-400 font-normal'
                                : 'text-white'
                            }`}
                          >
                            <span>{m.teamB?.name || 'TBD'}</span>
                            {isWinnerB && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30 uppercase font-black">
                                🏆 WINNER
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Schedule info */}
                        <div className="flex items-center space-x-3 mt-1 text-xs">
                          {m.scheduledAt || m.venue ? (
                            <span className="flex items-center space-x-1 text-lime-400/90 font-medium">
                              <Clock className="w-3.5 h-3.5 text-lime-400" />
                              <span>{formatMatchSchedule(m.scheduledAt, m.venue)}</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1 text-slate-500">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Kickoff Time & Pitch TBD</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      {m.status === 'scheduled' && (
                        <button
                          onClick={() => handleOpenScheduleModal(m)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                          title="Set Kickoff Date, Time & Pitch"
                        >
                          <Calendar className="w-3.5 h-3.5 text-lime-400" />
                          <span>{m.scheduledAt || m.venue ? 'Edit Time' : 'Set Time'}</span>
                        </button>
                      )}

                      {m.status === 'live' ? (
                        <div className="flex flex-col items-end space-y-1">
                          {m.timer && <MatchTimer timer={m.timer} status={m.status} size="sm" />}
                          <span className="font-mono text-sm font-extrabold text-lime-400">
                            {m.result?.scoreA} - {m.result?.scoreB}
                          </span>
                          {m.result?.penalties?.scoreA != null && (
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              ({m.result.penalties.scoreA} - {m.result.penalties.scoreB} pens)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                            m.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      )}

                      {m.status === 'completed' && (
                        <div className="flex flex-col items-end">
                          <div className="font-mono text-sm font-extrabold text-white flex items-center space-x-1.5">
                            <span>{m.result?.scoreA} - {m.result?.scoreB}</span>
                            {isDraw && (
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                DRAW
                              </span>
                            )}
                          </div>
                          {m.result?.penalties?.scoreA != null && (
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              (Open Play: {m.result?.regularScore?.scoreA ?? (m.result.scoreA - m.result.penalties.scoreA)} - {m.result?.regularScore?.scoreB ?? (m.result.scoreB - m.result.penalties.scoreB)} | Pens: {m.result.penalties.scoreA} - {m.result.penalties.scoreB})
                            </span>
                          )}
                          {m.earlyTermination?.isTerminatedEarly &&
                            m.earlyTermination.reason !== 'Match ended before regulation full-time whistle' && (
                              <span className="text-[10px] font-mono font-bold text-rose-400">
                                ⚠️ Early End ({m.earlyTermination.endedAtMinute}'): {m.earlyTermination.reason}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
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
                        <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping" />
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
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* TAB: BRACKET */}
      {activeTab === 'bracket' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Knockout Tournament Bracket</h2>
              <p className="text-slate-400 text-xs mt-0.5">Live bracket tree showing advancing teams and championship progression</p>
            </div>
          </div>
          <KnockoutBracket
            matches={matches.filter(m => (m.stage?.format === 'knockout') || (!m.group && m.nextSlot))}
          />
        </div>
      )}

      {/* TAB 5: SCORERS */}
      {activeTab === 'scorers' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Scorer Access & Invite Code</h2>
            <p className="text-slate-400 text-xs mt-0.5">Scorers enter this 6-character code to record match results on their phones</p>
          </div>

          {/* Big Code Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center max-w-md mx-auto">
            <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Tournament Invite Code</span>
            <div className="my-4 font-mono text-4xl font-extrabold text-lime-400 tracking-widest">
              {tournament.inviteCode}
            </div>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 rounded-xl bg-lime-500 text-slate-950 font-bold text-xs hover:bg-lime-400 transition-all flex items-center space-x-1.5"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
              <button
                onClick={handleRegenerateCode}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-800 transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-4">Tournament Members</h3>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <div>
                    <div className="font-bold text-white">{m.user?.name || 'User'}</div>
                    <div className="text-slate-500">{m.user?.email}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold text-[10px] ${
                      m.role === 'organizer' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {m.role}
                    </span>
                    {m.role === 'scorer' && (
                      <button
                        onClick={() => handleRemoveMember(m.user._id, m.user.name)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Remove Scorer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-xl">
          <form onSubmit={handleSaveSettings} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Settings className="w-4 h-4 text-lime-400" />
              <span>General Settings</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Tournament Name
              </label>
              <input
                type="text"
                required
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-lime-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Visibility Mode
              </label>
              <div className="space-y-2.5">
                {[
                  {
                    key: 'public',
                    label: 'Public',
                    desc: 'Listed in Discover search and visible to all fans and viewers.'
                  },
                  {
                    key: 'unlisted',
                    label: 'Unlisted',
                    desc: 'Hidden from Discover search. Anyone with the direct link can view.'
                  },
                  {
                    key: 'private',
                    label: 'Private',
                    desc: 'Restricted to Organizers and Scorers. Unauthenticated visitors receive a 404.'
                  }
                ].map((opt) => (
                  <label
                    key={opt.key}
                    onClick={() => setSettingsVisibility(opt.key)}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                      settingsVisibility === opt.key
                        ? 'bg-lime-500/10 border-lime-500/50 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-white capitalize">{opt.label}</span>
                      <input
                        type="radio"
                        name="visibility"
                        value={opt.key}
                        checked={settingsVisibility === opt.key}
                        onChange={() => setSettingsVisibility(opt.key)}
                        className="accent-lime-400"
                      />
                    </div>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Rules lock banner if matches have started */}
            {matches.some((m) => m.status === 'live' || m.status === 'completed') && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Competition scoring rules and point systems are locked because matches are live or completed.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingSettings || !settingsName.trim()}
              className="w-full py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs transition-all glow-lime-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Tournament Settings</span>
              )}
            </button>
          </form>

          {/* Danger Zone */}
          <div className="glass-panel p-6 rounded-2xl border border-rose-900/40 bg-rose-950/10 space-y-3">
            <h3 className="text-base font-bold text-rose-400">Danger Zone</h3>
            <p className="text-slate-400 text-xs">
              Deleting this tournament will permanently delete all participants, stages, match fixtures, and results.
            </p>
            <button
              onClick={handleDeleteTournament}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
            >
              Delete Tournament Permanently
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD TEAM */}
      {addTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Add Team</h3>
            <p className="text-slate-400 text-xs mb-4">Add team name and player roster (5 to 11 players).</p>

            <form onSubmit={handleAddTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Red Dragons FC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-lime-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Roster Players (1 per line)
                </label>
                <textarea
                  rows={4}
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  placeholder="Lionel Messi&#10;Kylian Mbappe&#10;Luka Modric&#10;Virgil van Dijk&#10;Alisson Becker"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-lime-500 placeholder:text-slate-600"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddTeamModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTeam || !teamName.trim()}
                  className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm disabled:opacity-50"
                >
                  {submittingTeam ? 'Adding...' : 'Add Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE STAGE */}
      {addStageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create Stage</h3>
            <p className="text-slate-400 text-xs mb-4">Choose format: group round-robin or knockout.</p>

            <form onSubmit={handleCreateStage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Stage Name</label>
                <input
                  type="text"
                  required
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-lime-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Format</label>
                <select
                  value={stageFormat}
                  onChange={(e) => setStageFormat(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none"
                >
                  <option value="roundRobin" disabled={stages.some(s => s.format === 'roundRobin')}>
                    Round Robin (Groups) {stages.some(s => s.format === 'roundRobin') ? '— (Only 1 group stage allowed)' : ''}
                  </option>
                  <option value="knockout">Knockout Bracket</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              {stageFormat === 'roundRobin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Top Qualifiers per Group</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={topPerGroup}
                    onChange={(e) => setTopPerGroup(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddStageModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold glow-lime-sm"
                >
                  Create Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL MATCH */}
      {manualMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create Manual Match</h3>
            <p className="text-slate-400 text-xs mb-4">Pair any two teams in a scheduled fixture.</p>

            <form onSubmit={handleCreateManualMatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Team A</label>
                <select
                  required
                  value={manualTeamA}
                  onChange={(e) => setManualTeamA(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none"
                >
                  <option value="">Select Team A</option>
                  {participants.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Team B</label>
                <select
                  required
                  value={manualTeamB}
                  onChange={(e) => setManualTeamB(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none"
                >
                  <option value="">Select Team B</option>
                  {participants.filter(p => p._id !== manualTeamA).map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Round</label>
                  <input
                    type="number"
                    min="1"
                    value={manualRound}
                    onChange={(e) => setManualRound(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Venue (Optional)</label>
                  <input
                    type="text"
                    value={manualVenue}
                    onChange={(e) => setManualVenue(e.target.value)}
                    placeholder="Pitch 1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setManualMatchModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualTeamA || !manualTeamB}
                  className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold glow-lime-sm disabled:opacity-50"
                >
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FIXTURE RULES CONFIRMATION */}
      {fixtureRulesModal && stageToGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-5">
            <div>
              <div className="flex items-center space-x-2 text-lime-400 mb-1">
                <PlayCircle className="w-4 h-4" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  Review Fixture Rules
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Generate Fixtures: {stageToGenerate.name}
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                The following official tournament rules and scheduling logic will be applied to this stage:
              </p>
            </div>

            <div className="space-y-3 bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center flex-shrink-0 font-bold font-mono text-xs border border-lime-500/20">
                  1
                </div>
                <div>
                  <span className="font-bold text-white block text-sm">
                    {stageToGenerate.format === 'roundRobin' ? 'Berger Circle Round Robin' : 'Single Elimination Bracket'}
                  </span>
                  <span className="text-slate-300 leading-relaxed block mt-0.5">
                    {stageToGenerate.format === 'roundRobin'
                      ? 'Every team plays every other team in its group once. Alternates home and away fixtures across balanced rounds.'
                      : 'Standard single elimination tournament bracket. Matchups are paired by seed with automated bye placement.'}
                  </span>
                </div>
              </div>

              {stageToGenerate.format === 'roundRobin' && (
                <>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center flex-shrink-0 font-bold font-mono text-xs border border-lime-500/20">
                      2
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm">Match Points (Football Standard)</span>
                      <div className="flex items-center space-x-3 mt-1 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30 font-bold">Win = 3 pts</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">Draw = 1 pt</span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">Loss = 0 pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center flex-shrink-0 font-bold font-mono text-xs border border-lime-500/20">
                      3
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm">Standings & Tie-Break Hierarchy</span>
                      <p className="text-slate-300 leading-relaxed mt-0.5">
                        Ties in table standings are broken strictly in this order:
                        <br />
                        <span className="text-lime-300 font-medium">1. Points (PTS)</span> &rarr;{' '}
                        <span className="text-lime-300 font-medium">2. Goal Difference (GD)</span> &rarr;{' '}
                        <span className="text-lime-300 font-medium">3. Goals Scored (GF)</span> &rarr;{' '}
                        <span className="text-lime-300 font-medium">4. Head-to-Head</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center flex-shrink-0 font-bold font-mono text-xs border border-lime-500/20">
                      4
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm">Knockout Advancement</span>
                      <span className="text-slate-300 leading-relaxed block mt-0.5">
                        Top <strong className="text-lime-400">{stageToGenerate.advancement?.topPerGroup || 2} teams</strong> from each group automatically qualify for the Knockout Stage with cross-seeding (e.g. Group A 1st vs Group B 2nd).
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setFixtureRulesModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerateFixtures}
                disabled={generatingFixtures}
                className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {generatingFixtures ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Apply Rules</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SET DATE, TIME & VENUE */}
      {scheduleModalOpen && selectedMatchForSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div>
              <span className="font-mono text-xs text-lime-400 font-bold uppercase tracking-wider">
                Schedule Match
              </span>
              <h3 className="text-lg font-bold text-white mt-1">
                {selectedMatchForSchedule.teamA?.name || 'Team A'} vs {selectedMatchForSchedule.teamB?.name || 'Team B'}
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Set kickoff date, time, and pitch location for players & viewers.
              </p>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Kickoff Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-lime-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Pitch / Ground / Stadium
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={scheduleVenue}
                    onChange={(e) => setScheduleVenue(e.target.value)}
                    placeholder="e.g. Pitch 1, Main Ground, Court B"
                    className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-lime-500 placeholder:text-slate-600"
                  />
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {savingSchedule ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADVANCE STAGE TO KNOCKOUT */}
      {advanceModalOpen && stageToAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-5">
            <div>
              <div className="flex items-center space-x-2 text-lime-400 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  Knockout Advancement
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Advance "{stageToAdvance.name}" &rarr; Knockout Stage
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Preview the qualifying teams from each group and the cross-seeded knockout matchups.
              </p>
            </div>

            {loadingQualifiers ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-lime-400 mb-2" />
                <span className="text-xs text-slate-400">Computing group standings and qualifiers...</span>
              </div>
            ) : qualifiersData ? (
              <div className="space-y-4">
                {/* Completion Status Alert */}
                {qualifiersData.isComplete ? (
                  <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center space-x-2 text-lime-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>All {qualifiersData.totalMatches} group matches are complete! Qualifiers are confirmed.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-2 text-amber-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {qualifiersData.pendingCount} matches still unplayed in this stage. Complete all matches before advancing.
                    </span>
                  </div>
                )}

                {/* Equal Stats Tie Breaker Resolution Alert & Options */}
                {qualifiersData.allTiedPairs && qualifiersData.allTiedPairs.length > 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <div className="flex items-center space-x-2 text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="font-bold text-xs uppercase tracking-wider">
                        Action Required: Equal Stats Tie Detected
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      Two teams have identical points, goal difference, goals scored, and head-to-head records. As organizer, choose how to break the tie:
                    </p>

                    <div className="space-y-2">
                      {qualifiersData.allTiedPairs.map((pair, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-bold text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded">
                                {pair.groupName}
                              </span>
                              <span className="text-xs font-bold text-white">
                                {pair.teamA.name} <span className="text-slate-500 font-normal">vs</span> {pair.teamB.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                              Tied for #{pair.positions.join(' & #')}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenTieModal(stageToAdvance, pair, 'rematch')}
                              className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-lime-400 border border-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
                            >
                              <Calendar className="w-3.5 h-3.5 text-lime-400" />
                              <span>Option 1: Rematch</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTieModal(stageToAdvance, pair, 'manual')}
                              className="py-2 px-3 rounded-lg bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all glow-lime-sm"
                            >
                              <Trophy className="w-3.5 h-3.5 text-slate-950" />
                              <span>Option 2: Decide Rank</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : qualifiersData.tiedAtCutoff ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Tie at cutoff detected!</strong> Two or more teams have identical points and tie-breakers. Resolve ties before advancing.
                    </span>
                  </div>
                ) : null}

                {/* Qualifiers by Group */}
                <div className="grid grid-cols-2 gap-3">
                  {qualifiersData.qualifiersByGroup.map((grp, gIdx) => (
                    <div key={gIdx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="font-bold text-xs text-white block mb-2">{grp.groupName} Qualifiers</span>
                      <div className="space-y-1.5">
                        {grp.qualifiers.map((q, qIdx) => (
                          <div key={qIdx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 truncate">
                              <span className="font-mono text-lime-400 font-bold mr-1.5">#{q.position}</span>
                              {q.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">{q.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cross-Seeded Pairings Preview */}
                {qualifiersData.pairingsPreview && (
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
                    <span className="font-mono uppercase font-bold text-[10px] text-slate-400 block tracking-wider">
                      Cross-Seeded Bracket Matchups Preview
                    </span>
                    <div className="space-y-1.5">
                      {qualifiersData.pairingsPreview.map((pair, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="font-semibold text-slate-200">
                            Match {pair.matchIndex}: {pair.teamA.name}
                          </span>
                          <span className="text-slate-500 text-[10px] px-2 font-mono">VS</span>
                          <span className="font-semibold text-slate-200">
                            {pair.teamB.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setAdvanceModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmAdvance}
                disabled={!qualifiersData?.isComplete || qualifiersData?.tiedAtCutoff || advancingStage}
                className="w-1/2 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm flex items-center justify-center space-x-1.5 disabled:opacity-40"
                title={!qualifiersData?.isComplete ? 'All group matches must be completed first' : 'Advance teams into Knockout stage'}
              >
                {advancingStage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Advancing...</span>
                  </>
                ) : (
                  <>
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Confirm & Advance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIE BREAKER RESOLUTION MODAL */}
      {tieModalOpen && selectedTiePair && selectedTieStage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-800 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>TIE RESOLUTION • {selectedTiePair.groupName}</span>
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {selectedTiePair.teamA.name} & {selectedTiePair.teamB.name}
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Tied for positions #{selectedTiePair.positions.join(' and #')}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTieModalOpen(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* MODE: OPTIONS SELECTION */}
            {tieModalMode === 'options' && (
              <div className="space-y-3">
                <p className="text-slate-300 text-xs">
                  How would you like to resolve this tie between these two teams?
                </p>

                <div
                  onClick={() => setTieModalMode('rematch')}
                  className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-lime-500/50 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-lime-400" />
                    <span className="font-bold text-white text-sm">Option 1: Schedule Rematch</span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Generate a tiebreaker playoff fixture. Teams will play a match, and the winner will gain points to break the tie naturally.
                  </p>
                </div>

                <div
                  onClick={() => setTieModalMode('manual')}
                  className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-lime-500/50 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-lime-400" />
                    <span className="font-bold text-white text-sm">Option 2: Decide Rank Manually</span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    As organizer, choose directly which team is placed higher (#{selectedTiePair.positions[0]}) and which is placed lower (#{selectedTiePair.positions[1]}).
                  </p>
                </div>
              </div>
            )}

            {/* MODE: MANUAL DECISION */}
            {tieModalMode === 'manual' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                  Select which team should finish higher in {selectedTiePair.groupName}:
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={submittingTieAction}
                    onClick={() => handleResolveTieManual([
                      selectedTiePair.teamA.participantId,
                      selectedTiePair.teamB.participantId
                    ])}
                    className="w-full p-4 rounded-xl bg-slate-900 hover:bg-lime-500/10 border border-slate-800 hover:border-lime-500/50 text-left transition-all group flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-mono text-lime-400 font-bold block mb-1">Rank Option A</span>
                      <span className="text-white font-bold text-sm block">
                        #{selectedTiePair.positions[0]} {selectedTiePair.teamA.name}
                      </span>
                      <span className="text-slate-400 text-xs">
                        #{selectedTiePair.positions[1]} {selectedTiePair.teamB.name}
                      </span>
                    </div>
                    <Check className="w-5 h-5 text-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    type="button"
                    disabled={submittingTieAction}
                    onClick={() => handleResolveTieManual([
                      selectedTiePair.teamB.participantId,
                      selectedTiePair.teamA.participantId
                    ])}
                    className="w-full p-4 rounded-xl bg-slate-900 hover:bg-lime-500/10 border border-slate-800 hover:border-lime-500/50 text-left transition-all group flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-mono text-lime-400 font-bold block mb-1">Rank Option B</span>
                      <span className="text-white font-bold text-sm block">
                        #{selectedTiePair.positions[0]} {selectedTiePair.teamB.name}
                      </span>
                      <span className="text-slate-400 text-xs">
                        #{selectedTiePair.positions[1]} {selectedTiePair.teamA.name}
                      </span>
                    </div>
                    <Check className="w-5 h-5 text-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setTieModalMode('options')}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    &larr; Back to Options
                  </button>
                  {submittingTieAction && (
                    <span className="text-xs text-lime-400 flex items-center space-x-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving decision...</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* MODE: REMATCH FORM */}
            {tieModalMode === 'rematch' && (
              <form onSubmit={handleScheduleTieRematch} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                  A tiebreaker rematch match will be added to <strong>{selectedTiePair.groupName}</strong> fixtures:
                  <div className="mt-1 font-bold text-white text-sm">
                    {selectedTiePair.teamA.name} vs {selectedTiePair.teamB.name}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Kickoff Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={tieRematchDateTime}
                    onChange={(e) => setTieRematchDateTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-lime-400 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    If set, scorer console will enforce starting only at or after this time.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Pitch / Venue
                  </label>
                  <input
                    type="text"
                    value={tieRematchVenue}
                    onChange={(e) => setTieRematchVenue(e.target.value)}
                    placeholder="e.g. Pitch 1, Main Stadium"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-lime-400 transition-colors"
                  />
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTieModalMode('options')}
                    className="w-1/3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    &larr; Back
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTieAction}
                    className="w-2/3 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold transition-all glow-lime-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {submittingTieAction ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating Rematch...</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Schedule Rematch Match</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
