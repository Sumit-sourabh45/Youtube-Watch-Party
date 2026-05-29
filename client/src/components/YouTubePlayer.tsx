import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { VideoState } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const PLAYER_DIV_ID = 'yt-player';

export default function YouTubePlayer() {
  const { socket }     = useSocket();
  const { roomCode, myRole, videoState } = useRoom();

  const playerRef     = useRef<any>(null);
  const readyRef      = useRef(false);
  const isSyncing     = useRef(false);

  // ── FIX: store socket in a ref so player event handlers always have the latest
  const socketRef = useRef(socket);
  socketRef.current = socket;

  const canControlRef = useRef(false);
  canControlRef.current = myRole === 'host' || myRole === 'moderator';

  // ── FIX: track roomCode in a ref so socket emit always uses fresh value
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const hasVideo = Boolean(videoState?.videoId);

  const applyVideoState = useCallback((vs: VideoState) => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    // Skip if no video to load
    if (!vs.videoId) return;

    isSyncing.current = true;

    const currentVideoId = player.getVideoData?.()?.video_id;
    if (vs.videoId !== currentVideoId) {
      player.loadVideoById({ videoId: vs.videoId, startSeconds: vs.currentTime });
      if (!vs.playing) {
        setTimeout(() => {
          player.pauseVideo();
          isSyncing.current = false;
        }, 500);
        return;
      }
    } else {
      const currentTime = player.getCurrentTime?.() ?? 0;
      if (Math.abs(currentTime - vs.currentTime) > 2) {
        player.seekTo(vs.currentTime, true);
      }
      vs.playing ? player.playVideo() : player.pauseVideo();
    }

    setTimeout(() => { isSyncing.current = false; }, 300);
  }, []);

  useEffect(() => {
    const initPlayer = () => {
      if (playerRef.current) return; // already initialized

      playerRef.current = new window.YT.Player(PLAYER_DIV_ID, {
        height: '100%',
        width:  '100%',
        playerVars: {
          playsinline:    1,
          rel:            0,
          modestbranding: 1,
          // FIX: always show controls — role is enforced server-side.
          controls: 1,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (videoState?.videoId) applyVideoState(videoState);
            socketRef.current?.emit('request_sync', { roomCode: roomCodeRef.current });
          },
          onStateChange: (event: any) => {
            if (isSyncing.current) return;
            if (!canControlRef.current) return;

            const YT_PLAYING = 1;
            const YT_PAUSED  = 2;

            if (event.data === YT_PLAYING) {
              socketRef.current?.emit('play', {
                roomCode:    roomCodeRef.current,
                currentTime: playerRef.current?.getCurrentTime() ?? 0,
              });
            } else if (event.data === YT_PAUSED) {
              socketRef.current?.emit('pause', {
                roomCode:    roomCodeRef.current,
                currentTime: playerRef.current?.getCurrentTime() ?? 0,
              });
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        initPlayer();
      };
    }

    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
      readyRef.current  = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply incoming sync_state updates from RoomContext
  useEffect(() => {
    if (videoState?.videoId) applyVideoState(videoState);
  }, [videoState, applyVideoState]);

  return (
    <div 
      className="player-wrapper" 
      style={{ pointerEvents: canControlRef.current ? 'auto' : 'none' }}
    >
      {/* Show placeholder when no video is loaded — hides the YouTube "no video" error */}
      {!hasVideo && (
        <div className="player-placeholder">
          <div className="player-placeholder-icon">🎬</div>
          <h3 className="player-placeholder-title">No video loaded</h3>
          <p className="player-placeholder-text">
            {canControlRef.current
              ? 'Paste a YouTube URL below and click "Load video" to start watching'
              : 'Waiting for the host to load a video…'}
          </p>
        </div>
      )}
      <div id={PLAYER_DIV_ID} />
    </div>
  );
}