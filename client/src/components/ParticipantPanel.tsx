import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { ParticipantInfo, Role } from '../types';

// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === 'host' ? 'role-host' :
    role === 'moderator' ? 'role-moderator' : 'role-participant';
  return (
    <span className={`role-badge ${cls}`}>
      {role === 'host' ? '👑 ' : ''}{role}
    </span>
  );
}

// ── ParticipantRow ────────────────────────────────────────────────────────────
function ParticipantRow({
  p, isMe, amHost, onAssignRole, onRemove, onTransferHost,
}: {
  p: ParticipantInfo;
  isMe: boolean;
  amHost: boolean;
  onAssignRole: (userId: string, role: Role) => void;
  onRemove: (userId: string) => void;
  onTransferHost: (userId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const avatarClass = isMe ? 'avatar-me'
    : p.role === 'host' ? 'avatar-host'
    : p.role === 'moderator' ? 'avatar-moderator'
    : 'avatar-participant';

  return (
    <div className="participant-row">
      {/* Avatar circle */}
      <div className={`participant-avatar ${avatarClass}`}>
        {p.username[0]?.toUpperCase()}
      </div>

      <div className="participant-info">
        <div className="participant-name">
          {p.username}
          {isMe && <span className="participant-you">(you)</span>}
        </div>
        <RoleBadge role={p.role} />
      </div>

      {/* Host actions — only shown for other participants */}
      {amHost && !isMe && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="ctx-trigger"
            title="Manage participant"
          >
            ⋯
          </button>

          {menuOpen && (
            <div className="ctx-menu">
              {/* Role assignment */}
              {p.role !== 'moderator' && (
                <button
                  className="ctx-btn"
                  onClick={() => { onAssignRole(p.userId, 'moderator'); setMenuOpen(false); }}
                >
                  ↑ Make Moderator
                </button>
              )}
              {p.role === 'moderator' && (
                <button
                  className="ctx-btn"
                  onClick={() => { onAssignRole(p.userId, 'participant'); setMenuOpen(false); }}
                >
                  ↓ Remove Moderator
                </button>
              )}
              {/* Transfer host */}
              <button
                className="ctx-btn"
                onClick={() => { onTransferHost(p.userId); setMenuOpen(false); }}
              >
                👑 Transfer Host
              </button>
              {/* Remove */}
              <button
                className="ctx-btn ctx-btn-danger"
                onClick={() => { onRemove(p.userId); setMenuOpen(false); }}
              >
                ✕ Remove from Room
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ParticipantPanel ──────────────────────────────────────────────────────────
export default function ParticipantPanel() {
  const { socket }      = useSocket();
  const { roomCode, myUserId, myRole, participants } = useRoom();

  const amHost = myRole === 'host';

  const handleAssignRole = (targetUserId: string, role: Role) => {
    socket?.emit('assign_role', { roomCode, targetUserId, newRole: role });
  };

  const handleRemove = (targetUserId: string) => {
    if (!confirm('Remove this participant from the room?')) return;
    socket?.emit('remove_participant', { roomCode, targetUserId });
  };

  const handleTransferHost = (toUserId: string) => {
    if (!confirm('Transfer host role to this participant? You will become a regular participant.')) return;
    socket?.emit('transfer_host', { roomCode, toUserId });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 className="panel-title">
        Participants · {participants.length}
      </h3>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {participants.map(p => (
          <ParticipantRow
            key={p.userId}
            p={p}
            isMe={p.userId === myUserId}
            amHost={amHost}
            onAssignRole={handleAssignRole}
            onRemove={handleRemove}
            onTransferHost={handleTransferHost}
          />
        ))}
      </div>
    </div>
  );
}
