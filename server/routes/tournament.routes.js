const express = require('express');
const {
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
} = require('../controllers/tournament.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// All tournament routes require user login
router.use(protect);

router.post('/', createTournament);
router.get('/mine', getMyTournaments);
router.get('/saved', getSavedTournaments);
router.post('/join', joinTournamentByCode);

// Save / Unsave
router.post('/:id/save', saveTournament);
router.delete('/:id/save', unsaveTournament);
router.get('/:id/saved', checkSavedStatus);

router.get('/:id', requireRole('member'), getTournamentById);
router.put('/:id', requireRole('organizer'), updateTournament);
router.delete('/:id', requireRole('organizer'), deleteTournament);

router.post('/:id/invite/regenerate', requireRole('organizer'), regenerateInviteCode);
router.get('/:id/members', requireRole('organizer'), getTournamentMembers);
router.delete('/:id/members/:userId', requireRole('organizer'), removeTournamentMember);

module.exports = router;
