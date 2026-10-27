const Match = require("../models/Match");
const Stage = require("../models/Stage");
const Tournament = require("../models/Tournament");
const { ApiError } = require("../middleware/errorHandler");

// GET /api/tournaments/:id/matches
const getTournamentMatches = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage, status, group } = req.query;

    const query = { tournament: id };
    if (stage) query.stage = stage;
    if (status) query.status = status;
    if (group) query.group = group;

    const matches = await Match.find(query)
      .populate("teamA", "name players seed")
      .populate("teamB", "name players seed")
      .populate("stage", "name order format")
      .sort({ round: 1, matchNumber: 1, createdAt: 1 })
      .lean();

    res.json({ matches });
  } catch (error) {
    next(error);
  }
};

// GET /api/matches/:mid
const getMatchById = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const match = await Match.findById(mid)
      .populate("teamA", "name players seed")
      .populate("teamB", "name players seed")
      .populate("stage", "name order format")
      .populate(
        "tournament",
        "name slug scoreboardType scoreLabel allowDraw points",
      )
      .lean();

    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    res.json({ match });
  } catch (error) {
    next(error);
  }
};

// POST /api/stages/:sid/matches
const createManualMatch = async (req, res, next) => {
  try {
    const { sid } = req.params;
    const {
      teamA,
      teamB,
      round = 1,
      roundLabel,
      scheduledAt,
      venue,
    } = req.body;

    if (!teamA || !teamB) {
      return next(
        new ApiError(
          400,
          "Both teamA and teamB are required",
          "VALIDATION_ERROR",
        ),
      );
    }

    if (teamA.toString() === teamB.toString()) {
      return next(
        new ApiError(
          400,
          "Team A and Team B cannot be the same participant",
          "VALIDATION_ERROR",
        ),
      );
    }

    const stage = await Stage.findById(sid);
    if (!stage) {
      return next(new ApiError(404, "Stage not found", "NOT_FOUND"));
    }

    const matchCount = await Match.countDocuments({ stage: sid, round });

    const match = await Match.create({
      tournament: stage.tournament,
      stage: sid,
      round: Number(round) || 1,
      roundLabel: roundLabel || `Round ${round}`,
      matchNumber: matchCount + 1,
      teamA,
      teamB,
      status: "scheduled",
      scheduledAt: scheduledAt || null,
      venue: venue ? venue.trim() : "",
    });

    const populated = await Match.findById(match._id)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    res.status(201).json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// PUT /api/matches/:mid
const updateMatch = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const { teamA, teamB, scheduledAt, venue } = req.body;

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    if (match.status !== "scheduled") {
      return next(
        new ApiError(
          409,
          "Only scheduled matches can have their details edited",
          "CONFLICT",
        ),
      );
    }

    if (teamA && teamB && teamA.toString() === teamB.toString()) {
      return next(
        new ApiError(
          400,
          "Team A and Team B cannot be the same participant",
          "VALIDATION_ERROR",
        ),
      );
    }

    if (teamA) match.teamA = teamA;
    if (teamB) match.teamB = teamB;
    if (scheduledAt !== undefined) match.scheduledAt = scheduledAt;
    if (venue !== undefined) match.venue = venue.trim();

    await match.save();

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/matches/:mid
const deleteMatch = async (req, res, next) => {
  try {
    const { mid } = req.params;

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    if (match.status !== "scheduled") {
      return next(
        new ApiError(409, "Only scheduled matches can be deleted", "CONFLICT"),
      );
    }

    await Match.findByIdAndDelete(mid);

    res.json({ message: "Match deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/matches/:mid/start
const startMatch = async (req, res, next) => {
  try {
    const { mid } = req.params;

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    if (!match.teamA || !match.teamB) {
      return next(
        new ApiError(
          409,
          "Cannot start match with unassigned teams (TBD)",
          "CONFLICT",
        ),
      );
    }

    // Do not allow starting before scheduled kickoff time
    if (match.scheduledAt && new Date() < new Date(match.scheduledAt)) {
      const scheduledTimeStr = new Date(match.scheduledAt).toLocaleString();
      return next(
        new ApiError(
          400,
          `Cannot start match before its scheduled kickoff time (${scheduledTimeStr})`,
          "EARLY_START_BLOCKED",
        ),
      );
    }

    if (match.status !== "scheduled") {
      return next(
        new ApiError(
          409,
          "Match is not scheduled or is already live/completed",
          "CONFLICT",
        ),
      );
    }

    match.status = "live";
    if (!match.timer) {
      match.timer = {};
    }
    match.timer.period = "1st_half";
    match.timer.secondsElapsed = 0;
    match.timer.stoppageMinutes = 0;
    match.timer.isRunning = true;
    match.timer.lastStartedAt = new Date();

    if (!match.result.regularScore) {
      match.result.regularScore = { scoreA: 0, scoreB: 0 };
    }

    await match.save();

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    // Emit live update over socket
    if (req.io) {
      req.io.to(`t:${match.tournament}`).emit("match:update", populated);
    }

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/matches/:mid/timer
const updateTimer = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const { action, period, stoppageMinutes, secondsElapsed, pauseReason } =
      req.body;

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    if (!match.timer) {
      match.timer = {
        period: "not_started",
        secondsElapsed: 0,
        stoppageMinutes: 0,
        isRunning: false,
        lastStartedAt: null,
        pauseReason: null,
      };
    }

    if (action === "start") {
      if (match.status === "scheduled") {
        match.status = "live";
      }
      if (match.timer.period === "not_started") {
        match.timer.period = "1st_half";
        match.timer.secondsElapsed = 0;
      }
      match.timer.isRunning = true;
      match.timer.lastStartedAt = new Date();
      // When resumed, clear the pause reason from display
      match.timer.pauseReason = null;
    } else if (action === "pause") {
      // Require pause reason
      if (!pauseReason || !pauseReason.trim()) {
        return next(
          new ApiError(
            400,
            "A reason is required to pause the match",
            "VALIDATION_ERROR",
          ),
        );
      }

      if (match.timer.isRunning && match.timer.lastStartedAt) {
        const delta = Math.floor(
          (Date.now() - new Date(match.timer.lastStartedAt).getTime()) / 1000,
        );
        match.timer.secondsElapsed =
          (match.timer.secondsElapsed || 0) + Math.max(0, delta);
      }
      match.timer.isRunning = false;
      match.timer.lastStartedAt = null;
      match.timer.pauseReason = pauseReason.trim();
    } else if (action === "set_period") {
      const validPeriods = [
        "1st_half",
        "half_time",
        "2nd_half",
        "full_time",
        "et_1st_half",
        "et_break",
        "et_2nd_half",
        "et_full_time",
        "penalties",
        "completed",
      ];
      if (!validPeriods.includes(period)) {
        return next(
          new ApiError(400, `Invalid period: ${period}`, "VALIDATION_ERROR"),
        );
      }

      match.timer.period = period;
      match.timer.stoppageMinutes = 0;
      match.timer.pauseReason = null;

      if (period === "1st_half") {
        match.timer.secondsElapsed = 0;
        match.timer.isRunning = true;
        match.timer.lastStartedAt = new Date();
      } else if (period === "half_time") {
        match.timer.secondsElapsed = 45 * 60;
        match.timer.isRunning = false;
        match.timer.lastStartedAt = null;
      } else if (period === "2nd_half") {
        match.timer.secondsElapsed = 45 * 60;
        match.timer.isRunning = true;
        match.timer.lastStartedAt = new Date();
      } else if (period === "full_time") {
        match.timer.secondsElapsed = 90 * 60;
        match.timer.isRunning = false;
        match.timer.lastStartedAt = null;
      } else if (period === "et_1st_half") {
        match.timer.secondsElapsed = 90 * 60;
        match.timer.isRunning = true;
        match.timer.lastStartedAt = new Date();
      } else if (period === "et_break") {
        match.timer.secondsElapsed = 105 * 60;
        match.timer.isRunning = false;
        match.timer.lastStartedAt = null;
      } else if (period === "et_2nd_half") {
        match.timer.secondsElapsed = 105 * 60;
        match.timer.isRunning = true;
        match.timer.lastStartedAt = new Date();
      } else if (period === "et_full_time") {
        match.timer.secondsElapsed = 120 * 60;
        match.timer.isRunning = false;
        match.timer.lastStartedAt = null;
      } else if (period === "penalties") {
        match.timer.isRunning = false;
        match.timer.lastStartedAt = null;
      }
    } else if (action === "set_stoppage") {
      match.timer.stoppageMinutes = Math.max(
        0,
        Math.floor(Number(stoppageMinutes) || 0),
      );
    } else if (action === "set_seconds") {
      if (secondsElapsed !== undefined && !isNaN(secondsElapsed)) {
        match.timer.secondsElapsed = Math.max(
          0,
          Math.floor(Number(secondsElapsed)),
        );
        if (match.timer.isRunning) {
          match.timer.lastStartedAt = new Date();
        }
      }
    } else {
      return next(
        new ApiError(400, "Invalid timer action", "VALIDATION_ERROR"),
      );
    }

    await match.save();

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    if (req.io) {
      req.io.to(`t:${match.tournament}`).emit("match:update", populated);
    }

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/matches/:mid/score
const scoreMatch = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const { scoreA, scoreB } = req.body;

    if (
      scoreA === undefined ||
      scoreB === undefined ||
      isNaN(scoreA) ||
      isNaN(scoreB) ||
      scoreA < 0 ||
      scoreB < 0
    ) {
      return next(
        new ApiError(
          400,
          "scoreA and scoreB must be non-negative integers",
          "VALIDATION_ERROR",
        ),
      );
    }

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    if (match.status !== "live") {
      return next(
        new ApiError(
          409,
          "Scores can only be updated while match is live",
          "CONFLICT",
        ),
      );
    }

    const regularA = Math.floor(Number(scoreA));
    const regularB = Math.floor(Number(scoreB));

    if (!match.result.regularScore) {
      match.result.regularScore = { scoreA: 0, scoreB: 0 };
    }
    match.result.regularScore.scoreA = regularA;
    match.result.regularScore.scoreB = regularB;

    const penaltyA =
      match.result.penalties?.scoreA != null
        ? match.result.penalties.scoreA
        : 0;
    const penaltyB =
      match.result.penalties?.scoreB != null
        ? match.result.penalties.scoreB
        : 0;

    // Total Real Score includes regular/ET score plus penalty count
    match.result.scoreA = regularA + penaltyA;
    match.result.scoreB = regularB + penaltyB;

    await match.save();

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    // Emit live score update over socket
    if (req.io) {
      req.io.to(`t:${match.tournament}`).emit("match:update", populated);
    }

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/matches/:mid/penalties
const scorePenalties = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const { penaltyScoreA, penaltyScoreB } = req.body;

    if (
      penaltyScoreA === undefined ||
      penaltyScoreB === undefined ||
      isNaN(penaltyScoreA) ||
      isNaN(penaltyScoreB) ||
      penaltyScoreA < 0 ||
      penaltyScoreB < 0
    ) {
      return next(
        new ApiError(
          400,
          "penaltyScoreA and penaltyScoreB must be non-negative integers",
          "VALIDATION_ERROR",
        ),
      );
    }

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    const pA = Math.floor(Number(penaltyScoreA));
    const pB = Math.floor(Number(penaltyScoreB));

    match.result.penalties = { scoreA: pA, scoreB: pB };

    const regularA =
      match.result.regularScore?.scoreA ??
      match.result.scoreA - (match.result.penalties?.scoreA || 0);
    const regularB =
      match.result.regularScore?.scoreB ??
      match.result.scoreB - (match.result.penalties?.scoreB || 0);

    match.result.regularScore = {
      scoreA: Math.max(0, regularA),
      scoreB: Math.max(0, regularB),
    };

    // Total Real Score = Regular + Penalties
    match.result.scoreA = match.result.regularScore.scoreA + pA;
    match.result.scoreB = match.result.regularScore.scoreB + pB;

    if (!match.timer) match.timer = {};
    match.timer.period = "penalties";
    match.timer.isRunning = false;
    match.timer.pauseReason = null;

    await match.save();

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    if (req.io) {
      req.io.to(`t:${match.tournament}`).emit("match:update", populated);
    }

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/matches/:mid/end
const endMatch = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const {
      winner: explicitWinner,
      penalties,
      decidedBy,
      earlyTermination,
    } = req.body;

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    if (match.status !== "live") {
      return next(
        new ApiError(409, "Only live matches can be ended", "CONFLICT"),
      );
    }

    const regularA =
      match.result?.regularScore?.scoreA ?? match.result?.scoreA ?? 0;
    const regularB =
      match.result?.regularScore?.scoreB ?? match.result?.scoreB ?? 0;

    let derivedWinner = null;
    let penaltyResult = null;
    let matchDecidedBy = decidedBy || null;

    // Check if penalties were submitted or already recorded
    const rawPenalties =
      penalties ||
      (match.result?.penalties?.scoreA != null ? match.result.penalties : null);

    if (
      rawPenalties &&
      rawPenalties.scoreA !== undefined &&
      rawPenalties.scoreB !== undefined &&
      rawPenalties.scoreA !== null &&
      rawPenalties.scoreB !== null
    ) {
      const pA = Number(rawPenalties.scoreA);
      const pB = Number(rawPenalties.scoreB);

      if (isNaN(pA) || isNaN(pB) || pA < 0 || pB < 0) {
        return next(
          new ApiError(
            400,
            "Penalty scores must be non-negative integers",
            "VALIDATION_ERROR",
          ),
        );
      }

      if (pA === pB) {
        return next(
          new ApiError(
            400,
            "Penalty shootouts cannot end in a tie. One team must win.",
            "VALIDATION_ERROR",
          ),
        );
      }

      penaltyResult = { scoreA: Math.floor(pA), scoreB: Math.floor(pB) };
      derivedWinner = pA > pB ? "A" : "B";
      matchDecidedBy = "penalties";
    } else if (explicitWinner === "draw") {
      // Scorer explicitly decided to conclude match as a draw
      derivedWinner = "draw";
      matchDecidedBy = "draw";
    } else if (["A", "B"].includes(explicitWinner)) {
      // Manual winner decision or explicit winner selection
      derivedWinner = explicitWinner;
      matchDecidedBy = decidedBy || "manual";
    } else if (regularA > regularB) {
      derivedWinner = "A";
      matchDecidedBy = match.timer?.period?.includes("et")
        ? "extra_time"
        : "regular";
    } else if (regularB > regularA) {
      derivedWinner = "B";
      matchDecidedBy = match.timer?.period?.includes("et")
        ? "extra_time"
        : "regular";
    } else {
      // Level regular scores without penalties
      derivedWinner = "draw";
      matchDecidedBy = "draw";
    }

    match.status = "completed";
    match.result.winner = derivedWinner;
    match.result.decidedBy = matchDecidedBy;

    // Check if regulation time was officially concluded (full_time, et_full_time, or penalties)
    const isRegulationConcluded = [
      "full_time",
      "et_full_time",
      "penalties",
    ].includes(match.timer?.period);

    // Record early termination ONLY if explicitly requested in payload (e.g. from early termination modal)
    if (earlyTermination && earlyTermination.isTerminatedEarly) {
      match.earlyTermination = {
        isTerminatedEarly: true,
        reason: earlyTermination.reason
          ? earlyTermination.reason.trim()
          : "Match terminated early",
        note: earlyTermination.note ? earlyTermination.note.trim() : "",
        endedAtMinute:
          Number(earlyTermination.endedAtMinute) ||
          Math.floor((match.timer?.secondsElapsed || 0) / 60),
        endedAtPeriod:
          earlyTermination.endedAtPeriod || match.timer?.period || "",
        endedAt: new Date(),
      };
    } else {
      // Normal completion / draw / decided winner - not early termination
      match.earlyTermination = undefined;
    }

    // Ensure regular score is preserved
    match.result.regularScore = { scoreA: regularA, scoreB: regularB };

    if (penaltyResult) {
      match.result.penalties = penaltyResult;
      // Total Real Score = Regular + Penalties
      match.result.scoreA = regularA + penaltyResult.scoreA;
      match.result.scoreB = regularB + penaltyResult.scoreB;
    } else {
      match.result.scoreA = regularA;
      match.result.scoreB = regularB;
    }

    // Stop and complete timer
    if (!match.timer) match.timer = {};
    match.timer.period = "completed";
    match.timer.isRunning = false;
    match.timer.lastStartedAt = null;
    match.timer.pauseReason = null;

    await match.save();

    // Advance winner to next knockout match slot
    if (match.nextMatch && match.nextSlot) {
      const winningTeamId = derivedWinner === "A" ? match.teamA : match.teamB;
      if (winningTeamId) {
        const field = match.nextSlot === "A" ? "teamA" : "teamB";
        await Match.findByIdAndUpdate(match.nextMatch, {
          [field]: winningTeamId,
        });
      }
    }

    // Check if tournament is completely finished
    const hasRemainingMatches = await Match.exists({
      tournament: match.tournament,
      status: { $ne: "completed" },
    });
    if (!hasRemainingMatches) {
      await Tournament.findByIdAndUpdate(match.tournament, {
        status: "completed",
      });
    }

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    // Emit live events
    if (req.io) {
      req.io.to(`t:${match.tournament}`).emit("match:update", populated);
      req.io
        .to(`t:${match.tournament}`)
        .emit("standings:update", { stageId: match.stage });
    }

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/matches/:mid/correct
const correctMatch = async (req, res, next) => {
  try {
    const { mid } = req.params;
    const {
      scoreA,
      scoreB,
      winner: explicitWinner,
      penalties,
      regularScore,
    } = req.body;

    const match = await Match.findById(mid);
    if (!match) {
      return next(new ApiError(404, "Match not found", "NOT_FOUND"));
    }

    // Check if next knockout match has already started
    if (match.nextMatch) {
      const nextM = await Match.findById(match.nextMatch);
      if (nextM && nextM.status !== "scheduled") {
        return next(
          new ApiError(
            409,
            "Cannot correct result: subsequent knockout match has already started",
            "CONFLICT",
          ),
        );
      }
    }

    let regA =
      regularScore?.scoreA ??
      (scoreA !== undefined
        ? Math.floor(Number(scoreA))
        : (match.result.regularScore?.scoreA ?? match.result.scoreA));
    let regB =
      regularScore?.scoreB ??
      (scoreB !== undefined
        ? Math.floor(Number(scoreB))
        : (match.result.regularScore?.scoreB ?? match.result.scoreB));

    match.result.regularScore = { scoreA: regA, scoreB: regB };

    let pA = null;
    let pB = null;

    if (
      penalties &&
      penalties.scoreA !== undefined &&
      penalties.scoreB !== undefined
    ) {
      pA = Math.floor(Number(penalties.scoreA));
      pB = Math.floor(Number(penalties.scoreB));
      match.result.penalties = { scoreA: pA, scoreB: pB };
    }

    const totalPenA =
      match.result.penalties?.scoreA != null
        ? match.result.penalties.scoreA
        : 0;
    const totalPenB =
      match.result.penalties?.scoreB != null
        ? match.result.penalties.scoreB
        : 0;

    // Total Real Score = Regular + Penalties
    match.result.scoreA = regA + totalPenA;
    match.result.scoreB = regB + totalPenB;

    let winner = explicitWinner;
    if (!winner) {
      if (
        match.result.penalties &&
        match.result.penalties.scoreA !== null &&
        match.result.penalties.scoreB !== null
      ) {
        winner =
          match.result.penalties.scoreA > match.result.penalties.scoreB
            ? "A"
            : "B";
      } else if (match.result.scoreA > match.result.scoreB) {
        winner = "A";
      } else if (match.result.scoreB > match.result.scoreA) {
        winner = "B";
      } else {
        winner = "draw";
      }
    }
    match.result.winner = winner;

    await match.save();

    // Re-propagate winner if knockout
    if (match.nextMatch && match.nextSlot) {
      const winningTeamId = winner === "A" ? match.teamA : match.teamB;
      const field = match.nextSlot === "A" ? "teamA" : "teamB";
      await Match.findByIdAndUpdate(match.nextMatch, {
        [field]: winningTeamId,
      });
    }

    const populated = await Match.findById(mid)
      .populate("teamA", "name players")
      .populate("teamB", "name players");

    if (req.io) {
      req.io.to(`t:${match.tournament}`).emit("match:update", populated);
      req.io
        .to(`t:${match.tournament}`)
        .emit("standings:update", { stageId: match.stage });
    }

    res.json({ match: populated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTournamentMatches,
  getMatchById,
  createManualMatch,
  updateMatch,
  deleteMatch,
  startMatch,
  updateTimer,
  scoreMatch,
  scorePenalties,
  endMatch,
  correctMatch,
};
