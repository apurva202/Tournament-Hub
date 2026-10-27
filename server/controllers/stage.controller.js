const Stage = require('../models/Stage');
const Tournament = require('../models/Tournament');
const Participant = require('../models/Participant');
const Match = require('../models/Match');
const { roundRobin, generateKnockoutMatches, crossSeed, computeStandings } = require('../services/tournamentLogic');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/tournaments/:id/stages
const getStages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const stages = await Stage.find({ tournament: id })
      .populate('groups.participants', 'name players seed')
      .sort({ order: 1 })
      .lean();

    res.json({ stages });
  } catch (error) {
    next(error);
  }
};

// POST /api/tournaments/:id/stages
const createStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, format, advancement = { topPerGroup: 2 } } = req.body;

    if (!name || !format) {
      return next(new ApiError(400, 'Stage name and format (roundRobin, knockout, manual) are required', 'VALIDATION_ERROR'));
    }

    if (!['roundRobin', 'knockout', 'manual'].includes(format)) {
      return next(new ApiError(400, 'Invalid stage format', 'VALIDATION_ERROR'));
    }

    // Only 1 group stage allowed per tournament
    if (format === 'roundRobin') {
      const existingGroupStage = await Stage.findOne({ tournament: id, format: 'roundRobin' });
      if (existingGroupStage) {
        return next(new ApiError(409, 'A Group Stage already exists. A tournament can only have one group stage.', 'CONFLICT'));
      }
    }

    // Determine next order number
    const lastStage = await Stage.findOne({ tournament: id }).sort({ order: -1 });
    const order = lastStage ? lastStage.order + 1 : 1;

    const stage = await Stage.create({
      tournament: id,
      order,
      name: name.trim(),
      format,
      groups: [],
      advancement,
      status: 'draft'
    });

    res.status(201).json({ stage });
  } catch (error) {
    next(error);
  }
};

