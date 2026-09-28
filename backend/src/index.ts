import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { initDB, db } from './db.js';
import { router } from './routes.js';
import { SSHService } from './sshService.js';

initDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', router);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const serverId = url.searchParams.get('serverId');
  const password = url.searchParams.get('password') || '';

  if (!serverId) {
    ws.send(JSON.stringify({ type: 'error', data: 'Server ID required for terminal' }));
    return ws.close();
  }

  const serverRecord = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as any;
  if (!serverRecord) {
    ws.send(JSON.stringify({ type: 'error', data: 'Server not found' }));
    return ws.close();
  }

  try {
    SSHService.attachTerminal(ws, {
      id: serverRecord.id,
      host: serverRecord.host,
      port: serverRecord.port,
      username: serverRecord.username,
      password: password,
    });
  } catch (err: any) {
    ws.send(JSON.stringify({ type: 'error', data: `Terminal initialization failed: ${err.message}` }));
    ws.close();
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server Manager Backend running on http://localhost:${PORT}`);
  console.log(`WebSocket terminal available at ws://localhost:${PORT}/ws/terminal`);
});
