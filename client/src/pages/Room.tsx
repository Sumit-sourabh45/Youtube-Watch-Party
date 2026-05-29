import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import YouTubePlayer from '../components/YouTubePlayer';
import PlaybackControls from '../components/PlaybackControls';
import ParticipantPanel from '../components/ParticipantPanel';
import Chat from '../components/Chat';

type Tab = 'participants' | 'chat';

export default function RoomPage() {
  const { code }   = useParams<{ code: string }>();
  const navigate   = useNavigate();
  const { socket } = useSocket();
  const { isInRoom, joinRoom, leaveRoom, roomCode, myRole } = useRoom();
  const [activeTab, setActiveTab]   = useState<Tab>('participants');
  const [copied, setCopied]         = useState(false);

  useEffect(() => {
    if (!code || !socket) return;

    // Only attempt to join if we are not already in a room on THIS socket.
    if (!isInRoom) {
      const savedUsername = localStorage.getItem('wp_username');
      if (savedUsername) {
        joinRoom(code, savedUsername);
      } else {
        navigate('/');
      }
    }
  }, [code, socket, isInRoom, joinRoom, navigate]);

  // If removed from room, navigate back to home
  useEffect(() => {
    if (!isInRoom && !localStorage.getItem('wp_username')) {
      navigate('/');
    }
  }, [isInRoom]);

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  const copyInviteLink = () => {
    const textToCopy = roomCode;

    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => fallbackCopy(textToCopy));
    } else {
      fallbackCopy(textToCopy);
    }
  };

  const fallbackCopy = (text: string) => {
    // Fallback using a hidden textarea (works better for execCommand across browsers)
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort — show prompt so user can manually copy
      window.prompt('Copy this code:', text);
    }
    document.body.removeChild(textArea);
  };

  const roleClass =
    myRole === 'host' ? 'role-host' :
    myRole === 'moderator' ? 'role-moderator' : 'role-participant';

  return (
    <>
      <div className="bg-gradient" />
      <div className="room-layout">

        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-brand">
            <div className="topbar-logo">🎬</div>
            <span className="topbar-title">Watch Party</span>
          </div>

          <div className="topbar-room">
            <span className="topbar-room-label">Room</span>
            <code className="topbar-room-code">{roomCode || code}</code>
            <button
              id="copy-link-btn"
              onClick={copyInviteLink}
              className={`btn-copy ${copied ? 'copied' : ''}`}
            >
              {copied ? '✓ Copied!' : '📋 Copy link'}
            </button>
          </div>

          <div className="topbar-actions">
            <span className={`role-badge ${roleClass}`}>
              {myRole === 'host' ? '👑 ' : ''}{myRole}
            </span>
            <button
              id="leave-btn"
              onClick={handleLeave}
              className="btn btn-danger"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="room-content">
          {/* Left: player + controls */}
          <div className="room-main">
            <YouTubePlayer />
            <PlaybackControls />
          </div>

          {/* Right: sidebar */}
          <div className="sidebar">
            <div className="sidebar-tabs">
              {(['participants', 'chat'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  id={`tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`sidebar-tab ${activeTab === tab ? 'active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="sidebar-content">
              {activeTab === 'participants' ? <ParticipantPanel /> : <Chat />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}