# 🎬 Watch Party — Real-Time YouTube Synchronization

Watch Party is a full-stack, real-time web application that allows users to watch YouTube videos in perfect synchronization with their friends. Engineered with a robust, race-condition hardened WebSocket architecture, it features strict role-based access control (Host, Moderator, Participant) to govern video playback and room management. 

### 1. Working Application
**Live Deployment URL:** `https://youtube-watch-party-6mde.onrender.com`

The application is fully functional both locally and in production. It utilizes a unified backend/frontend server deployment where the Node.js backend serves the compiled React application.

---

### 2. Setup and Run Instructions

**Prerequisites:**
- Node.js 18+
- A PostgreSQL database (local or [Neon](https://neon.tech) free cloud DB)

**Installation:**
```bash
git clone https://github.com/your-username/watch-party.git
cd watch-party
npm install          # installs root + all workspaces
```

**Environment Variables:**
Create a `.env` file in the `server/` directory:
```bash
DATABASE_URL=postgres://... (your Neon or local Postgres URL)
SESSION_SECRET=your_long_random_string_here
FRONTEND_URL=http://localhost:5173
PORT=4000
```

**Database Setup:**
```bash
cd server && npm run db:push
```

**Run Locally:**
From the root directory, run both the frontend and backend concurrently:
```bash
npm run dev
```
- Client: `http://localhost:5173`
- Server: `http://localhost:4000`

---

### 3. Architecture Overview (WebSocket Integration)

The application utilizes a **hybrid architecture** combining REST for static room creation and WebSockets (`Socket.IO`) for real-time video synchronization.

**WebSocket Flow:**
1. **Connection & Hydration:** When a user enters a room code, a persistent WebSocket connection is established. The Node.js server retrieves the current playback time from its **in-memory Room Manager** and sends a `sync_state` event, fast-forwarding the new user instantly to the correct timestamp.
2. **Event Emission:** When the Host interacts with the YouTube player (e.g., clicks Pause), the frontend emits a `pause` event containing the exact timestamp.
3. **Role Guards:** The server intercepts this event, checks the database to verify the user has the `host` or `moderator` role, and silently drops the event if a `participant` attempted it.
4. **Broadcast & Sync:** The server updates the central in-memory state and broadcasts the new state back to all clients in the room, forcing their local YouTube players to pause simultaneously.

Participants are restricted to a strict **view-only** mode using CSS `pointer-events: none`, preventing local interactions and ensuring their player is solely driven by the Host's WebSocket broadcasts.

---

### 4. Code Walkthrough Readiness (Technologies & Logic)

**Tech Stack:**
- **Frontend:** React + TypeScript + Vite. Uses the `YouTube IFrame API` to render and programmatically control the video player.
- **Backend:** Node.js + Express. Handles initial REST requests and serves static files in production.
- **Real-Time:** Socket.IO. Provides full-duplex communication for sub-second video state syncing.
- **Database:** PostgreSQL (Neon) + Drizzle ORM. Provides persistent storage for room configurations and user roles so active sessions are never completely lost upon server reboots.

**Core Logic Highlights:**
- **In-Memory State Management:** The database is not queried for every video tick. A lightweight `RoomManager` singleton lives in the Node.js memory. It acts as the ultimate source of truth for video states, allowing for instantaneous late-joiner synchronization without bottlenecking the database.
- **Concurrency & Race Conditions:** If the server drops (e.g., a reboot) and multiple users reconnect at the exact same millisecond, the `RoomManager` utilizes a Map structure guard to safely funnel concurrent DB re-hydration requests into a single memory instance, preventing "duplicate host" bugs.
- **Closure Capture Bugs & Ref Hooking:** React 18's StrictMode double-mounting introduces edge cases with the asynchronous YouTube API. The app logic circumvents this by passing a live `useRef` reference to the socket connection inside the YouTube event listeners, guaranteeing that WebSocket emission events never fire on stale or `null` socket instances.
