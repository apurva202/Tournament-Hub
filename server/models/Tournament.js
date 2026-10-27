const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['draft', 'live', 'completed'],
      default: 'draft'
    },
    visibility: {
      type: String,
      enum: ['public', 'unlisted', 'private'],
      default: 'unlisted'
    },
    participantType: {
      type: String,
      enum: ['solo', 'team'],
      default: 'team'
    },
    scoreboardType: {
      type: String,
      enum: ['score', 'winner'],
      default: 'score'
    },
    scoreLabel: {
      type: String,
      default: 'Goals'
    },
    allowDraw: {
      type: Boolean,
      default: true
    },
    points: {
      win: { type: Number, default: 3 },
      draw: { type: Number, default: 1 },
      loss: { type: Number, default: 0 }
    },
    tieBreakers: {
      type: [String],
      default: ['points', 'scoreDifference', 'scoredFor', 'headToHead']
    },
    roster: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 11 }
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Tournament', tournamentSchema);
