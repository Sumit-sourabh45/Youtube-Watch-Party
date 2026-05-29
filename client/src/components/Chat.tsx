import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export default function Chat() {
  const { socket }  = useSocket();
  const { roomCode, messages, myUserId } = useRoom();
  const [text, setText]   = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || !socket) return;
    socket.emit('chat_message', { roomCode, message: trimmed });
    setText('');
  };

  return (
    <div className="chat-container">
      <h3 className="panel-title">Chat</h3>

      {/* Message list */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet. Say hi! 👋</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.userId === myUserId;
          return (
            <div key={i} className={`chat-bubble-wrap ${isMe ? 'me' : 'other'}`}>
              {!isMe && <p className="chat-sender">{msg.username}</p>}
              <div className={`chat-bubble ${isMe ? 'me' : 'other'}`}>
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <input
          id="chat-input"
          type="text"
          placeholder="Type a message…"
          value={text}
          maxLength={500}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          className="input"
        />
        <button
          id="chat-send-btn"
          onClick={send}
          disabled={!text.trim()}
          className="btn-send"
        >
          Send
        </button>
      </div>
    </div>
  );
}
