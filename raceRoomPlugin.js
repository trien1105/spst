import os from 'os';

const MAP_ORDER = {
  'map-5-ba-dinh': 5,
  'map-4-tan-trao': 4,
  'map-3-ba-diem': 3,
  'map-2-ha-noi': 2,
  'map-1-pac-bo': 1,
  'map-0-quang-truong': 0,
  'MAP_BADINH': 5,
  'MAP_TANTRAO': 4,
  'MAP_BADIEM': 3,
  'MAP_HANOI': 2,
  'MAP_PACBO': 1,
  'MAP_QUANGTRUONG': 0
};

function createDefaultRoom(code, maxPlayers = 60, title = 'Đua Top Con Đường Độc Lập (1930 - 1945)') {
  return {
    code,
    title,
    maxPlayers,
    status: 'WAITING',
    startTime: null,
    endTime: null,
    createdAt: Date.now(),
    players: new Map(),
    _cachedSerialized: null,
    _rankMap: new Map(),
    _lastSortAt: 0,
    _dirty: true
  };
}

function getSerializedRoom(room, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && !room._dirty && room._cachedSerialized && (now - room._lastSortAt) < 350) {
    return room._cachedSerialized;
  }

  const allPlayers = [];
  for (const p of room.players.values()) {
    allPlayers.push({
      ...p,
      isOnline: (now - p.lastSeen) < 25000
    });
  }

  allPlayers.sort((a, b) => {
    if (a.isFinished && b.isFinished) {
      return (a.finishTimeMs || 0) - (b.finishTimeMs || 0);
    }
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;

    const mapA = MAP_ORDER[a.currentMapId] || 0;
    const mapB = MAP_ORDER[b.currentMapId] || 0;
    if (mapA !== mapB) return mapB - mapA;
    if (a.solvedCount !== b.solvedCount) return b.solvedCount - a.solvedCount;
    return b.lastSeen - a.lastSeen;
  });

  const rankMap = new Map();
  for (let i = 0; i < allPlayers.length; i++) {
    rankMap.set(allPlayers[i].id, i + 1);
  }

  const serialized = {
    code: room.code,
    title: room.title,
    maxPlayers: room.maxPlayers,
    status: room.status,
    startTime: room.startTime,
    endTime: room.endTime,
    playerCount: allPlayers.length,
    leaderboard: allPlayers
  };

  room._cachedSerialized = serialized;
  room._rankMap = rankMap;
  room._lastSortAt = now;
  room._dirty = false;
  return serialized;
}

