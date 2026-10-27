const Participant = require('../models/Participant');
const Tournament = require('../models/Tournament');
const Stage = require('../models/Stage');
const Match = require('../models/Match');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/tournaments/:id/participants
const getParticipants = async (req, res, next) => {
  try {
    const { id } = req.params;

    const participants = await Participant.find({ tournament: id })
      .sort({ seed: 1, createdAt: 1 })
      .lean();

    // Map group assignments from current stages
    const stages = await Stage.find({ tournament: id }).lean();
    const participantGroupMap = {};

    for (const s of stages) {
      if (s.groups) {
        for (const g of s.groups) {
          for (const pId of g.participants) {
            participantGroupMap[pId.toString()] = {
              stageId: s._id,
              stageName: s.name,
              groupName: g.name
            };
          }
        }
      }
    }

    const enriched = participants.map(p => ({
      ...p,
      groupAssignment: participantGroupMap[p._id.toString()] || null
    }));

    res.json({ participants: enriched });
  } catch (error) {
    next(error);
  }
};

// POST /api/tournaments/:id/participants
const addParticipant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, players = [], seed = 0 } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return next(new ApiError(400, 'Participant/Team name is required', 'VALIDATION_ERROR'));
    }

    const cleanName = name.trim();

    // Check if tournament match has started
    const hasStartedMatches = await Match.exists({
      tournament: id,
      status: { $in: ['live', 'completed'] }
    });

    if (hasStartedMatches) {
      return next(new ApiError(409, 'Participants locked: cannot add participants after matches have started', 'CONFLICT'));
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return next(new ApiError(404, 'Tournament not found', 'NOT_FOUND'));
    }

    // Check duplicate name in this tournament
    const existingName = await Participant.findOne({
      tournament: id,
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
    });

    if (existingName) {
      return next(new ApiError(409, `A team named "${cleanName}" already exists in this tournament`, 'CONFLICT'));
    }

    // Format players list
    let playerList = [];
    if (Array.isArray(players)) {
      playerList = players
        .map(p => (typeof p === 'string' ? { name: p.trim() } : { name: p.name?.trim() }))
        .filter(p => p.name);
    }

    // Validate roster size for team tournament if players provided
    if (tournament.participantType === 'team' && playerList.length > 0) {
      const min = tournament.roster?.min || 5;
      const max = tournament.roster?.max || 11;
      if (playerList.length < min || playerList.length > max) {
        return next(new ApiError(400, `Team roster must have between ${min} and ${max} players (provided ${playerList.length})`, 'VALIDATION_ERROR'));
      }
    }

    const participant = await Participant.create({
      tournament: id,
      name: cleanName,
      players: playerList,
      seed: Number(seed) || 0
    });

    res.status(201).json({ participant });
  } catch (error) {
    next(error);
  }
};

// PUT /api/participants/:pid
const updateParticipant = async (req, res, next) => {
  try {
    const { pid } = req.params;
    const { name, players, seed } = req.body;

    const participant = await Participant.findById(pid);
    if (!participant) {
      return next(new ApiError(404, 'Participant not found', 'NOT_FOUND'));
    }

    // Check match start lock
    const hasStartedMatches = await Match.exists({
      tournament: participant.tournament,
      status: { $in: ['live', 'completed'] }
    });

    if (hasStartedMatches) {
      return next(new ApiError(409, 'Cannot edit participant after tournament matches have started', 'CONFLICT'));
    }

    if (name && name.trim() !== participant.name) {
      const duplicate = await Participant.findOne({
        tournament: participant.tournament,
        _id: { $ne: pid },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
      if (duplicate) {
        return next(new ApiError(409, `Team named "${name.trim()}" already exists`, 'CONFLICT'));
      }
      participant.name = name.trim();
    }

    if (Array.isArray(players)) {
      participant.players = players
        .map(p => (typeof p === 'string' ? { name: p.trim() } : { name: p.name?.trim() }))
        .filter(p => p.name);
    }

    if (seed !== undefined) {
      participant.seed = Number(seed) || 0;
    }

    await participant.save();

    res.json({ participant });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/participants/:pid
const deleteParticipant = async (req, res, next) => {
  try {
    const { pid } = req.params;

    const participant = await Participant.findById(pid);
    if (!participant) {
      return next(new ApiError(404, 'Participant not found', 'NOT_FOUND'));
    }

    // 409 if participant appears in any match
    const matchExists = await Match.exists({
      $or: [{ teamA: pid }, { teamB: pid }]
    });

    if (matchExists) {
      return next(new ApiError(409, 'Cannot delete participant who is assigned to scheduled or played matches', 'CONFLICT'));
    }

    // Remove from any stage groups
    await Stage.updateMany(
      { tournament: participant.tournament },
      { $pull: { 'groups.$[].participants': pid } }
    );

    await Participant.findByIdAndDelete(pid);

    res.json({ message: 'Participant deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getParticipants,
  addParticipant,
  updateParticipant,
  deleteParticipant
};
