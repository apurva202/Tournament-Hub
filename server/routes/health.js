const express = require('express');
const mongoose = require('mongoose');
const PRESETS = require('../config/presets');

const router = express.Router();

router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

router.get('/presets', (req, res) => {
  res.json({
    presets: Object.values(PRESETS)
  });
});

module.exports = router;
