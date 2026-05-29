import { io } from 'socket.io-client';
const socket = io('http://localhost:4000', { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('Connected, sending join_room...');
  socket.emit('join_room', { roomCode: 'TEST01', username: 'tester' });
});

socket.on('joined', (data) => {
  console.log('JOINED:', data);
  process.exit(0);
});

socket.on('error', (err) => {
  console.error('SERVER ERROR:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 3000);
