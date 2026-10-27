const Tournament = require('../models/Tournament');
const Stage = require('../models/Stage');
const Match = require('../models/Match');
const Participant = require('../models/Participant');
const Membership = require('../models/Membership');
const { computeStandings } = require('../services/tournamentLogic');
const { ApiError } = require('../middleware/errorHandler');

// canView helper: public or unlisted allowed for all; private allowed only for members, otherwise 404
const canView = async (tournament, user) => {
  if (!tournament) return false;
  if (tournament.visibility === 'public' || tournament.visibility === 'unlisted') {
    return true;
  }
  // Private
  if (!user) return false;
  const isMember = await Membership.exists({
    user: user._id,
    tournament: tournament._id
  });
  return !!isMember;
};

// GET /api/public/t/:slug
const getPublicTournamentBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const tournament = await Tournament.findOne({ slug: slug.toLowerCase() }).lean();
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const allowed = await canView(tournament, req.user);
    if (!allowed) {
      // Must respond with 404 (never 403) per PRD line 193
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const [stages, participants] = await Promise.all([
      Stage.find({ tournament: tournament._id })
        .populate('groups.participants', 'name players seed')
        .sort({ order: 1 })
        .lean(),
      Participant.find({ tournament: tournament._id })
        .sort({ seed: 1, name: 1 })
        .lean()
    ]);

    res.json({
      tournament,
      stages,
      participants
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/t/:slug/matches
const getPublicMatches = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { stage, status } = req.query;

    const tournament = await Tournament.findOne({ slug: slug.toLowerCase() }).lean();
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const allowed = await canView(tournament, req.user);
    if (!allowed) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const query = { tournament: tournament._id };
    if (stage) query.stage = stage;
    if (status) query.status = status;

    const matches = await Match.find(query)
      .populate('teamA', 'name players seed')
      .populate('teamB', 'name players seed')
      .populate('stage', 'name order format')
      .sort({ round: 1, matchNumber: 1, createdAt: 1 })
      .lean();

    res.json({ matches });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/stages/:sid/standings
const getPublicStageStandings = async (req, res, next) => {
  try {
    const { sid } = req.params;

    const stage = await Stage.findById(sid)
      .populate('groups.participants', 'name players seed')
      .lean();

    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    const tournament = await Tournament.findById(stage.tournament).lean();
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const allowed = await canView(tournament, req.user);
    if (!allowed) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    const standings = [];

    if (stage.groups && stage.groups.length > 0) {
      for (const grp of stage.groups) {
        const matches = await Match.find({
          stage: sid,
          group: grp.name,
          status: 'completed'
        }).lean();

        const tableResult = computeStandings(matches, grp.participants, {
          points: tournament.points,
          tieBreakers: tournament.tieBreakers,
          advancement: stage.advancement
        }, stage.tieResolutions, grp.name);

        standings.push({
          groupName: grp.name,
          rows: tableResult.rows,
          tiedAtCutoff: tableResult.tiedAtCutoff,
          tiedPairs: tableResult.tiedPairs || []
        });
      }
    }

    res.json({
      stage: {
        id: stage._id,
        name: stage.name,
        format: stage.format
      },
      standings
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/matches/:mid
const getPublicMatchById = async (req, res, next) => {
  try {
    const { mid } = req.params;

    const match = await Match.findById(mid)
      .populate('teamA', 'name players seed')
      .populate('teamB', 'name players seed')
      .populate('stage', 'name order format')
      .populate('tournament', 'name slug visibility')
      .lean();

    if (!match) {
      return next(new ApiError(404, 'Match not found', 'NOT_FOUND'));
    }

    const allowed = await canView(match.tournament, req.user);
    if (!allowed) {
      return next(new ApiError(404, 'Match not found', 'NOT_FOUND'));
    }

    res.json({ match });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/search?q=&page=&limit=
const searchPublicTournaments = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const query = { visibility: 'public' };
    if (q && q.trim()) {
      query.name = { $regex: q.trim(), $options: 'i' };
    }

    const [tournaments, total] = await Promise.all([
      Tournament.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Tournament.countDocuments(query)
    ]);

    // Attach participant and match counts to each tournament
    const populated = await Promise.all(
      tournaments.map(async (t) => {
        const [participantsCount, matchesCount, stagesCount] = await Promise.all([
          Participant.countDocuments({ tournament: t._id }),
          Match.countDocuments({ tournament: t._id }),
          Stage.countDocuments({ tournament: t._id })
        ]);

        return {
          ...t,
          counts: {
            participants: participantsCount,
            matches: matchesCount,
            stages: stagesCount
          }
        };
      })
    );

    res.json({
      tournaments: populated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicTournamentBySlug,
  getPublicMatches,
  getPublicStageStandings,
  getPublicMatchById,
  searchPublicTournaments
};
