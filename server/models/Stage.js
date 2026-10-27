const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    format: {
      type: String,
      enum: ['roundRobin', 'knockout', 'manual'],
      required: true
    },
    groups: [
      {
        name: {
          type: String,
          required: true
        },
        participants: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Participant'
          }
        ]
      }
    ],
    advancement: {
      topPerGroup: {
        type: Number,
        default: 2
      }
    },
    status: {
      type: String,
      enum: ['draft', 'live', 'completed'],
      default: 'draft'
    },
    tieResolutions: [
      {
        group: {
          type: String,
          required: true
        },
        ranking: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Participant'
          }
        ],
        method: {
          type: String,
          enum: ['manual', 'rematch'],
          default: 'manual'
        },
        decidedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

stageSchema.index({ tournament: 1, order: 1 });

module.exports = mongoose.model('Stage', stageSchema);
