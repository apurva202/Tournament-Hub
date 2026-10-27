const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
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
    },
    role: {
      type: String,
      enum: ['organizer', 'scorer'],
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Unique composite index: (user, tournament)
membershipSchema.index({ user: 1, tournament: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
