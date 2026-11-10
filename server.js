import http from 'http';
import os from 'os';
import { URL } from 'url';

const PORT = process.env.PORT || 4000;
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

const server = http.createServer(async (req, res) => {
  // CORS Headers cho phép Vercel (https://conduongdoclap.vercel.app) gọi API mượt mà
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Root Healthcheck
  if (pathname === '/' || pathname === '/health') {
    res.end(JSON.stringify({
      status: 'ONLINE',
      app: 'VNR202 Đua Top Backend Server',
      lanIp: getLanIp(),
      port: PORT,
      activeRooms: rooms.size,
      uptimeSec: Math.floor(process.uptime())
    }));
    return;
  }

  // 1. GET /api/race/info
  if (pathname === '/api/race/info') {
    const lanIp = getLanIp();
    res.end(JSON.stringify({
      ip: lanIp,
      port: PORT,
      baseUrl: `http://${lanIp}:${PORT}`
    }));
    return;
  }

  // 2. POST /api/race/create
  if (pathname === '/api/race/create' && req.method === 'POST') {
    const body = await parseBody(req);
    const code = (body.roomCode || 'VNR202').trim().toUpperCase();
    const maxPlayers = body.maxPlayers || 60;

    const room = {
      code,
      title: body.title || 'Đua Top Lịch Sử VNR202 (1930 - 1945)',
      maxPlayers,
      status: 'WAITING',
      startTime: null,
      endTime: null,
      createdAt: Date.now(),
      players: new Map()
    };

    rooms.set(code, room);
    console.log(`[ROOM CREATED] Mã phòng: ${code} (Tối đa ${maxPlayers} người)`);
    res.end(JSON.stringify({ success: true, room: serializeRoom(room) }));
    return;
  }

  // 3. GET /api/race/room
  if (pathname === '/api/race/room' && req.method === 'GET') {
    const code = (parsedUrl.searchParams.get('code') || 'VNR202').trim().toUpperCase();
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
        players: new Map()
      };
      rooms.set(code, room);
    }
    res.end(JSON.stringify({ success: true, room: serializeRoom(room) }));
    return;
  }

  // 4. POST /api/race/action (START, RESET, END)
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
        players: new Map()
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
      console.log(`[RACE STARTED] Phòng ${code} đã bắt đầu lúc ${new Date().toLocaleTimeString()}!`);
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
      console.log(`[RACE RESET] Phòng ${code} đã được Host làm mới!`);
    } else if (body.action === 'END') {
      room.status = 'FINISHED';
      room.endTime = Date.now();
      console.log(`[RACE ENDED] Phòng ${code} đã kết thúc!`);
    }

    res.end(JSON.stringify({ success: true, room: serializeRoom(room) }));
    return;
  }

  // 5. POST /api/race/sync (Player heartbeats & live progress)
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
        players: new Map()
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

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log('================================================================');
  console.log('       VNR202 BACKEND SERVER (DÀNH CHO MÁY CHỦ HOST CỤC BỘ)     ');
  console.log('================================================================');
  console.log(`[ONLINE] Server đang lắng nghe tại Cổng: ${PORT}`);
  console.log(`- Localhost:    http://localhost:${PORT}`);
  console.log(`- LAN (Wi-Fi):  http://${lanIp}:${PORT}`);
  console.log('----------------------------------------------------------------');
  console.log('Frontend trên Vercel (conduongdoclap.vercel.app) có thể kết nối');
  console.log(`vào backend này trực tiếp hoặc qua đường hầm (Tunnel).`);
  console.log('================================================================\n');
});

