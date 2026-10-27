const crypto = require('crypto');
const Tournament = require('../models/Tournament');
const Membership = require('../models/Membership');
const Participant = require('../models/Participant');
const Stage = require('../models/Stage');
const Match = require('../models/Match');
const Saved = require('../models/Saved');
const PRESETS = require('../config/presets');
const { ApiError } = require('../middleware/errorHandler');

// Helper to slugify string
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .substring(0, 40);
};

// Generate unique 6-char uppercase alphanumeric code
const generateUniqueInviteCode = async () => {
  let code = '';
  let exists = true;
  while (exists) {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
    exists = await Tournament.exists({ inviteCode: code });
  }
  return code;
};

// Generate unique slug
const generateUniqueSlug = async (name) => {
  const baseSlug = slugify(name) || 'tournament';
  let slug = '';
  let exists = true;
  while (exists) {
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    slug = `${baseSlug}-${randomSuffix}`;
    exists = await Tournament.exists({ slug });
  }
  return slug;
};

// POST /api/tournaments
const createTournament = async (req, res, next) => {
  try {
    const { name, presetKey = 'football', visibility = 'unlisted', overrides = {} } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return next(new ApiError(400, 'Tournament name is required', 'VALIDATION_ERROR'));
    }

    const preset = PRESETS[presetKey] || PRESETS.football;
    const slug = await generateUniqueSlug(name);
    const inviteCode = await generateUniqueInviteCode();

    const tournament = await Tournament.create({
      name: name.trim(),
      slug,
      owner: req.user._id,
      status: 'draft',
      visibility: ['public', 'unlisted', 'private'].includes(visibility) ? visibility : 'unlisted',
      participantType: overrides.participantType || preset.participantType,
      scoreboardType: overrides.scoreboardType || preset.scoreboardType,
      scoreLabel: overrides.scoreLabel || preset.scoreLabel,
      allowDraw: overrides.allowDraw !== undefined ? overrides.allowDraw : preset.allowDraw,
      points: overrides.points || preset.points,
      tieBreakers: overrides.tieBreakers || preset.tieBreakers,
      roster: overrides.roster || preset.roster,
      inviteCode
    });

    // Create organizer Membership
    await Membership.create({
      user: req.user._id,
      tournament: tournament._id,
      role: 'organizer'
    });

    res.status(201).json({
      tournament,
      role: 'organizer'
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tournaments/mine
const getMyTournaments = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ user: req.user._id })
      .populate('tournament')
      .lean();

    const organizing = [];
    const scoring = [];

    for (const m of memberships) {
      if (!m.tournament) continue;
      if (m.role === 'organizer') {
        organizing.push(m.tournament);
      } else if (m.role === 'scorer') {
        scoring.push(m.tournament);
      }
    }

    const saves = await Saved.find({ user: req.user._id })
      .populate('tournament')
      .lean();

    const following = saves
      .map(s => s.tournament)
      .filter(t => t && t.visibility !== 'private');

    res.json({
      organizing,
      scoring,
      following
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tournaments/:id
const getTournamentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id).lean();

    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const [participantCount, stageCount, matchCount] = await Promise.all([
      Participant.countDocuments({ tournament: id }),
      Stage.countDocuments({ tournament: id }),
      Match.countDocuments({ tournament: id })
    ]);

    res.json({
      tournament: {
        ...tournament,
        counts: {
          participants: participantCount,
          stages: stageCount,
          matches: matchCount
        }
      },
      role: req.membership ? req.membership.role : null
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/tournaments/:id
const updateTournament = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, visibility, points, tieBreakers, roster } = req.body;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    // Check if any rule fields are being changed
    const isChangingRules = points !== undefined || tieBreakers !== undefined || roster !== undefined;

    if (isChangingRules) {
      const hasStartedMatches = await Match.exists({
        tournament: id,
        status: { $in: ['live', 'completed'] }
      });

      if (hasStartedMatches) {
        return next(new ApiError(409, 'Rules are locked once any match has started or finished', 'CONFLICT'));
      }
    }

    if (name) tournament.name = name.trim();
    if (visibility && ['public', 'unlisted', 'private'].includes(visibility)) {
      tournament.visibility = visibility;
    }
    if (points) tournament.points = points;
    if (tieBreakers) tournament.tieBreakers = tieBreakers;
    if (roster) tournament.roster = roster;

    await tournament.save();

    res.json({ tournament });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tournaments/:id
const deleteTournament = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    // Cascade delete everything related
    await Promise.all([
      Participant.deleteMany({ tournament: id }),
      Stage.deleteMany({ tournament: id }),
      Match.deleteMany({ tournament: id }),
      Membership.deleteMany({ tournament: id }),
      Saved.deleteMany({ tournament: id }),
      Tournament.findByIdAndDelete(id)
    ]);

    res.json({ message: 'Tournament and all associated data deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/tournaments/join
const joinTournamentByCode = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return next(new ApiError(400, 'Invite code is required', 'VALIDATION_ERROR'));
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    const tournament = await Tournament.findOne({ inviteCode: cleanCode });

    if (!tournament) {
      return next(new ApiError(404, 'Invalid invite code. Tournament not found', 'NOT_FOUND'));
    }

    // Check if already a member
    const existing = await Membership.findOne({
      user: req.user._id,
      tournament: tournament._id
    });

    if (existing) {
      return next(new ApiError(409, `You are already a ${existing.role} of this tournament`, 'CONFLICT'));
    }

    // Create scorer membership
    const membership = await Membership.create({
      user: req.user._id,
      tournament: tournament._id,
      role: 'scorer'
    });

    res.status(201).json({
      message: 'Joined tournament as scorer successfully',
      tournament,
      role: 'scorer'
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/tournaments/:id/invite/regenerate
const regenerateInviteCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const newCode = await generateUniqueInviteCode();

    const tournament = await Tournament.findByIdAndUpdate(
      id,
      { inviteCode: newCode },
      { new: true }
    );

    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    res.json({
      inviteCode: tournament.inviteCode,
      message: 'Invite code regenerated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tournaments/:id/members
const getTournamentMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const members = await Membership.find({ tournament: id })
      .populate('user', 'name email')
      .lean();

    res.json({ members });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tournaments/:id/members/:userId
const removeTournamentMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const membership = await Membership.findOne({
      tournament: id,
      user: userId
    });

    if (!membership) {
      return next(new ApiError(404, 'Member not found', 'NOT_FOUND'));
    }

    if (membership.role === 'organizer') {
      return next(new ApiError(400, 'Organizer cannot be removed from the tournament', 'BAD_REQUEST'));
    }

    await Membership.findByIdAndDelete(membership._id);

    res.json({ message: 'Scorer removed successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/tournaments/:id/save
const saveTournament = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id).lean();
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    // If private, check if member
    if (tournament.visibility === 'private') {
      const isMember = await Membership.exists({ user: req.user._id, tournament: id });
      if (!isMember) {
        return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
      }
    }

    // Upsert saved record (idempotent)
    await Saved.findOneAndUpdate(
      { user: req.user._id, tournament: id },
      { user: req.user._id, tournament: id },
      { upsert: true, new: true }
    );

    res.json({ message: 'Tournament saved', saved: true });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tournaments/:id/save
const unsaveTournament = async (req, res, next) => {
  try {
    const { id } = req.params;

    await Saved.findOneAndDelete({
      user: req.user._id,
      tournament: id
    });

    res.json({ message: 'Tournament unsaved', saved: false });
  } catch (error) {
    next(error);
  }
};

// GET /api/tournaments/:id/saved
const checkSavedStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const isSaved = await Saved.exists({
      user: req.user._id,
      tournament: id
    });

    res.json({ saved: !!isSaved });
  } catch (error) {
    next(error);
  }
};

// GET /api/saved
const getSavedTournaments = async (req, res, next) => {
  try {
    const saves = await Saved.find({ user: req.user._id })
      .populate('tournament')
      .sort({ createdAt: -1 })
      .lean();

    const results = [];
    for (const s of saves) {
      const t = s.tournament;
      if (!t) continue;

      if (t.visibility === 'private') {
        const isMember = await Membership.exists({
          user: req.user._id,
          tournament: t._id
        });
        if (!isMember) continue; // Silently omit per PRD Section 4.6
      }

      results.push(t);
    }

    res.json({ saved: results });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTournament,
  getMyTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  joinTournamentByCode,
  regenerateInviteCode,
  getTournamentMembers,
  removeTournamentMember,
  saveTournament,
  unsaveTournament,
  checkSavedStatus,
  getSavedTournaments
};
