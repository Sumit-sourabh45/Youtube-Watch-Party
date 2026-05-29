# 🎬 Watch Party — Real-Time YouTube Synchronization

Watch Party is a full-stack, real-time web application that allows users to watch YouTube videos in perfect synchronization with their friends. Engineered with a robust, race-condition hardened WebSocket architecture, it features strict role-based access control (Host, Moderator, Participant) to govern video playback and room management. 

Built with **React**, **Node.js**, **Socket.IO**, **PostgreSQL (Neon)**, and **Drizzle ORM**.

**Live Demo:** `https://watch-party.onrender.com` _(update after deploy)_

---

## Features

- Create or join rooms with a 6-character invite code
- Real-time play / pause / seek / change video sync via WebSockets
- Role-based access: **Host** · **Moderator** · **Participant**
- Host can promote, remove, and transfer host to any participant
- Live participant list with role badges
- Group chat (bonus)
- Auto-promotes next participant to host if host disconnects
- Responsive design — works on mobile and desktop

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React + TypeScript + Vite | UI, room creation/join, video player |
| **Backend** | Node.js + Express | API, room logic, WebSocket server |
| **Real-time** | Socket.IO | WebSocket-based bidirectional communication |
| **Database** | PostgreSQL (Neon) | Rooms, participants, sessions |
| **Video** | YouTube IFrame API | Embedded, controllable YouTube player |
| **ORM** | Drizzle ORM | Type-safe database queries |

---

## Architecture Overview

```
Client (React + Vite)              Server (Node.js + Express)
──────────────────────             ──────────────────────────
SocketContext ─────── wss ───────► Socket.IO server
  │                                    │
  │  emit: play/pause/seek             ├── Role guard (canControl?)
  │  emit: change_video                ├── RoomManager (in-memory)
  │  emit: assign_role                 │     └── Room instances
  │  emit: chat_message                │           └── Participant map
  │  emit: leave_room                  │
  ◄─ on: sync_state ──────────────────┤
  ◄─ on: role_assigned                 │
  ◄─ on: user_joined/left             │
                                       │
RoomContext                            ├── REST API (Express)
  └── videoState ──────────────────►   │     POST /api/rooms
  └── participants                     │     GET  /api/rooms/:code
  └── myRole                           │
                                       └── PostgreSQL (Neon + Drizzle ORM)
YouTubePlayer                               rooms + participants + sessions
  └── isSyncing flag ◄── CRITICAL
      Prevents sync loop when player
      APIs fire onStateChange after
      programmatic calls
```

### WebSocket Event Flow

```
Host presses play
  ↓
Client: socket.emit('play', { roomCode, currentTime })
  ↓
Server: validates actor.canControl() → true
  ↓
Server: room.setState({ playing: true, currentTime })
  ↓
Server: io.to(roomCode).emit('sync_state', videoState)
  ↓
All clients: applyVideoState() → player.seekTo() + player.playVideo()
  ↓
isSyncing = true → onStateChange fires but is ignored → no loop
```

### How WebSockets Enable Real-Time Sync

Socket.IO provides full-duplex WebSocket communication between the browser and server. When a host or moderator interacts with the player (play, pause, seek), the client emits an event to the server. The server validates the user's role (only hosts/moderators can control), updates the in-memory room state, and broadcasts a `sync_state` event to **all** connected clients in the room. Each client applies the state to their YouTube player, using an `isSyncing` flag to prevent infinite loops from the player's own state change callbacks.

### Role-Based Logic on the Backend

Every playback event (play, pause, seek, change_video) goes through a role guard:

```typescript
const actor = room.getBySocketId(socket.id);
if (!actor?.canControl()) return; // silently reject
```

Only `host` and `moderator` roles pass `canControl()`. Only `host` passes `canManageRoom()` (for assigning roles, removing participants, and transferring host). This prevents participants from controlling playback even if they manually emit socket events.

---

## WebSocket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join_room` | Client → Server | `{ roomCode, username }` | User joins; server assigns role |
| `leave_room` | Client → Server | `{ roomCode }` | User leaves the room |
| `sync_state` | Server → Clients | `{ playState, currentTime, videoId }` | Broadcast current video state |
| `play` | Client → Server | `{ roomCode, currentTime }` | Host/Moderator pressed play |
| `pause` | Client → Server | `{ roomCode, currentTime }` | Host/Moderator pressed pause |
| `seek` | Client → Server | `{ roomCode, currentTime }` | Host/Moderator seeks |
| `change_video` | Client → Server | `{ roomCode, videoId }` | Host/Moderator changes video |
| `assign_role` | Client → Server | `{ roomCode, targetUserId, newRole }` | Host assigns role |
| `remove_participant` | Client → Server | `{ roomCode, targetUserId }` | Host removes user |
| `transfer_host` | Client → Server | `{ roomCode, toUserId }` | Host transfers to another |
| `chat_message` | Bidirectional | `{ roomCode, message }` | Text chat in room |
| `request_sync` | Client → Server | `{ roomCode }` | Late-joiner requests current state |

