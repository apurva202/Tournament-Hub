# 🏆 Tournament Hub

<div align="center">

![Tournament Hub Banner](https://img.shields.io/badge/Tournament-Hub-84cc16?style=for-the-badge&logo=trophy&logoColor=black)

**Run complete tournaments in minutes, not spreadsheets.**

Automate fixtures, group stage draws, knockout brackets, mobile scorer consoles, and real-time live standings with zero page refresh.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-success?style=for-the-badge&logo=vercel)](https://tournament-hub-omega.vercel.app/)
[![Video Walkthrough](https://img.shields.io/badge/Demo%20Video-Google%20Drive-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/drive/folders/1AtBayBzOhOFgPZryhqZHZK583nQKRaps?usp=sharing)
[![Tech Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20Socket.io-blue?style=for-the-badge)](https://github.com)

</div>

---

## 📺 Live Links & Video Walkthrough

- 🌐 **Live Web Application:** [https://tournament-hub-omega.vercel.app/](https://tournament-hub-omega.vercel.app/)
- 🎥 **Full Video Demonstration:** [Watch Video Walkthrough on Google Drive](https://drive.google.com/drive/folders/1AtBayBzOhOFgPZryhqZHZK583nQKRaps?usp=sharing)

---

## ⚡ Problem & Solution

| The Old Way (Spreadsheets & Chat Groups) | The Tournament Hub Way |
|---|---|
| Hand-drawn brackets and fixtures prone to scheduling errors | **Automated draw** for round-robin groups and single elimination brackets |
| Manually recalculating points tables and goal difference | **Computed standings engine** derived strictly from completed match results |
| Scorers text scores in chat, resulting in lag and disputes | **Mobile-friendly Scorer Console** with instant score controls (+/-) and timers |
| Viewers constantly asking "Who plays next?" and "What's the score?" | **Real-time live WebSocket broadcast** with sub-second score updates without page refresh |
| Accidental score overwrites or unauthorized result edits | **Strict role-based access control** (Organizer, Scorer via invite code, Viewer) |

---

## ✨ Core Features

### 1. ⚙️ Smart Tournament Configuration
- **Sport Presets:** Quick-start presets for **Football** (win=3, draw=1, loss=0, goal difference tiebreakers) and **Chess/Winner-only** sports, or fully customizable rule configurations.
- **Participant Types:** Support for both team-based tournaments (with configurable min/max roster limits) and solo competitors.
- **Visibility Modes:** Choose between **Public** (searchable in Discover Arena), **Unlisted** (shareable via link), and **Private** (restricted to members only).

### 2. 👥 Team & Roster Management
- Register teams and paste player rosters directly (1 per line).
- **Roster Validation:** Automatic enforcement of minimum and maximum squad sizes.
- **Team Editing:** Full capability to edit team names, update player rosters, and assign seeds prior to match kickoff.
- **Match Start Lockout:** Protects competitive integrity by locking participant rosters once tournament matches begin.

### 3. 🎲 Automated Group Draw & Knockout Generation
- **Balanced Group Draw:** Circle-method round-robin algorithm that distributes teams evenly across groups.
- **Automatic Bye Handling:** Intelligently allocates byes when knockout stages have non-power-of-two participant counts.
- **Cross-Seeding Advancement:** Advances top *N* qualifiers from each group directly into structured knockout brackets (e.g., Group A Winner vs Group B Runner-Up).
- **Cut-Off Tie Detection:** Blocks advancement with a `409 Conflict` preview if two or more teams tie exactly on points and all configured tiebreakers at the qualification cutoff.

### 4. ⏱️ Real-Time Scorer Console
- **6-Character Invite Code:** Organizers can share an alphanumeric code to delegate scoring duties to court-side or field referees.
- **State Machine:** Matches progress through `scheduled` ➔ `live` ➔ `completed`.
- **Live Match Timer:** Integrated match stopwatch supporting pause, resume, and minute tracking.
- **WebSocket Synchronization:** Match events are pushed via Socket.io instantly to all spectators.

### 5. 📊 Live Standings & Bracket Views
- **Zero-Storage Dynamic Standings:** Standings are never hardcoded in the database; they are calculated on-the-fly from verified match scores.
- **Configurable Tiebreakers:** Ranked by Points ➔ Goal Difference (GD) ➔ Goals For (GF) ➔ Head-to-Head.
- **Interactive Knockout Tree:** Visual bracket showing team match-ups, progressing winners, and the tournament champion.

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 18 (Vite)
- **Styling:** Vanilla CSS & Tailwind CSS (Dark slate theme with vibrant neon lime accents)
- **Icons:** Lucide React
- **HTTP Client:** Axios (with request & response interceptors)
- **Real-Time Client:** Socket.io-client
- **Routing:** React Router v6

### Backend
- **Runtime:** Node.js
- **Server Framework:** Express.js
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Real-Time Engine:** Socket.io
- **Authentication:** JSON Web Tokens (JWT) stored in HTTP-only cookies / Bearer headers with bcrypt password hashing
- **Architecture:** Controller-Service-Model pattern with centralized error handling

---

## 📐 Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite Client                  │
│  (Public Hub, Knockout Bracket, Scorer Console, Admin) │
└───────────────▲───────────────────────▲────────────────┘
                │ HTTP / REST           │ WebSockets (Socket.io)
                │                       │ (room: tournament_:id)
┌───────────────▼───────────────────────▼────────────────┐
│                   Express.js Backend                   │
│   ┌────────────────────────────────────────────────┐   │
│   │  Middleware (JWT Protect, requireRole RBAC)    │   │
│   └────────────────────────────────────────────────┘   │
│   ┌──────────────────────┐  ┌──────────────────────┐   │
│   │ Tournament Logic     │  │ Standings Engine     │   │
│   │ (Draw, Fixtures, Bye)│  │ (Derived, Tie-Break) │   │
│   └──────────────────────┘  └──────────────────────┘   │
└───────────────────────▲────────────────────────────────┘
                        │ Mongoose ODM
┌───────────────────────▼────────────────────────────────┐
│                  MongoDB Atlas Database                │
│  Users • Tournaments • Participants • Stages • Matches │
└────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema Overview

```js
User {
  name: String,
  email: { type: String, unique: true },
  passwordHash: String
}

Tournament {
  name: String,
  slug: { type: String, unique: true },
  owner: ObjectId -> User,
  status: 'draft' | 'live' | 'completed',
  visibility: 'public' | 'unlisted' | 'private',
  participantType: 'solo' | 'team',
  scoreboardType: 'score' | 'winner',
  scoreLabel: String,
  points: { win: Number, draw: Number, loss: Number },
  tieBreakers: [String],
  roster: { min: Number, max: Number },
  inviteCode: { type: String, unique: true }
}

Participant {
  tournament: ObjectId -> Tournament,
  name: String,
  players: [{ name: String }],
  seed: Number
}

Stage {
  tournament: ObjectId -> Tournament,
  order: Number,
  name: String,
  format: 'roundRobin' | 'knockout' | 'manual',
  groups: [{ name: String, participants: [ObjectId] }],
  advancement: { topPerGroup: Number },
  status: 'draft' | 'live' | 'completed'
}

Match {
  tournament: ObjectId -> Tournament,
  stage: ObjectId -> Stage,
  group: String,
  round: Number,
  roundLabel: String,
  matchNumber: Number,
  teamA: ObjectId -> Participant,
  teamB: ObjectId -> Participant,
  status: 'scheduled' | 'live' | 'completed',
  result: { scoreA: Number, scoreB: Number, winner: 'A' | 'B' | 'draw' },
  nextMatch: ObjectId -> Match,
  nextSlot: 'A' | 'B',
  isBye: Boolean,
  scheduledAt: Date,
  venue: String
}

Membership {
  user: ObjectId -> User,
  tournament: ObjectId -> Tournament,
  role: 'organizer' | 'scorer'
}
```

---

## 🔌 API Endpoints Summary

All routes are served under `/api`:

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user account |
| `POST` | `/auth/login` | Public | Log in and receive JWT authentication cookie |
| `GET` | `/auth/me` | Logged In | Get current authenticated user profile |
| `POST` | `/tournaments` | Logged In | Create tournament from sport preset |
| `GET` | `/tournaments/my` | Logged In | Retrieve organizing, scoring, and followed tournaments |
| `GET` | `/tournaments/:id` | Member | Get tournament configuration & details |
| `PUT` | `/tournaments/:id` | Organizer | Update tournament settings & visibility |
| `POST` | `/tournaments/join` | Logged In | Join a tournament as scorer using 6-character code |
| `POST` | `/tournaments/:id/participants` | Organizer | Add participant team with player roster |
| `PUT` | `/participants/:pid` | Organizer | Edit participant name, roster, or seed |
| `DELETE` | `/participants/:pid` | Organizer | Remove participant before match kickoff |
| `POST` | `/tournaments/:id/stages` | Organizer | Create round-robin or knockout stage |
| `POST` | `/stages/:id/draw` | Organizer | Automatically partition teams into groups |
| `POST` | `/stages/:id/fixtures` | Organizer | Generate round-robin or knockout match schedule |
| `GET` | `/stages/:id/qualifiers` | Organizer | Preview stage qualifiers with tie cut-off checks |
| `POST` | `/stages/:id/advance` | Organizer | Cross-seed qualifiers into the next knockout stage |
| `PUT` | `/matches/:id/start` | Scorer/Org | Start match and transition to `live` status |
| `PUT` | `/matches/:id/score` | Scorer/Org | Update live score and broadcast via WebSockets |
| `PUT` | `/matches/:id/end` | Scorer/Org | Complete match, record winner, and trigger advancement |
| `GET` | `/public/t/:slug` | Public | View public tournament fixtures, tables, and bracket |
| `GET` | `/public/discover` | Public | Search and discover public tournaments |

---

## 🚀 Local Installation & Setup

### Prerequisites
- Node.js (v18.x or later)
- MongoDB Atlas cluster or local MongoDB instance

### 1. Clone Repository
```bash
git clone https://github.com/apurva202/Tournament-Hub.git
cd "Tournament Hub"
```

### 2. Backend Setup
```bash
cd server
npm install
```

Create a `.env` file in the `server` folder:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client
npm install
```

Create a `.env` file in the `client` folder (optional for local dev):
```env
VITE_API_URL=http://localhost:5000
```

Start the Vite development server:
```bash
npm run dev
```

The application will be running at **`http://localhost:5173`**.

---

## 🔮 Roadmap & Future Scope (v2)

- [ ] **Cricket & Esports Scoring Modules:** Support for cricket innings/overs/net-run-rate and best-of-3 / best-of-5 esports map vetoes.
- [ ] **Double Elimination & Swiss Formats:** Support for loser brackets and chess Swiss system pairings.
- [ ] **Player-Level Statistics:** Track tournament top scorers, golden boot, yellow/red cards, and MVP awards.
- [ ] **SMS / Email Alerts:** Push notifications to captains and players when their match is called to a court/field.
- [ ] **Custom Branding:** Allow organizers to upload custom logos and sponsor banners for tournament public pages.
- [ ] **Payment Gateways:** Integrated tournament registration fee collection via Stripe/Razorpay.

---

## 👥 Authors & Academic Context

- **Author:** Apurva Patil
- **Program:** Scaler Academy — Year 2, Term 5 (MERN Specialization)
- **Demo Video:** [Google Drive Demonstration](https://drive.google.com/drive/folders/1AtBayBzOhOFgPZryhqZHZK583nQKRaps?usp=sharing)
- **Live Deployment:** [tournament-hub-omega.vercel.app](https://tournament-hub-omega.vercel.app/)

---

<div align="center">
Built with ❤️ using MongoDB, Express, React, Node.js & Socket.io
</div>
