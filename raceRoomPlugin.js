import os from 'os';

export function raceRoomPlugin() {
  const rooms = new Map(); // roomCode -> roomData

  function getLanIp() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  function parseBody(req) {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch {
          resolve({});
        }
      });
    });
  }

  return {
    name: 'race-room-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;

        if (!pathname.startsWith('/api/race/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Endpoint: GET /api/race/info
        if (pathname === '/api/race/info') {
          const lanIp = getLanIp();
          res.end(JSON.stringify({
            ip: lanIp,
            port: 5173,
            baseUrl: `http://${lanIp}:5173`
          }));
          return;
        }

        // Endpoint: POST /api/race/create
        if (pathname === '/api/race/create' && req.method === 'POST') {
          const body = await parseBody(req);
          const code = (body.roomCode || 'VNR202').trim().toUpperCase();
          const maxPlayers = body.maxPlayers || 60;
          
          const room = {
            code,
            title: body.title || 'Đua Top Lịch Sử VNR202 (1930 - 1945)',
            maxPlayers,
            status: 'WAITING', // WAITING | RACING | FINISHED
            startTime: null,
            endTime: null,
            createdAt: Date.now(),
            players: new Map(), // playerId -> playerData
          };
          
          rooms.set(code, room);
          res.end(JSON.stringify({ success: true, room: serializeRoom(room) }));
          return;
        }

        // Endpoint: GET /api/race/room
        if (pathname === '/api/race/room' && req.method === 'GET') {
          const code = (parsedUrl.searchParams.get('code') || 'VNR202').trim().toUpperCase();
          let room = rooms.get(code);
          if (!room) {
            // Auto-create default room if not found
            room = {
              code,
              title: 'Đua Top Lịch Sử VNR202 (1930 - 1945)',
              maxPlayers: 60,
              status: 'WAITING',
              startTime: null,
              endTime: null,
              createdAt: Date.now(),
              players: new Map(),
            };
            rooms.set(code, room);
          }
          res.end(JSON.stringify({ success: true, room: serializeRoom(room) }));
          return;
        }

        // Endpoint: POST /api/race/action (START, RESET, END)
        if (pathname === '/api/race/action' && req.method === 'POST') {
          const body = await parseBody(req);
          const code = (body.roomCode || 'VNR202').trim().toUpperCase();
          let room = rooms.get(code);
          if (!room) {
            room = {
              code,
              title: 'Đua Top Lịch Sử VNR202 (1930 - 1945)',
              maxPlayers: 60,
              status: 'WAITING',
              startTime: null,
              endTime: null,
              createdAt: Date.now(),
              players: new Map(),
            };
            rooms.set(code, room);
          }

          if (body.action === 'START') {
            room.status = 'RACING';
            room.startTime = Date.now();
            room.endTime = null;
            for (const p of room.players.values()) {
              p.isFinished = false;
              p.finishTimeMs = null;
            }
          } else if (body.action === 'RESET') {
            room.status = 'WAITING';
            room.startTime = null;
            room.endTime = null;
            for (const p of room.players.values()) {
              p.isFinished = false;
              p.finishTimeMs = null;
              p.solvedCount = 0;
              p.currentMapId = 'map-0-quang-truong';
              p.currentMapName = 'Quảng Trường Ánh Sáng';
            }
          } else if (body.action === 'END') {
            room.status = 'FINISHED';
            room.endTime = Date.now();
          }

          res.end(JSON.stringify({ success: true, room: serializeRoom(room) }));
          return;
        }

        // Endpoint: POST /api/race/sync (Player heartbeats & progress)
        if (pathname === '/api/race/sync' && req.method === 'POST') {
          const body = await parseBody(req);
          const code = (body.roomCode || 'VNR202').trim().toUpperCase();
          let room = rooms.get(code);
          
          if (!room) {
            room = {
              code,
              title: 'Đua Top Lịch Sử VNR202 (1930 - 1945)',
              maxPlayers: 60,
              status: 'WAITING',
              startTime: null,
              endTime: null,
              createdAt: Date.now(),
              players: new Map(),
            };
            rooms.set(code, room);
          }

          const pid = (body.playerId || 'anonymous').trim();
          const existing = room.players.get(pid) || {};

          let finishTimeMs = existing.finishTimeMs || null;
          if (body.isFinished && !finishTimeMs) {
            finishTimeMs = room.startTime ? Math.max(1000, Date.now() - room.startTime) : (body.finishTimeMs || 1000);
          }

          const playerData = {
            id: pid,
            name: (body.playerName || 'Hò Văn Tèn').trim().slice(0, 30),
            currentMapId: body.currentMapId || 'map-0-quang-truong',
            currentMapName: body.currentMapName || 'Quảng Trường Ánh Sáng',
            solvedCount: typeof body.solvedCount === 'number' ? body.solvedCount : 0,
            totalPieces: typeof body.totalPieces === 'number' ? body.totalPieces : 8,
            isFinished: !!body.isFinished,
            finishTimeMs: finishTimeMs,
            lastSeen: Date.now()
          };

          room.players.set(pid, playerData);

          const sRoom = serializeRoom(room);
          const myRank = sRoom.leaderboard.findIndex(p => p.id === pid) + 1;

          res.end(JSON.stringify({
            success: true,
            roomStatus: room.status,
            startTime: room.startTime,
            endTime: room.endTime,
            rank: myRank > 0 ? myRank : 1,
            totalPlayers: sRoom.leaderboard.length,
            leaderboard: sRoom.leaderboard.slice(0, 10)
          }));
          return;
        }

        next();
      });
    }
  };
}

function serializeRoom(room) {
  const now = Date.now();
  // Mark offline if no ping in 25 seconds
  const allPlayers = Array.from(room.players.values()).map(p => ({
    ...p,
    isOnline: (now - p.lastSeen) < 25000
  }));

  const MAP_ORDER = {
    'map-5-ba-dinh': 5,
    'map-4-tan-trao': 4,
    'map-3-ba-diem': 3,
    'map-2-ha-noi': 2,
    'map-1-pac-bo': 1,
    'map-0-quang-truong': 0
  };

  allPlayers.sort((a, b) => {
    // 1. Finished players come first, sorted by fastest finish time
    if (a.isFinished && b.isFinished) {
      return (a.finishTimeMs || 0) - (b.finishTimeMs || 0);
    }
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;

    // 2. Both still racing: sort by highest map index, then solvedCount desc
    const mapA = MAP_ORDER[a.currentMapId] || 0;
    const mapB = MAP_ORDER[b.currentMapId] || 0;
    if (mapA !== mapB) return mapB - mapA;
    if (a.solvedCount !== b.solvedCount) return b.solvedCount - a.solvedCount;
    return b.lastSeen - a.lastSeen;
  });

  return {
    code: room.code,
    title: room.title,
    maxPlayers: room.maxPlayers,
    status: room.status,
    startTime: room.startTime,
    endTime: room.endTime,
    playerCount: allPlayers.length,
    leaderboard: allPlayers
  };
}

