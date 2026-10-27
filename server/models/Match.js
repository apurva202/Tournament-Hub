const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true
    },
    stage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stage',
      required: true
    },
    group: {
      type: String,
      default: ''
    },
    round: {
      type: Number,
      default: 1
    },
    roundLabel: {
      type: String,
      default: ''
    },
    matchNumber: {
      type: Number,
      default: 1
    },
    teamA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      default: null
    },
    teamB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      default: null
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'completed'],
      default: 'scheduled'
    },
    result: {
      scoreA: { type: Number, default: 0 },
      scoreB: { type: Number, default: 0 },
      regularScore: {
        scoreA: { type: Number, default: 0 },
        scoreB: { type: Number, default: 0 }
      },
      winner: {
        type: String,
        enum: ['A', 'B', 'draw', null],
        default: null
      },
      penalties: {
        scoreA: { type: Number, default: null },
        scoreB: { type: Number, default: null }
      },
      decidedBy: {
        type: String,
        enum: ['regular', 'extra_time', 'penalties', 'draw', 'manual', null],
        default: null
      }
    },
    timer: {
      period: {
        type: String,
        enum: [
          'not_started',
          '1st_half',
          'half_time',
          '2nd_half',
          'full_time',
          'et_1st_half',
          'et_break',
          'et_2nd_half',
          'et_full_time',
          'penalties',
          'completed'
        ],
        default: 'not_started'
      },
      secondsElapsed: { type: Number, default: 0 },
      stoppageMinutes: { type: Number, default: 0 },
      isRunning: { type: Boolean, default: false },
      lastStartedAt: { type: Date, default: null },
      pauseReason: { type: String, default: null }
    },
    earlyTermination: {
      isTerminatedEarly: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      note: { type: String, default: '' },
      endedAtMinute: { type: Number, default: null },
      endedAtPeriod: { type: String, default: '' },
      endedAt: { type: Date, default: null }
    },
    nextMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null
    },
    nextSlot: {
      type: String,
      enum: ['A', 'B', null],
      default: null
    },
    isBye: {
      type: Boolean,
      default: false
    },
    scheduledAt: {
      type: Date,
      default: null
    },
    venue: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

matchSchema.index({ stage: 1, round: 1 });
matchSchema.index({ tournament: 1 });

module.exports = mongoose.model('Match', matchSchema);
