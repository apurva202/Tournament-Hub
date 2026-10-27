const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    players: [
      {
        name: {
          type: String,
          trim: true
        }
      }
    ],
    seed: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

participantSchema.index({ tournament: 1, name: 1 });

module.exports = mongoose.model('Participant', participantSchema);
