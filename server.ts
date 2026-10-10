import http from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './src/server/socketHandler';
import { globalRoomManager } from './src/server/RoomManager';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  setupSocketHandlers(io, globalRoomManager);

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
