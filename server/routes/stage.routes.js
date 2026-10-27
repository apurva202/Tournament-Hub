const express = require('express');
const {
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
} = require('../controllers/stage.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Nested tournament stages
router.get('/tournaments/:id/stages', requireRole('member'), getStages);
router.post('/tournaments/:id/stages', requireRole('organizer'), createStage);

// Stage specific operations
router.put('/stages/:sid', updateStage);
router.delete('/stages/:sid', deleteStage);
router.post('/stages/:sid/draw', drawGroups);
router.post('/stages/:sid/fixtures', generateFixtures);

// Stage advancement & qualifier preview
router.get('/stages/:sid/qualifiers', getQualifiers);
router.post('/stages/:sid/advance', advanceStage);

// Tie-breaker resolution endpoints
router.post('/stages/:sid/tie-breaker/resolve', resolveTieManually);
router.post('/stages/:sid/tie-breaker/rematch', scheduleTiebreakerRematch);

module.exports = router;
