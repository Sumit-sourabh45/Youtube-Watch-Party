import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

// Extract YouTube video ID from a URL or a bare ID
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  // Already a bare video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Standard watch URL
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export default function PlaybackControls() {
  const { socket }   = useSocket();
  const { roomCode, myRole } = useRoom();
  const [urlInput, setUrlInput] = useState('');
  const [error, setError]       = useState('');

  const canControl = myRole === 'host' || myRole === 'moderator';

  // Participants see a status message instead of controls
  if (!canControl) {
    return (
      <div className="controls-bar" style={{ justifyContent: 'center' }}>
        <p className="controls-label" style={{ margin: 0 }}>
          👁️ You are a viewer — only the host or moderators can control playback.
        </p>
      </div>
    );
  }

  const handleChangeVideo = () => {
    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      setError('Invalid YouTube URL or video ID');
      return;
    }
    setError('');
    socket?.emit('change_video', { roomCode, videoId });
    setUrlInput('');
  };

  return (
    <div>
      <div className="controls-bar">
        <input
          id="video-url-input"
          type="text"
          placeholder="Paste YouTube URL or video ID…"
          value={urlInput}
          onChange={e => { setUrlInput(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleChangeVideo()}
          className="input"
        />
        <button
          id="load-video-btn"
          onClick={handleChangeVideo}
          className="btn btn-primary"
        >
          Load video
        </button>
      </div>

      {error && <p className="error-text" style={{ textAlign: 'left', marginTop: 6 }}>{error}</p>}

      <p className="controls-label">
        {myRole === 'host' ? '👑 You are the host' : '🛡️ You are a moderator'} — use the
        player controls above to play, pause, and seek for everyone.
      </p>
    </div>
  );
}
