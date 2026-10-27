const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Membership = require('../models/Membership');
const { ApiError } = require('./errorHandler');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};

// Protect middleware - validates JWT token from httpOnly cookie or Bearer header
const protect = async (req, res, next) => {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return next(new ApiError(401, 'User no longer exists', 'UNAUTHORIZED'));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};

// Optional auth middleware - populates req.user if token present, does not fail if missing
const optionalAuth = async (req, res, next) => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).select('-passwordHash');
    req.user = user || null;
  } catch (error) {
    req.user = null;
  }
  next();
};

// requireRole middleware: checks user membership role in tournament
// role can be 'organizer', 'scorer' (scorer OR organizer), or 'member' (either)
const requireRole = (role) => {
  return async (req, res, next) => {
    try {
      const tournamentId = req.params.id || req.params.tournamentId;

      if (!tournamentId) {
        return next(new ApiError(400, 'Tournament ID parameter is required', 'VALIDATION_ERROR'));
      }

      if (!req.user) {
        return next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'));
      }

      const membership = await Membership.findOne({
        user: req.user._id,
        tournament: tournamentId
      });

      if (!membership) {
        return next(new ApiError(403, 'You are not a member of this tournament', 'FORBIDDEN'));
      }

      if (role === 'organizer' && membership.role !== 'organizer') {
        return next(new ApiError(403, 'Organizer permission required', 'FORBIDDEN'));
      }

      if (role === 'scorer' && membership.role !== 'scorer' && membership.role !== 'organizer') {
        return next(new ApiError(403, 'Scorer or Organizer permission required', 'FORBIDDEN'));
      }

      req.membership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  generateToken,
  protect,
  optionalAuth,
  requireRole
};
