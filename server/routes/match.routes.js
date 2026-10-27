const express = require('express');
const {
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
  correctMatch
} = require('../controllers/match.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Nested tournament matches
router.get('/tournaments/:id/matches', requireRole('member'), getTournamentMatches);

// Stage manual match
router.post('/stages/:sid/matches', createManualMatch);

// Match specific
router.get('/matches/:mid', getMatchById);
router.put('/matches/:mid', updateMatch);
router.delete('/matches/:mid', deleteMatch);

// Scorer actions
router.patch('/matches/:mid/start', startMatch);
router.patch('/matches/:mid/timer', updateTimer);
router.patch('/matches/:mid/score', scoreMatch);
router.patch('/matches/:mid/penalties', scorePenalties);
router.patch('/matches/:mid/end', endMatch);

// Organizer action: correct completed score
router.patch('/matches/:mid/correct', correctMatch);

module.exports = router;
