import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { URL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

// Tự động nạp biến môi trường từ file .env nếu có
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch {}
}

const PORT = Number(process.env.PORT || 4000);
const VPS_IP = (process.env.VPS_IP || '180.93.126.40').trim();
const PUBLIC_BE_URL = (process.env.PUBLIC_BE_URL || `http://${VPS_IP}:${PORT}`).trim().replace(/\/+$/, '');
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
  return VPS_IP || '127.0.0.1';
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
      return (a.finishTimeMs || Number.MAX_SAFE_INTEGER) - (b.finishTimeMs || Number.MAX_SAFE_INTEGER);
    }
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;

    const mapA = MAP_ORDER[a.currentMapId] || 0;
    const mapB = MAP_ORDER[b.currentMapId] || 0;
    if (mapA !== mapB) return mapB - mapA;
    if (a.solvedCount !== b.solvedCount) return b.solvedCount - a.solvedCount;
    return (a.lastProgressAt || a.joinedAt || 0) - (b.lastProgressAt || b.joinedAt || 0);
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
  // CORS & Private Network Access Headers cho phép https://conduongdoclap.vercel.app & mọi client gọi tới VPS 180.93.126.40
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

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
      app: 'Con Đường Độc Lập - VPS Backend Engine',
      vpsIp: VPS_IP,
      lanIp: getLanIp(),
      port: PORT,
      publicUrl: PUBLIC_BE_URL,
      activeRooms: rooms.size,
      uptimeSec: Math.floor(process.uptime())
    }));
    return;
  }

  // 1. GET / POST /api/race/info
  if (pathname === '/api/race/info') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ip: VPS_IP,
      lanIp: getLanIp(),
      port: PORT,
      baseUrl: PUBLIC_BE_URL
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

  // 3. GET hoặc POST /api/race/room
  if (pathname === '/api/race/room' && (req.method === 'GET' || req.method === 'POST')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const body = req.method === 'POST' ? await parseBody(req) : {};
    const code = (parsedUrl.searchParams.get('code') || body.code || 'DOCLAP').trim().toUpperCase();
    const hostId = (parsedUrl.searchParams.get('hostId') || body.hostId || '').trim();
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
      const nowMs = Date.now();
      room.status = 'RACING';
      room.startTime = nowMs;
      room.endTime = null;
      for (const p of room.players.values()) {
        p.isFinished = false;
        p.finishTimeMs = null;
        p.solvedCount = 0;
        p.currentMapId = 'MAP_QUANGTRUONG';
        p.currentMapName = 'Quảng Trường Ánh Sáng';
        p.joinedAt = nowMs;
        p.lastProgressAt = nowMs;
      }
      console.log(`[RACE STARTED] Phòng ${code} đã bắt đầu mới lúc ${new Date().toLocaleTimeString()}!`);
    } else if (body.action === 'RESET') {
      const nowMs = Date.now();
      room.status = 'WAITING';
      room.startTime = null;
      room.endTime = null;
      for (const p of room.players.values()) {
        p.isFinished = false;
        p.finishTimeMs = null;
        p.solvedCount = 0;
        p.currentMapId = 'MAP_QUANGTRUONG';
        p.currentMapName = 'Quảng Trường Ánh Sáng';
        p.joinedAt = nowMs;
        p.lastProgressAt = nowMs;
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

    const nowMs = Date.now();
    const existing = room.players.get(pid);

    // Nếu phòng đang RACING với startTime mới mà client chưa kịp reset (clientStartTime !== room.startTime),
    // ép dữ liệu của client trên server về 0 ở đầu ván để BXH Admin luôn sạch từ đầu
    const isClientStaleForNewRace =
      room.status === 'RACING' &&
      room.startTime &&
      body.clientStartTime !== room.startTime;

    const joinedAt = isClientStaleForNewRace
      ? (room.startTime || nowMs)
      : (existing?.joinedAt || room.startTime || nowMs);

    const nextIsFinished = isClientStaleForNewRace ? false : !!(body.isFinished || existing?.isFinished);

    // Khóa chặt finishTimeMs ngay thời điểm người chơi về đích lần đầu tiên trong ván
    let finishTimeMs = isClientStaleForNewRace ? null : (existing?.finishTimeMs || null);
    if (nextIsFinished && (!finishTimeMs || finishTimeMs <= 0)) {
      if (room.startTime) {
        const refEnd = room.endTime ? Math.min(nowMs, room.endTime) : nowMs;
        finishTimeMs = Math.max(1000, refEnd - room.startTime);
      } else if (typeof body.finishTimeMs === 'number' && body.finishTimeMs >= 1000) {
        finishTimeMs = Math.round(body.finishTimeMs);
      } else {
        finishTimeMs = Math.max(1000, nowMs - joinedAt);
      }
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
    const nextName = (body.playerName || 'Hò Văn Tèn').trim().slice(0, 30);

    const hasProgressChanged =
      !existing ||
      existing.solvedCount !== nextSolved ||
      existing.currentMapId !== nextMapId ||
      existing.isFinished !== nextIsFinished;

    if (hasProgressChanged || existing.name !== nextName) {
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
      joinedAt,
      lastProgressAt: hasProgressChanged ? nowMs : (existing?.lastProgressAt || joinedAt),
      lastSeen: nowMs
    });

    const sRoom = getSerializedRoom(room);
    const myRank = room._rankMap.get(pid) || 1;

    res.end(JSON.stringify({
      success: true,
      roomStatus: room.status,
      startTime: room.startTime,
      endTime: room.endTime,
      rank: myRank,
      totalPlayers: sRoom.playerCount,
      finishTimeMs
    }));
    return;
  }

  // 6. Phục vụ trực tiếp JS Engine & Assets từ thư mục dist/ nếu có
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

  // Fallback JSON status
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    status: 'ONLINE',
    app: 'Con Đường Độc Lập - VPS Backend Server (60 Players Optimized)',
    vpsIp: VPS_IP,
    port: PORT,
    publicUrl: PUBLIC_BE_URL,
    activeRooms: rooms.size
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log('   CON ĐƯỜNG ĐỘC LẬP (1930 - 1945) - MÁY CHỦ VPS TỐC ĐỘ CAO     ');
  console.log('================================================================');
  console.log(`[ONLINE] Máy chủ đang chạy tại Cổng: ${PORT}`);
  console.log(`- Địa chỉ VPS BE: ${PUBLIC_BE_URL}`);
  console.log(`- Healthcheck:    ${PUBLIC_BE_URL}/health`);
  console.log('----------------------------------------------------------------');
  console.log('✦ Đã tối ưu hóa bộ đệm RAM chịu tải 60 người chơi cùng lúc.');
  console.log('✦ Giao diện https://conduongdoclap.vercel.app đã kết nối trực tiếp');
  console.log(`  với VPS ${PUBLIC_BE_URL} để xử lý phòng đua thời gian thực.`);
  console.log('================================================================\n');
});
