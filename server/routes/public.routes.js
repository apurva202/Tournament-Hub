const express = require('express');
const {
  getPublicTournamentBySlug,
  getPublicMatches,
  getPublicStageStandings,
  getPublicMatchById,
  searchPublicTournaments
} = require('../controllers/public.controller');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// optionalAuth checks cookie/token to allow members to view private tournaments
router.use(optionalAuth);

router.get('/search', searchPublicTournaments);
router.get('/t/:slug', getPublicTournamentBySlug);
router.get('/t/:slug/matches', getPublicMatches);
router.get('/stages/:sid/standings', getPublicStageStandings);
router.get('/matches/:mid', getPublicMatchById);

module.exports = router;
