const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const participantRoutes = require('./routes/participant.routes');
const stageRoutes = require('./routes/stage.routes');
const matchRoutes = require('./routes/match.routes');
const publicRoutes = require('./routes/public.routes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Attach io instance to req for controllers/events later
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const jwt = require('jsonwebtoken');
const Tournament = require('./models/Tournament');
const Membership = require('./models/Membership');
const { protect } = require('./middleware/auth');
const { getSavedTournaments } = require('./controllers/tournament.controller');

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.get('/api/saved', protect, getSavedTournaments);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', participantRoutes);
app.use('/api', stageRoutes);
app.use('/api', matchRoutes);

// Socket.io connection logging & authorized room handling
io.on('connection', (socket) => {
  socket.on('join:tournament', async (tournamentId) => {
    try {
      const tournament = await Tournament.findById(tournamentId).lean();
      if (!tournament) return;

      // Private tournament check: only allow members to join live room
      if (tournament.visibility === 'private') {
        const cookieHeader = socket.handshake.headers?.cookie;
        let token = null;
        if (cookieHeader) {
          const match = cookieHeader.match(/token=([^;]+)/);
          if (match) token = match[1];
        }
        if (!token && socket.handshake.auth?.token) {
          token = socket.handshake.auth.token;
        }

        if (!token) return;

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
          return;
        }

        const isMember = await Membership.exists({
          tournament: tournamentId,
          user: decoded.id
        });

        if (!isMember) return;
      }

      socket.join(`t:${tournamentId}`);
      console.log(`[Socket] Client ${socket.id} joined tournament room t:${tournamentId}`);
    } catch (err) {
      console.error('[Socket Join Error]', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => {
      console.log(`[Server] Tournament Hub API listening on port ${PORT}`);
    });
  });
}

module.exports = { app, server, io };