// PUT /api/stages/:sid
const updateStage = async (req, res, next) => {
  try {
    const { sid } = req.params;
    const { name, advancement } = req.body;

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    if (stage.status !== 'draft') {
      return next(new ApiError(409, 'Stage can only be edited while in draft status', 'CONFLICT'));
    }

    if (name) stage.name = name.trim();
    if (advancement) stage.advancement = advancement;

    await stage.save();

    res.json({ stage });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/stages/:sid
const deleteStage = async (req, res, next) => {
  try {
    const { sid } = req.params;

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    // 409 if any match is live or completed
    const hasLiveOrCompleted = await Match.exists({
      stage: sid,
      status: { $in: ['live', 'completed'] }
    });
    if (hasLiveOrCompleted) {
      return next(new ApiError(409, 'Cannot delete stage after matches have started or completed', 'CONFLICT'));
    }

    // Delete scheduled matches associated with this stage
    await Match.deleteMany({ stage: sid });
    await Stage.findByIdAndDelete(sid);

    res.json({ message: 'Stage and its scheduled fixtures deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/stages/:sid/draw
const drawGroups = async (req, res, next) => {
  try {
    const { sid } = req.params;
    const { groupCount = 2, mode = 'auto', assignments } = req.body;

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    // Cannot redraw if matches have started
    const hasStartedMatches = await Match.exists({
      stage: sid,
      status: { $in: ['live', 'completed'] }
    });
    if (hasStartedMatches) {
      return next(new ApiError(409, 'Cannot redraw groups after matches have started', 'CONFLICT'));
    }

    // Delete any existing scheduled matches for this stage before redrawing
    await Match.deleteMany({ stage: sid, status: 'scheduled' });

    let groupList = [];

    if (mode === 'auto') {
      const participants = await Participant.find({ tournament: stage.tournament })
        .sort({ seed: -1, createdAt: 1 })
        .lean();

      if (participants.length < 4) {
        return next(new ApiError(400, `At least 4 teams are required to draw groups into ${groupCount} groups (currently have ${participants.length})`, 'VALIDATION_ERROR'));
      }

      const numGroups = Math.max(1, Math.min(Number(groupCount) || 2, participants.length));

      // Initialize groups with standard names (Group A, Group B, Group C...)
      const groupAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const groups = Array.from({ length: numGroups }, (_, i) => ({
        name: `Group ${groupAlphabet[i] || (i + 1)}`,
        participants: []
      }));

      // Distribute participants so group sizes differ by at most 1
      participants.forEach((p, index) => {
        const targetGroupIndex = index % numGroups;
        groups[targetGroupIndex].participants.push(p._id);
      });

      groupList = groups;
    } else {
      // Manual assignments
      if (!Array.isArray(assignments)) {
        return next(new ApiError(400, 'Assignments array required for manual mode', 'VALIDATION_ERROR'));
      }
      groupList = assignments;
    }

    stage.groups = groupList;
    stage.status = 'draft';
    await stage.save();

    const populatedStage = await Stage.findById(sid)
      .populate('groups.participants', 'name players seed')
      .lean();

    res.json({
      message: 'Groups drawn successfully',
      stage: populatedStage
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/stages/:sid/fixtures
const generateFixtures = async (req, res, next) => {
  try {
    const { sid } = req.params;

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    // Check if matches already exist
    const matchCount = await Match.countDocuments({ stage: sid });
    if (matchCount > 0) {
      return next(new ApiError(409, 'Fixtures have already been generated for this stage', 'CONFLICT'));
    }

    let createdMatches = [];

    if (stage.format === 'roundRobin') {
      if (!stage.groups || stage.groups.length === 0) {
        return next(new ApiError(400, 'Cannot generate fixtures: draw groups first', 'VALIDATION_ERROR'));
      }

      for (const grp of stage.groups) {
        if (!grp.participants || grp.participants.length < 2) {
          continue;
        }

        const pIds = grp.participants.map(id => id.toString());
        const fixtures = roundRobin(pIds);

        for (const f of fixtures) {
          createdMatches.push({
            tournament: stage.tournament,
            stage: stage._id,
            group: grp.name,
            round: f.round,
            roundLabel: f.roundLabel,
            matchNumber: f.matchNumber,
            teamA: f.teamA,
            teamB: f.teamB,
            status: 'scheduled',
            result: { scoreA: 0, scoreB: 0, winner: null }
          });
        }
      }

      if (createdMatches.length > 0) {
        await Match.insertMany(createdMatches);
      }
    } else if (stage.format === 'knockout') {
      // Collect participants
      let pIds = [];
      if (stage.groups && stage.groups.length > 0) {
        pIds = stage.groups.flatMap(g => g.participants.map(id => id.toString()));
      } else {
        const all = await Participant.find({ tournament: stage.tournament }).sort({ seed: 1 }).lean();
        pIds = all.map(p => p._id.toString());
      }

      if (pIds.length < 2) {
        return next(new ApiError(400, 'At least 2 participants required for knockout fixtures', 'VALIDATION_ERROR'));
      }

      const knockoutTemplates = generateKnockoutMatches(pIds);

      // Create initial Match records to get real ObjectIds
      const tempIdMap = {};
      const matchesToInsert = knockoutTemplates.map(t => ({
        tournament: stage.tournament,
        stage: stage._id,
        group: '',
        round: t.round,
        roundLabel: t.roundLabel,
        matchNumber: t.matchNumber,
        teamA: t.teamA,
        teamB: t.teamB,
        status: t.status,
        isBye: t.isBye,
        result: t.result,
        nextMatch: null,
        nextSlot: t.nextSlot
      }));

      const inserted = await Match.insertMany(matchesToInsert);
      inserted.forEach((doc, idx) => {
        tempIdMap[knockoutTemplates[idx].tempId] = doc._id;
      });

      // Update parent nextMatch references
      const updatePromises = [];
      knockoutTemplates.forEach((t, idx) => {
        if (t.nextMatchTempId) {
          const parentId = tempIdMap[t.nextMatchTempId];
          const currentId = inserted[idx]._id;
          updatePromises.push(
            Match.findByIdAndUpdate(currentId, { nextMatch: parentId })
          );
        }
      });

      await Promise.all(updatePromises);
      createdMatches = inserted;
    }

    // Update Stage & Tournament status
    stage.status = 'live';
    await stage.save();

    await Tournament.findByIdAndUpdate(stage.tournament, { status: 'live' });

    res.status(201).json({
      message: `Generated ${createdMatches.length} fixtures successfully`,
      count: createdMatches.length,
      stage
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/stages/:sid/qualifiers
const getQualifiers = async (req, res, next) => {
  try {
    const { sid } = req.params;

    const stage = await Stage.findById(sid)
      .populate('groups.participants', 'name players seed')
      .lean();

    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    if (stage.format !== 'roundRobin') {
      return next(new ApiError(400, 'Qualifiers preview is only available for group stages (roundRobin)', 'VALIDATION_ERROR'));
    }

    const tournament = await Tournament.findById(stage.tournament).lean();
    const matches = await Match.find({ stage: sid })
      .populate('teamA', 'name')
      .populate('teamB', 'name')
      .lean();

    const pendingMatches = matches.filter(m => m.status !== 'completed');
    const isComplete = matches.length > 0 && pendingMatches.length === 0;

    const topN = stage.advancement?.topPerGroup || 2;
    let anyTiedAtCutoff = false;
    const qualifiersByGroup = [];

    for (const grp of stage.groups) {
      const groupMatches = matches.filter(m => m.group === grp.name);
      const { rows, tiedAtCutoff, tiedPairs } = computeStandings(groupMatches, grp.participants, {
        points: tournament?.points,
        tieBreakers: tournament?.tieBreakers,
        advancement: stage.advancement
      }, stage.tieResolutions, grp.name);

      if (tiedAtCutoff) {
        anyTiedAtCutoff = true;
      }

      const qualifiers = rows.slice(0, topN).map((r, idx) => ({
        participantId: r.participantId,
        name: r.name,
        position: idx + 1,
        points: r.points,
        goalDifference: r.goalDifference,
        goalsFor: r.goalsFor,
        played: r.played
      }));

      qualifiersByGroup.push({
        groupName: grp.name,
        qualifiers,
        tiedAtCutoff,
        tiedPairs: tiedPairs || []
      });
    }

    // Build preview of cross-seeded pairings
    const crossSeededIds = crossSeed(qualifiersByGroup.map(g => ({
      groupName: g.groupName,
      qualifiers: g.qualifiers.map(q => q.participantId)
    })));

    const participantMap = new Map();
    for (const g of qualifiersByGroup) {
      for (const q of g.qualifiers) {
        participantMap.set(q.participantId.toString(), q);
      }
    }

    const pairingsPreview = [];
    for (let i = 0; i < crossSeededIds.length; i += 2) {
      const idA = crossSeededIds[i];
      const idB = crossSeededIds[i + 1];
      pairingsPreview.push({
        teamA: participantMap.get(idA ? idA.toString() : '') || { name: 'TBD' },
        teamB: participantMap.get(idB ? idB.toString() : '') || { name: 'TBD' },
        matchIndex: Math.floor(i / 2) + 1
      });
    }

    res.json({
      stageId: sid,
      isComplete,
      totalMatches: matches.length,
      pendingCount: pendingMatches.length,
      tiedAtCutoff: anyTiedAtCutoff,
      allTiedPairs: qualifiersByGroup.flatMap(g => g.tiedPairs || []),
      qualifiersByGroup,
      pairingsPreview
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/stages/:sid/advance
const advanceStage = async (req, res, next) => {
  try {
    const { sid } = req.params;

    const stage = await Stage.findById(sid).populate('groups.participants', 'name players seed');
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    if (stage.format !== 'roundRobin') {
      return next(new ApiError(400, 'Only round-robin group stages can be advanced with group qualifiers', 'VALIDATION_ERROR'));
    }

    // 1. Verify all matches are completed
    const totalMatches = await Match.countDocuments({ stage: sid });
    const pendingMatches = await Match.countDocuments({ stage: sid, status: { $ne: 'completed' } });

    if (totalMatches === 0) {
      return next(new ApiError(409, 'Cannot advance: no matches have been generated for this stage', 'CONFLICT'));
    }

    if (pendingMatches > 0) {
      return next(new ApiError(409, `Cannot advance stage: ${pendingMatches} matches are still in progress or scheduled`, 'CONFLICT'));
    }

    const tournament = await Tournament.findById(stage.tournament);
    const matches = await Match.find({ stage: sid }).lean();

    const topN = stage.advancement?.topPerGroup || 2;
    let anyTiedAtCutoff = false;
    const groupQualifiers = [];

    for (const grp of stage.groups) {
      const groupMatches = matches.filter(m => m.group === grp.name);
      const { rows, tiedAtCutoff } = computeStandings(groupMatches, grp.participants, {
        points: tournament?.points,
        tieBreakers: tournament?.tieBreakers,
        advancement: stage.advancement
      }, stage.tieResolutions, grp.name);

      if (tiedAtCutoff) {
        anyTiedAtCutoff = true;
      }

      const qIds = rows.slice(0, topN).map(r => r.participantId.toString());
      groupQualifiers.push({
        groupName: grp.name,
        qualifiers: qIds
      });
    }

    // 2. Reject if tie at cutoff
    if (anyTiedAtCutoff) {
      return next(new ApiError(409, 'Cannot advance stage: tie detected at qualification cutoff. Resolve tie before advancing.', 'CONFLICT'));
    }

    // 3. Cross-seed teams
    const crossSeededParticipantIds = crossSeed(groupQualifiers);
    if (crossSeededParticipantIds.length < 2) {
      return next(new ApiError(400, 'Not enough qualifying teams to form a knockout bracket', 'VALIDATION_ERROR'));
    }

    // 4. Find or create the next Knockout stage
    let nextStage = await Stage.findOne({
      tournament: stage.tournament,
      order: stage.order + 1
    });

    if (!nextStage) {
      nextStage = await Stage.create({
        tournament: stage.tournament,
        order: stage.order + 1,
        name: 'Knockout Stage',
        format: 'knockout',
        groups: [],
        advancement: { topPerGroup: 1 },
        status: 'draft'
      });
    }

    // Check if fixtures already exist for the next stage
    const existingNextMatches = await Match.countDocuments({ stage: nextStage._id });
    if (existingNextMatches > 0) {
      return next(new ApiError(409, 'Fixtures already exist for the subsequent stage', 'CONFLICT'));
    }

    // 5. Generate knockout matches
    const knockoutTemplates = generateKnockoutMatches(crossSeededParticipantIds);

    const tempIdMap = {};
    const matchesToInsert = knockoutTemplates.map(t => ({
      tournament: stage.tournament,
      stage: nextStage._id,
      group: '',
      round: t.round,
      roundLabel: t.roundLabel,
      matchNumber: t.matchNumber,
      teamA: t.teamA,
      teamB: t.teamB,
      status: t.status,
      isBye: t.isBye,
      result: t.result,
      nextMatch: null,
      nextSlot: t.nextSlot
    }));

    const inserted = await Match.insertMany(matchesToInsert);
    inserted.forEach((doc, idx) => {
      tempIdMap[knockoutTemplates[idx].tempId] = doc._id;
    });

    // Update parent nextMatch references
    const updatePromises = [];
    knockoutTemplates.forEach((t, idx) => {
      if (t.nextMatchTempId) {
        const parentId = tempIdMap[t.nextMatchTempId];
        const currentId = inserted[idx]._id;
        updatePromises.push(
          Match.findByIdAndUpdate(currentId, { nextMatch: parentId })
        );
      }
    });

    await Promise.all(updatePromises);

    // 6. Update stage statuses
    stage.status = 'completed';
    await stage.save();

    nextStage.status = 'live';
    await nextStage.save();

    // 7. Emit stage:advanced over socket
    if (req.io) {
      req.io.to(`t:${stage.tournament}`).emit('stage:advanced', {
        fromStageId: stage._id,
        toStageId: nextStage._id
      });
    }

    const populatedNextStage = await Stage.findById(nextStage._id).lean();

    res.json({
      message: `Successfully advanced ${crossSeededParticipantIds.length} teams to Knockout Stage!`,
      stage: populatedNextStage,
      knockoutMatchesCount: inserted.length
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/stages/:sid/tie-breaker/resolve
const resolveTieManually = async (req, res, next) => {
  try {
    const { sid } = req.params;
    const { group, ranking } = req.body;

    if (!group || !Array.isArray(ranking) || ranking.length < 2) {
      return next(new ApiError(400, 'Group name and ranking array with at least 2 team IDs are required', 'VALIDATION_ERROR'));
    }

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    if (!stage.tieResolutions) {
      stage.tieResolutions = [];
    }

    const existingIndex = stage.tieResolutions.findIndex(r => r.group === group);
    if (existingIndex !== -1) {
      stage.tieResolutions[existingIndex].ranking = ranking;
      stage.tieResolutions[existingIndex].method = 'manual';
      stage.tieResolutions[existingIndex].decidedAt = new Date();
    } else {
      stage.tieResolutions.push({
        group,
        ranking,
        method: 'manual',
        decidedAt: new Date()
      });
    }

    await stage.save();

    if (req.io) {
      req.io.to(`t:${stage.tournament}`).emit('standings:update', {
        stageId: stage._id,
        group
      });
    }

    res.json({
      message: 'Tie ranking decided manually by organizer',
      tieResolutions: stage.tieResolutions
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/stages/:sid/tie-breaker/rematch
const scheduleTiebreakerRematch = async (req, res, next) => {
  try {
    const { sid } = req.params;
    const { group, teamAId, teamBId, scheduledAt, venue } = req.body;

    if (!group || !teamAId || !teamBId) {
      return next(new ApiError(400, 'Group name, teamAId, and teamBId are required', 'VALIDATION_ERROR'));
    }

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, 'Stage not found', 'NOT_FOUND'));
    }

    const [teamA, teamB] = await Promise.all([
      Participant.findById(teamAId),
      Participant.findById(teamBId)
    ]);

    if (!teamA || !teamB) {
      return next(new ApiError(404, 'One or both teams not found', 'NOT_FOUND'));
    }

    const lastMatch = await Match.findOne({ stage: sid }).sort({ matchNumber: -1 });
    const matchNumber = lastMatch ? lastMatch.matchNumber + 1 : 1;

    const rematch = await Match.create({
      tournament: stage.tournament,
      stage: stage._id,
      group: group,
      round: 99,
      roundLabel: `Tiebreaker: ${teamA.name} vs ${teamB.name}`,
      matchNumber,
      teamA: teamAId,
      teamB: teamBId,
      status: 'scheduled',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      venue: venue || 'Main Pitch'
    });

    const populatedMatch = await Match.findById(rematch._id)
      .populate('teamA', 'name players seed')
      .populate('teamB', 'name players seed')
      .populate('stage', 'name order format');

    if (req.io) {
      req.io.to(`t:${stage.tournament}`).emit('match:update', populatedMatch);
      req.io.to(`t:${stage.tournament}`).emit('standings:update', {
        stageId: stage._id,
        group
      });
    }

    res.status(201).json({
      message: 'Tiebreaker rematch scheduled successfully',
      match: populatedMatch
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStages,
  createStage,
  updateStage,
  deleteStage,
  drawGroups,
  generateFixtures,
  getQualifiers,
  advanceStage,
  resolveTieManually,
  scheduleTiebreakerRematch
};
