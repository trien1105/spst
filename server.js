import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { URL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

const PORT = process.env.PORT || 4000;
const rooms = new Map(); // roomCode -> roomData

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

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

// Tối ưu hóa cho 60 người chơi cùng lúc: Cache kết quả sort trong 350ms
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

const server = http.createServer(async (req, res) => {
  // CORS & Private Network Access Headers cho phép https://conduongdoclap.vercel.app gọi thẳng vào http://localhost:4000 trên máy hiện tại
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Bypass-Tunnel-Reminder');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Healthcheck Endpoint
  if (pathname === '/health') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      status: 'ONLINE',
      app: 'Con Đường Độc Lập - Local JS Backend Engine',
      lanIp: getLanIp(),
      port: PORT,
      activeRooms: rooms.size,
      uptimeSec: Math.floor(process.uptime())
    }));
    return;
  }

  // 1. GET /api/race/info
  if (pathname === '/api/race/info') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const body = await parseBody(req);
    const code = (body.roomCode || 'DOCLAP').trim().toUpperCase();
    const maxPlayers = body.maxPlayers || 60;

    const room = createDefaultRoom(code, maxPlayers, body.title || 'Đua Top Con Đường Độc Lập (1930 - 1945)');
    rooms.set(code, room);
    console.log(`[ROOM CREATED] Mã phòng: ${code} (Tối đa ${maxPlayers} người)`);
    res.end(JSON.stringify({ success: true, room: getSerializedRoom(room, true) }));
    return;
  }

  // 3. GET /api/race/room
  if (pathname === '/api/race/room' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

  // 4. POST /api/race/action (START, RESET, END)
  if (pathname === '/api/race/action' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
      console.log(`[RACE STARTED] Phòng ${code} đã bắt đầu mới lúc ${new Date().toLocaleTimeString()}!`);
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
      console.log(`[RACE RESET] Phòng ${code} đã được Host làm mới!`);
    } else if (body.action === 'END') {
      room.status = 'FINISHED';
      room.endTime = Date.now();
      console.log(`[RACE ENDED] Phòng ${code} đã kết thúc!`);
    }

    room._dirty = true;
    res.end(JSON.stringify({ success: true, room: getSerializedRoom(room, true) }));
    return;
  }

  // 5. POST /api/race/sync (Lightweight Heartbeat cho 60 người chơi mượt mà không nghẽn cổ chai)
  if (pathname === '/api/race/sync' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const body = await parseBody(req);
    const code = (body.roomCode || 'DOCLAP').trim().toUpperCase();
    let room = rooms.get(code);

    if (!room) {
      room = createDefaultRoom(code);
      rooms.set(code, room);
    }

    const pid = (body.playerId || 'anonymous').trim();

    // Nếu là tài khoản Admin / Host thì tuyệt đối KHÔNG tính vào danh sách người chơi
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

    // Nếu phòng đang RACING với startTime mới mà client chưa kịp reset (clientStartTime !== room.startTime),
    // ép dữ liệu của client trên server về 0 ở đầu ván để BXH Admin luôn sạch từ đầu
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

    // Chỉ đánh dấu dirty khi điểm số, map, tên hoặc trạng thái về đích thực sự thay đổi
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

    // Payload siêu nhẹ (< 120 bytes) để 60 máy phản hồi tức thì < 2ms
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

  // 6. Phục vụ trực tiếp JS Engine & Assets từ thư mục dist/ nếu truy cập thẳng vào máy Host
  if (req.method === 'GET' && fs.existsSync(DIST_DIR)) {
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';
    let filePath = path.join(DIST_DIR, safePath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      if (ext !== '.html') {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Fallback JSON status nếu gọi tới '/' mà chưa build dist
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    status: 'ONLINE',
    app: 'Con Đường Độc Lập - Local Backend Server (60 Players Optimized)',
    lanIp: getLanIp(),
    port: PORT,
    activeRooms: rooms.size
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log('================================================================');
  console.log('   CON ĐƯỜNG ĐỘC LẬP (1930 - 1945) - MÁY CHỦ XỬ LÝ TỐC ĐỘ CAO  ');
  console.log('================================================================');
  console.log(`[ONLINE] Máy chủ đang chạy tại Cổng: ${PORT}`);
  console.log(`- Tại máy Host:  http://localhost:${PORT}`);
  console.log(`- Mạng LAN/WiFi: http://${lanIp}:${PORT}`);
  console.log('----------------------------------------------------------------');
  console.log('✦ Đã tối ưu hóa bộ đệm RAM chịu tải 60 người chơi cùng lúc.');
  console.log('✦ Giao diện https://conduongdoclap.vercel.app kết nối trực tiếp');
  console.log('  về máy chủ này để xử lý logic phòng đua mượt mà nhất.');
  console.log('================================================================\n');
});
