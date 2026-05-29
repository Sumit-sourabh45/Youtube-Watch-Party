import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { RoomProvider } from './context/RoomContext';
import Home from './pages/Home';
import RoomPage from './pages/Room';

// ── Provider order matters ────────────────────────────────────────────────────
// SocketProvider creates the socket connection first.
// RoomProvider sits inside it so it can access the socket via useSocket().
export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <RoomProvider>
          <Routes>
            <Route path="/"           element={<Home />} />
            <Route path="/room/:code" element={<RoomPage />} />
            {/* Catch-all — redirect unknown paths to home */}
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </RoomProvider>
      </SocketProvider>
    </BrowserRouter>
  );
}