---

## Local Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local or [Neon](https://neon.tech) free cloud DB)

### 1. Clone and install

```bash
git clone https://github.com/your-username/watch-party.git
cd watch-party
npm install          # installs root + all workspaces
```

### 2. Configure environment

```bash
# Server
cp .env.example server/.env
# Edit server/.env:
#   DATABASE_URL=postgres://... (your Neon or local Postgres URL)
#   SESSION_SECRET=any_long_random_string
#   FRONTEND_URL=http://localhost:5173
#   PORT=4000
```

### 3. Create the database schema

```bash
cd server && npm run db:push
```

### 4. Run (both server + client in one command)

```bash
# From the root:
npm run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:4000  
- Health check: http://localhost:4000/health

---

## Production Deployment (Render)

This project uses a **single-service** deployment: the Node.js server serves the React client's static build files, so everything runs on one URL.

### Using Render Blueprint

1. Push code to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect your GitHub repo — Render reads `render.yaml` automatically
4. Set the following **environment variables** on the service:
   - `DATABASE_URL` = your Neon Postgres connection string
   - `FRONTEND_URL` = your Render service URL (e.g. `https://watch-party-xxxx.onrender.com`)
5. Trigger a deploy

### Manual Setup on Render

1. **New → Web Service** → Connect your GitHub repo
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `npm run start`
4. **Environment Variables:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Neon connection string |
| `SESSION_SECRET` | A long random string (auto-generate) |
| `FRONTEND_URL` | Your Render service URL |
| `PORT` | `4000` |

> **Note:** Render free tier spins down after 15 min idle. First request after sleep takes ~30s. Upgrade to Starter ($7/mo) to avoid this.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection string (Neon or local) |
| `SESSION_SECRET` | server | Cookie signing secret (long random string) |
| `FRONTEND_URL` | server | Exact origin of the client (no trailing slash) |
| `PORT` | server | Port to listen on (Render sets this automatically) |
| `VITE_API_URL` | client | Backend URL (empty string in production = same origin) |

---

## Project Structure

```
watch-party/
├── package.json          ← root workspace
├── render.yaml           ← Render deploy config
├── .env.example
├── client/               ← React + Vite + TypeScript
│   ├── src/
│   │   ├── index.css              ← design system (dark theme + glassmorphism)
│   │   ├── context/
│   │   │   ├── SocketContext.tsx   ← single socket instance
│   │   │   └── RoomContext.tsx     ← all room state + socket events
│   │   ├── pages/
│   │   │   ├── Home.tsx            ← create / join room
│   │   │   └── Room.tsx            ← main watch party UI
│   │   ├── components/
│   │   │   ├── YouTubePlayer.tsx   ← IFrame API + isSyncing flag
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── ParticipantPanel.tsx
│   │   │   └── Chat.tsx
│   │   └── types.ts
└── server/               ← Node.js + Express + Socket.IO
    ├── src/
    │   ├── index.ts               ← Express + Socket.IO + static file serving
    │   ├── db/
    │   │   ├── schema.ts          ← Drizzle schema (rooms, participants)
    │   │   └── index.ts           ← pg Pool + drizzle instance
    │   ├── classes/
    │   │   ├── Participant.ts     ← role + permission helpers
    │   │   ├── Room.ts            ← video state + participant map
    │   │   └── RoomManager.ts     ← singleton, all active rooms
    │   ├── socket/
    │   │   └── handlers.ts        ← all socket event handlers (incl. leave_room)
    │   └── routes/
    │       └── rooms.ts           ← REST: create + look up rooms
    └── drizzle.config.ts
```

---

## Deployment Choices & Trade-offs

- **Single-service deployment:** Server serves client static files in production. Avoids CORS complexity and reduces cost (one Render service instead of two). Trade-off: builds are slightly longer since both client and server build together.
- **Neon Postgres over Render-managed DB:** Neon's free tier doesn't sleep, providing better uptime. Connection pooling is built-in. Trade-off: external dependency on Neon.
- **In-memory room state:** Video state lives in the RoomManager singleton for instant access. Trade-off: state is lost on server restart (rooms are re-hydrated from DB when users rejoin).
- **Socket.IO over raw WebSockets:** Provides automatic reconnection, room management, and polling fallback. Trade-off: slightly larger bundle than raw `ws`.