export function raceRoomPlugin() {
  const rooms = new Map();

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
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 32768) req.destroy();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch {
          resolve({});
        }
      });
      req.on('error', () => resolve({}));
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

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (pathname === '/api/race/info') {
          const lanIp = getLanIp();
          res.end(JSON.stringify({
            ip: lanIp,
            port: 5173,
            baseUrl: `http://${lanIp}:5173`
          }));
          return;
        }

        if (pathname === '/api/race/create' && req.method === 'POST') {
          const body = await parseBody(req);
          const code = (body.roomCode || 'DOCLAP').trim().toUpperCase();
          const maxPlayers = body.maxPlayers || 60;
          const room = createDefaultRoom(code, maxPlayers, body.title || 'Đua Top Con Đường Độc Lập (1930 - 1945)');
          rooms.set(code, room);
          res.end(JSON.stringify({ success: true, room: getSerializedRoom(room, true) }));
          return;
        }

        if (pathname === '/api/race/room' && req.method === 'GET') {
          const code = (parsedUrl.searchParams.get('code') || 'DOCLAP').trim().toUpperCase();
          const hostId = (parsedUrl.searchParams.get('hostId') || '').trim();
          let room = rooms.get(code);
          if (!room) {
            room = createDefaultRoom(code);
            rooms.set(code, room);
          }
          if (hostId && room.players.has(hostId)) {
            room.players.delete(hostId);
            room._dirty = true;
          }
          res.end(JSON.stringify({ success: true, room: getSerializedRoom(room) }));
          return;
        }

        if (pathname === '/api/race/action' && req.method === 'POST') {
          const body = await parseBody(req);
          const code = (body.roomCode || 'DOCLAP').trim().toUpperCase();
          let room = rooms.get(code);
          if (!room) {
            room = createDefaultRoom(code);
            rooms.set(code, room);
          }

          if (body.action === 'START') {
            room.status = 'RACING';
            room.startTime = Date.now();
            room.endTime = null;
            for (const p of room.players.values()) {
              p.isFinished = false;
              p.finishTimeMs = null;
              p.solvedCount = 0;
              p.currentMapId = 'MAP_QUANGTRUONG';
              p.currentMapName = 'Quảng Trường Ánh Sáng';
            }
          } else if (body.action === 'RESET') {
            room.status = 'WAITING';
            room.startTime = null;
            room.endTime = null;
            for (const p of room.players.values()) {
              p.isFinished = false;
              p.finishTimeMs = null;
              p.solvedCount = 0;
              p.currentMapId = 'MAP_QUANGTRUONG';
              p.currentMapName = 'Quảng Trường Ánh Sáng';
            }
          } else if (body.action === 'END') {
            room.status = 'FINISHED';
            room.endTime = Date.now();
          }

          room._dirty = true;
          res.end(JSON.stringify({ success: true, room: getSerializedRoom(room, true) }));
          return;
        }

        if (pathname === '/api/race/sync' && req.method === 'POST') {
          const body = await parseBody(req);
          const code = (body.roomCode || 'DOCLAP').trim().toUpperCase();
          let room = rooms.get(code);

          if (!room) {
            room = createDefaultRoom(code);
            rooms.set(code, room);
          }

          const pid = (body.playerId || 'anonymous').trim();

          if (body.isHost) {
            if (room.players.has(pid)) {
              room.players.delete(pid);
              room._dirty = true;
            }
            const sRoom = getSerializedRoom(room);
            res.end(JSON.stringify({
              success: true,
              roomStatus: room.status,
              startTime: room.startTime,
              endTime: room.endTime,
              rank: 0,
              totalPlayers: sRoom.playerCount
            }));
            return;
          }

          const existing = room.players.get(pid);

          const isClientStaleForNewRace =
            room.status === 'RACING' &&
            room.startTime &&
            body.clientStartTime !== room.startTime;

          let finishTimeMs = isClientStaleForNewRace ? null : (existing?.finishTimeMs || null);
          if (!isClientStaleForNewRace && body.isFinished && !finishTimeMs) {
            finishTimeMs = room.startTime ? Math.max(1000, Date.now() - room.startTime) : (body.finishTimeMs || 1000);
            room._dirty = true;
          }

          const nextSolved = isClientStaleForNewRace
            ? 0
            : (typeof body.solvedCount === 'number' ? body.solvedCount : 0);
          const nextMapId = isClientStaleForNewRace
            ? 'MAP_QUANGTRUONG'
            : (body.currentMapId || 'MAP_QUANGTRUONG');
          const nextMapName = isClientStaleForNewRace
            ? 'Quảng Trường Ánh Sáng'
            : (body.currentMapName || 'Quảng Trường Ánh Sáng');
          const nextIsFinished = isClientStaleForNewRace ? false : !!body.isFinished;
          const nextName = (body.playerName || 'Hò Văn Tèn').trim().slice(0, 30);

          if (
            !existing ||
            existing.solvedCount !== nextSolved ||
            existing.currentMapId !== nextMapId ||
            existing.name !== nextName ||
            existing.isFinished !== nextIsFinished
          ) {
            room._dirty = true;
          }

          room.players.set(pid, {
            id: pid,
            name: nextName,
            currentMapId: nextMapId,
            currentMapName: nextMapName,
            solvedCount: nextSolved,
            totalPieces: typeof body.totalPieces === 'number' ? body.totalPieces : 8,
            isFinished: nextIsFinished,
            finishTimeMs,
            lastSeen: Date.now()
          });

          const sRoom = getSerializedRoom(room);
          const myRank = room._rankMap.get(pid) || 1;

          res.end(JSON.stringify({
            success: true,
            roomStatus: room.status,
            startTime: room.startTime,
            endTime: room.endTime,
            rank: myRank,
            totalPlayers: sRoom.playerCount
          }));
          return;
        }

        next();
      });
    }
  };
}
