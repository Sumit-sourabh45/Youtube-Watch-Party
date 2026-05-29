import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { pool } from './db';
import roomsRouter from './routes/rooms';
import { registerSocketHandlers } from './socket/handlers';

const app    = express();
const server = http.createServer(app);
const PORT   = Number(process.env.PORT) || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Trust proxy (required for secure cookies behind Render / Heroku / etc.) ──
if (IS_PROD) {
  app.set('trust proxy', 1);
}

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production single-service mode the client is served from the same origin,
// but we still allow FRONTEND_URL for flexibility (e.g. separate frontend).
app.use(cors({
  origin:      IS_PROD ? [FRONTEND_URL, `http://localhost:${PORT}`] : FRONTEND_URL,
  credentials: true,             // allow cookies to be sent cross-origin
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Sessions (stored in Postgres) ─────────────────────────────────────────────
// Survives server restarts. Required for reconnect to work properly.
const PgSession = connectPgSimple(session);

const sessionMiddleware = session({
  store: new PgSession({
    pool,                        // reuse the pg Pool from db/index.ts
    tableName: 'user_sessions',
    createTableIfMissing: true,  // auto-creates the sessions table
  }),
  secret:            process.env.SESSION_SECRET || 'dev_secret_change_in_prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   7 * 24 * 60 * 60 * 1000, // 1 week
    httpOnly: true,
    secure:   IS_PROD,                  // HTTPS only in prod
    sameSite: IS_PROD ? 'none' : 'lax',
  },
});

app.use(sessionMiddleware);

// ── Socket.IO server ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      IS_PROD ? [FRONTEND_URL, `http://localhost:${PORT}`] : FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'], // websocket preferred; polling as fallback
});

// Share Express session with Socket.IO so we can read req.session inside handlers
io.engine.use(sessionMiddleware);

// Register all event handlers
registerSocketHandlers(io);

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/rooms', roomsRouter);

// Health check — Render uses this to verify the service is up
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Serve client static build in production ───────────────────────────────────
// In production the client is pre-built via `npm run build` in the client workspace.
// The server serves those static files so everything runs on a single URL.
if (IS_PROD) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for any route not matched by API or static files
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Accepting connections from: ${FRONTEND_URL}`);
  if (IS_PROD) console.log('Serving client static files from client/dist');
});
