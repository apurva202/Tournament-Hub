const mongoose = require('mongoose');

const savedSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Unique composite index: (user, tournament)
savedSchema.index({ user: 1, tournament: 1 }, { unique: true });

module.exports = mongoose.model('Saved', savedSchema);
