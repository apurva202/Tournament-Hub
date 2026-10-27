const express = require('express');
const {
  getParticipants,
  addParticipant,
  updateParticipant,
  deleteParticipant
} = require('../controllers/participant.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Nested tournament routes
router.get('/tournaments/:id/participants', requireRole('member'), getParticipants);
router.post('/tournaments/:id/participants', requireRole('organizer'), addParticipant);

// Direct participant routes
router.put('/participants/:pid', updateParticipant);
router.delete('/participants/:pid', deleteParticipant);

module.exports = router;
