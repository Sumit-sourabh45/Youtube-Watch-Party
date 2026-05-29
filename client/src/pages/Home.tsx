import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Home() {
  const navigate = useNavigate();

  const [createUsername, setCreateUsername] = useState('');
  const [creating, setCreating]             = useState(false);
  const [joinCode, setJoinCode]             = useState('');
  const [joinUsername, setJoinUsername]     = useState('');
  const [joining, setJoining]               = useState(false);
  const [error, setError]                   = useState('');

  // Create room — REST call only. Room.tsx handles the socket join.
  const handleCreate = async () => {
    if (!createUsername.trim()) { setError('Enter your name first.'); return; }
    setError('');
    setCreating(true);
    try {
      const res  = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Persist username so Room.tsx can read it and emit join_room
      localStorage.setItem('wp_username', createUsername.trim());
      navigate(`/room/${data.code}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  };

  // Join room — verify code exists via REST, then navigate. Room.tsx handles socket join.
  const handleJoin = async () => {
    if (!joinUsername.trim()) { setError('Enter your name first.'); return; }
    if (!joinCode.trim())     { setError('Enter a room code.'); return; }
    setError('');
    setJoining(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const res  = await fetch(`${API_URL}/api/rooms/${code}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem('wp_username', joinUsername.trim());
      navigate(`/room/${code}`);
    } catch (err: any) {
      setError(err.message || 'Room not found.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <div className="bg-gradient" />
      <div className="home-container">
        <div className="home-inner">

          <div className="home-header">
            <div className="home-logo">🎬</div>
            <h1 className="home-title">Watch Party</h1>
            <p className="home-subtitle">Watch YouTube videos in sync with friends</p>
          </div>

          {/* Create */}
          <div className="card">
            <h2 className="card-title">Create a room</h2>
            <p className="card-subtitle">
              You'll become the host and get a shareable room code.
            </p>
            <input
              id="create-username"
              type="text"
              placeholder="Your name"
              value={createUsername}
              maxLength={32}
              onChange={e => setCreateUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="input"
            />
            <button
              id="create-room-btn"
              onClick={handleCreate}
              disabled={creating}
              className={`btn btn-primary btn-full mt-md ${creating ? 'btn-disabled' : ''}`}
            >
              {creating ? 'Creating…' : '+ Create Room'}
            </button>
          </div>

          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">or</span>
            <div className="divider-line" />
          </div>

          {/* Join */}
          <div className="card">
            <h2 className="card-title">Join a room</h2>
            <p className="card-subtitle">
              Enter the 6-character room code shared by the host.
            </p>
            <input
              id="join-username"
              type="text"
              placeholder="Your name"
              value={joinUsername}
              maxLength={32}
              onChange={e => setJoinUsername(e.target.value)}
              className="input mb-sm"
            />
            <input
              id="join-code"
              type="text"
              placeholder="Room code  (e.g. A3F9KX)"
              value={joinCode}
              maxLength={6}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              className="input input-code"
            />
            <button
              id="join-room-btn"
              onClick={handleJoin}
              disabled={joining}
              className={`btn btn-secondary btn-full mt-md ${joining ? 'btn-disabled' : ''}`}
            >
              {joining ? 'Joining…' : 'Join Room →'}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </>
  );
}