// High-Performance Socket.IO & HTTP Multiplayer Rummy Game Server

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const activeRooms = {
    '9999': {
        code: '9999',
        hostId: 'system',
        numDecks: 2,
        turnTimerSec: 60,
        entryCoins: 10,
        pot: 0,
        status: 'WAITING',
        players: [],
        registeredPlayers: [],
        currentTurnPlayerId: null,
        wildJoker: null,
        drawPile: [],
        discardPile: [],
        createdAt: new Date().toISOString(),
        isTournament: true,
        version: 1
    }
};

const DB_FILE = path.join(__dirname, 'users.json');
const VERSION_FILE = path.join(__dirname, 'version.json');

function loadUsers() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '[]');
            let modified = false;
            users.forEach(u => {
                if (typeof u.coins !== 'number') {
                    u.coins = 500;
                    modified = true;
                }
            });
            if (modified) saveUsers(users);
            return users;
        }
    } catch (e) {
        console.error('Error loading users:', e);
    }
    return [];
}

function saveUsers(users) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving users:', e);
    }
}

function getUserCoins(userId) {
    const users = loadUsers();
    const user = users.find(u => String(u.id) === String(userId));
    return user && typeof user.coins === 'number' ? user.coins : 500;
}

function getVersionInfo() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        versionCode: 1,
        versionName: "1.0.1",
        buildNumber: 1,
        updatedAt: new Date().toISOString(),
        apkUrl: "/api/download_apk",
        releaseNotes: "Latest stable version."
    };
}

function generateUniqueUserId(users) {
    let id;
    do {
        id = Math.floor(1000 + Math.random() * 9000).toString();
    } while (users.some(u => u.id === id));
    return id;
}

function generate4DigitCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (activeRooms[code]);
    return code;
}

function removePlayerFromOtherRooms(userId, currentCode) {
    Object.keys(activeRooms).forEach(code => {
        if (code === currentCode) return;
        const room = activeRooms[code];
        const initialLen = room.players.length;
        room.players = room.players.filter(p => String(p.id) !== String(userId));
        
        if (code === '9999' && room.players.length === 0) {
            room.status = 'WAITING';
            room.currentTurnPlayerId = null;
            room.wildJoker = null;
            room.drawPile = [];
            room.discardPile = [];
        }
        
        if (room.players.length !== initialLen) {
            broadcastRoomUpdate(code);
        }
    });
}

function startNewRound(roomState) {
    if (!roomState || roomState.status === 'PLAYING' || roomState.players.length < 1) return false;
    const entryCoins = roomState.entryCoins || 10;

    // Deduct entry stake from participating players and build pot
    const users = loadUsers();
    let totalPot = 0;
    const deductions = {};

    roomState.players.forEach(p => {
        const user = users.find(u => String(u.id) === String(p.id));
        if (user) {
            // If player's coins dropped below entry stake, give free refill to 500
            if (typeof user.coins !== 'number' || user.coins < entryCoins) {
                user.coins = 500;
            }
            user.coins = Math.max(0, user.coins - entryCoins);
            p.coins = user.coins;
            deductions[p.id] = entryCoins;
            totalPot += entryCoins;
        } else {
            p.coins = Math.max(0, 500 - entryCoins);
            deductions[p.id] = entryCoins;
            totalPot += entryCoins;
        }
    });
    saveUsers(users);

    roomState.pot = totalPot;
    roomState.roundDeductions = deductions;

    const fullDeck = createDeck(roomState.numDecks);
    roomState.wildJoker = fullDeck.pop();
    roomState.players.forEach(p => {
        p.handCards = fullDeck.splice(0, 13);
        p.cardsCount = p.handCards.length;
    });
    roomState.discardPile = [fullDeck.pop()];
    roomState.drawPile = fullDeck;
    roomState.status = 'PLAYING';
    roomState.lastDeclaration = null;
    roomState.roundNumber = (roomState.roundNumber || 0) + 1;

    // Rotate initial card draw turn among all players on restart and each round
    if (typeof roomState.startPlayerIndex !== 'number') {
        roomState.startPlayerIndex = 0;
    } else {
        roomState.startPlayerIndex = (roomState.startPlayerIndex + 1) % roomState.players.length;
    }
    const starter = roomState.players[roomState.startPlayerIndex] || roomState.players[0];
    roomState.currentTurnPlayerId = starter.id;
    console.log(`[Round Started] Room ${roomState.code} - Round ${roomState.roundNumber} (Entry: ${entryCoins}🪙, Pot: ${totalPot}🪙, First Turn: ${starter.name})`);
    return true;
}

function autoStartGameIfReady(roomState) {
    if (!roomState || roomState.status !== 'WAITING') return false;

    const isTour = roomState.code === '9999' || !!roomState.isTournament;
    if (isTour) {
        const registered = roomState.registeredPlayers || [];
        // Tournament requires at least 2 registered players, and ALL registered players must be joined
        if (registered.length >= 2) {
            const allJoined = registered.every(regId => 
                roomState.players.some(p => String(p.id) === String(regId))
            );
            if (allJoined && roomState.players.length >= registered.length) {
                return startNewRound(roomState);
            }
        }
        return false;
    }

    // Regular casual rooms: start if at least 2 players have joined
    if (roomState.players.length >= 2) {
        return startNewRound(roomState);
    }
    return false;
}

function createDeck(numDecks = 2) {
    let fullDeck = [];
    const suits = ['H', 'D', 'C', 'S'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    for (let d = 0; d < numDecks; d++) {
        suits.forEach(suit => {
            ranks.forEach(rank => {
                fullDeck.push({ id: `${suit}_${rank}_d${d}`, suit, rank });
            });
        });
        fullDeck.push({ id: `JOKER_1_d${d}`, suit: 'JOKER', rank: 'JOKER' });
        fullDeck.push({ id: `JOKER_2_d${d}`, suit: 'JOKER', rank: 'JOKER' });
    }

    for (let i = fullDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
    }

    return fullDeck;
}

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.apk': 'application/vnd.android.package-archive'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Direct APK Download Endpoint
    if (pathname === '/api/download_apk' || pathname === '/download/apk' || pathname === '/downloads/rummy-latest.apk' || pathname === '/downloads/rummy.apk') {
        const apkPath = path.join(__dirname, 'downloads', 'rummy-latest.apk');
        const fallbackApk = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
        const fileToServe = fs.existsSync(apkPath) ? apkPath : (fs.existsSync(fallbackApk) ? fallbackApk : null);

        if (!fileToServe) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'APK not found on server. Please build it first.' }));
            return;
        }

        const v = getVersionInfo();
        const stat = fs.statSync(fileToServe);
        res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="Rummy-v${v.versionName}-b${v.buildNumber}.apk"`
        });
        const readStream = fs.createReadStream(fileToServe);
        readStream.pipe(res);
        return;
    }

    // Version Check Endpoint
    if (pathname === '/api/version_check') {
        const versionData = getVersionInfo();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...versionData }));
        return;
    }

    // REST API Routes
    if (pathname.startsWith('/api/')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            let data = {};
            try { data = JSON.parse(body || '{}'); } catch(e) {}

            if (pathname === '/api/register') {
                const { username, password, gender } = data;
                if (!username || !password || !gender) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'All fields are required.' }));
                    return;
                }

                const users = loadUsers();
                const cleanUsername = username.trim();
                const duplicate = users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
                if (duplicate) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Username already taken.' }));
                    return;
                }

                const uniqueId = generateUniqueUserId(users);
                const seed = encodeURIComponent(cleanUsername);
                const photoUrl = gender.toLowerCase() === 'female' 
                    ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&gender=female`
                    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&gender=male`;

                const newUser = {
                    id: uniqueId,
                    username: cleanUsername,
                    password: password,
                    gender: gender,
                    photoUrl: photoUrl,
                    wins: 0,
                    losses: 0,
                    coins: 500
                };

                users.push(newUser);
                saveUsers(users);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    user: {
                        id: uniqueId,
                        name: cleanUsername,
                        gender: gender,
                        photoUrl: photoUrl,
                        coins: 500
                    }
                }));
                console.log(`[User Registered] Name: ${cleanUsername}#${uniqueId}`);
                return;
            }

            if (pathname === '/api/login') {
                const { username, password } = data;
                if (!username || !password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Username and password are required.' }));
                    return;
                }

                const users = loadUsers();
                const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
                if (!user || user.password !== password) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid username or password.' }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    user: {
                        id: user.id,
                        name: user.username,
                        gender: user.gender,
                        photoUrl: user.photoUrl,
                        coins: typeof user.coins === 'number' ? user.coins : 500
                    }
                }));
                console.log(`[User Logged In] Name: ${user.username}#${user.id}`);
                return;
            }

            if (pathname === '/api/get_profile') {
                const { userId } = data;
                const users = loadUsers();
                const user = users.find(u => String(u.id) === String(userId));
                if (!user) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'User not found.' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    user: {
                        id: user.id,
                        name: user.username,
                        gender: user.gender,
                        photoUrl: user.photoUrl,
                        coins: typeof user.coins === 'number' ? user.coins : 500,
                        wins: user.wins || 0,
                        losses: user.losses || 0
                    }
                }));
                return;
            }

            if (pathname === '/api/claim_bonus') {
                const { userId } = data;
                const users = loadUsers();
                const user = users.find(u => String(u.id) === String(userId));
                if (!user) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'User not found.' }));
                    return;
                }
                user.coins = (user.coins || 0) + 100;
                saveUsers(users);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, coins: user.coins }));
                return;
            }

            if (pathname === '/api/update_settings') {
                const { userId, username, password, gender, photoUrl } = data;
                if (!userId || !username || !password || !gender) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'All fields are required.' }));
                    return;
                }

                const users = loadUsers();
                const user = users.find(u => u.id === userId.toString());
                if (!user) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'User not found.' }));
                    return;
                }

                const cleanUsername = username.trim();
                const duplicate = users.some(u => u.id !== userId.toString() && u.username.toLowerCase() === cleanUsername.toLowerCase());
                if (duplicate) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Username already taken by another user.' }));
                    return;
                }

                user.username = cleanUsername;
                user.password = password;
                user.gender = gender;
                if (photoUrl && typeof photoUrl === 'string' && photoUrl.trim()) {
                    user.photoUrl = photoUrl.trim();
                } else {
                    const seed = encodeURIComponent(cleanUsername);
                    user.photoUrl = gender.toLowerCase() === 'female' 
                        ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&gender=female`
                        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&gender=male`;
                }

                saveUsers(users);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    user: {
                        id: user.id,
                        name: user.username,
                        gender: user.gender,
                        photoUrl: user.photoUrl,
                        coins: typeof user.coins === 'number' ? user.coins : 500
                    }
                }));
                console.log(`[Settings Updated] User: ${user.username}#${user.id}`);
                return;
            }

            if (pathname === '/api/list_rooms') {
                const availableRooms = Object.values(activeRooms).map(r => ({
                    code: r.code,
                    hostName: (r.players[0] ? r.players[0].name : 'System Host'),
                    playersCount: r.players.length,
                    registeredPlayers: r.registeredPlayers || [],
                    numDecks: r.numDecks,
                    turnTimerSec: r.turnTimerSec,
                    entryCoins: r.entryCoins || 10,
                    pot: r.pot || 0,
                    maxPlayers: 6,
                    status: r.status,
                    isTournament: !!r.isTournament
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, rooms: availableRooms }));
                return;
            }

            if (pathname === '/api/list_player_stats') {
                const users = loadUsers();
                const stats = users.map(u => ({
                    id: u.id,
                    username: u.username,
                    gender: u.gender,
                    photoUrl: u.photoUrl,
                    wins: u.wins || 0,
                    losses: u.losses || 0,
                    coins: typeof u.coins === 'number' ? u.coins : 500
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, stats }));
                return;
            }

            // Fallback endpoints for REST compatibility
            if (pathname === '/api/create_room') {
                const { user, config } = data;
                const roomCode = generate4DigitCode();
                removePlayerFromOtherRooms(user.id, roomCode);
                const entryCoins = [10, 20, 50, 100].includes(Number(config.entryCoins)) ? Number(config.entryCoins) : 10;
                const userCoins = getUserCoins(user.id);
                const roomState = {
                    code: roomCode,
                    hostId: user.id,
                    numDecks: parseInt(config.numDecks || 2, 10),
                    turnTimerSec: parseInt(config.turnTimerSec || 30, 10),
                    entryCoins: entryCoins,
                    pot: 0,
                    roundDeductions: {},
                    status: 'WAITING',
                    players: [{ id: user.id, name: user.name, photoUrl: user.photoUrl, coins: userCoins, online: true, score: 0, handCards: [], cardsCount: 0 }],
                    currentTurnPlayerId: user.id,
                    wildJoker: null,
                    drawPile: [],
                    discardPile: [],
                    createdAt: new Date().toISOString(),
                    version: 1
                };
                activeRooms[roomCode] = roomState;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(roomState));
                broadcastRoomUpdate(roomCode);
                return;
            }

            if (pathname === '/api/register_tournament') {
                const { userId } = data;
                const room = activeRooms['9999'];
                if (room) {
                    if (!room.registeredPlayers) room.registeredPlayers = [];
                    const uidStr = String(userId);
                    if (!room.registeredPlayers.some(id => String(id) === uidStr)) {
                        room.registeredPlayers.push(uidStr);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, roomState: room }));
                    broadcastRoomUpdate('9999');
                    io.emit('room_list_update');
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }

            if (pathname === '/api/unregister_tournament') {
                const { userId } = data;
                const room = activeRooms['9999'];
                if (room) {
                    if (!room.registeredPlayers) room.registeredPlayers = [];
                    const uidStr = String(userId);
                    room.registeredPlayers = room.registeredPlayers.filter(id => String(id) !== uidStr);
                    room.players = room.players.filter(p => String(p.id) !== uidStr);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, roomState: room }));
                    broadcastRoomUpdate('9999');
                    io.emit('room_list_update');
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }

            if (pathname === '/api/join_room') {
                const { roomCode, user } = data;
                const code = (roomCode || '').toString().trim();
                const roomState = activeRooms[code];
                if (!roomState) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: `Room [${code}] not found.` }));
                    return;
                }

                if (code === '9999' || roomState.isTournament) {
                    if (!roomState.registeredPlayers || !roomState.registeredPlayers.some(id => String(id) === String(user.id))) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Please register for the tournament first.' }));
                        return;
                    }
                }

                removePlayerFromOtherRooms(user.id, code);

                let player = roomState.players.find(p => String(p.id) === String(user.id));
                if (!player) {
                    player = { id: user.id, name: user.name, photoUrl: user.photoUrl, online: true, score: 0, handCards: [], cardsCount: 0 };
                    roomState.players.push(player);
                } else {
                    player.online = true;
                }
                autoStartGameIfReady(roomState);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(roomState));
                broadcastRoomUpdate(code);
                io.emit('room_list_update');
                return;
            }

            if (pathname === '/api/start_game') {
                const { roomCode } = data;
                const code = (roomCode || '').toString().trim();
                const roomState = activeRooms[code];
                if (roomState) {
                    if (roomState.code === '9999' || roomState.isTournament) {
                        const registered = roomState.registeredPlayers || [];
                        const allJoined = registered.length >= 2 && registered.every(regId => roomState.players.some(p => String(p.id) === String(regId)));
                        if (!allJoined) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Tournament will automatically start once all registered players join.' }));
                            return;
                        }
                    }
                    if (roomState.players.length >= 1) {
                        startNewRound(roomState);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(roomState));
                        broadcastRoomUpdate(code);
                        return;
                    }
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Cannot start game' }));
                return;
            }

            if (pathname === '/api/draw_card') {
                const { roomCode, userId, fromDiscard } = data;
                const code = (roomCode || '').toString().trim();
                const roomState = activeRooms[code];
                if (roomState && String(roomState.currentTurnPlayerId) === String(userId)) {
                    const player = roomState.players.find(p => String(p.id) === String(userId));
                    if (player && player.handCards.length < 14) {
                        const isFromDiscard = Boolean(fromDiscard === true || fromDiscard === 'true');
                        let drawnCard = isFromDiscard ? roomState.discardPile.pop() : roomState.drawPile.pop();
                        if (!drawnCard && !isFromDiscard && roomState.discardPile.length > 1) {
                            const topDiscard = roomState.discardPile.pop();
                            roomState.drawPile = roomState.discardPile;
                            roomState.discardPile = [topDiscard];
                            drawnCard = roomState.drawPile.pop();
                        }
                        if (drawnCard) {
                            player.handCards.push(drawnCard);
                            player.cardsCount = player.handCards.length;
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(roomState));
                    broadcastRoomUpdate(code);
                    return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Not your turn or room not active" }));
                return;
            }

            if (pathname === '/api/discard_card') {
                const { roomCode, userId, cardIndex } = data;
                const code = (roomCode || '').toString().trim();
                const roomState = activeRooms[code];
                if (roomState && String(roomState.currentTurnPlayerId) === String(userId)) {
                    const player = roomState.players.find(p => String(p.id) === String(userId));
                    if (player && player.handCards.length >= 14) {
                        const discarded = player.handCards.splice(cardIndex, 1)[0];
                        if (discarded) {
                            player.cardsCount = player.handCards.length;
                            roomState.discardPile.push(discarded);
                            const currentIdx = roomState.players.findIndex(p => String(p.id) === String(userId));
                            const nextIdx = (currentIdx + 1) % roomState.players.length;
                            roomState.currentTurnPlayerId = roomState.players[nextIdx].id;
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(roomState));
                    broadcastRoomUpdate(code);
                    return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Cannot discard" }));
                return;
            }

            if (pathname === '/api/delete_room') {
                const { roomCode, hostId } = data;
                const code = (roomCode || '').toString().trim();
                const roomState = activeRooms[code];
                if (roomState && (String(roomState.hostId) === String(hostId) || code !== '9999')) {
                    delete activeRooms[code];
                    io.to(code).emit('room_deleted', { roomCode: code, message: 'Room has been deleted by the host.' });
                    io.emit('room_deleted', { roomCode: code, message: 'Room has been deleted by the host.' });
                    io.emit('room_list_update');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                    console.log(`[Room Deleted via REST] Room ${code} deleted by host ${hostId}`);
                    return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Only host can delete this room.' }));
                return;
            }

            if (pathname === '/api/poll_room') {
                const code = url.searchParams.get('code');
                const roomState = activeRooms[code];
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(roomState || {}));
                return;
            }
        });
        return;
    }

    // Static File Server (Checks www/ folder first for Vite build output)
    let relativePath = pathname === '/' ? 'index.html' : pathname;
    let filePath = path.join(__dirname, 'www', relativePath);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, relativePath);
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/html';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end(`File not found: ${pathname}`);
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    });
});

// Initialize Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 10000,
    pingInterval: 5000
});

function broadcastRoomUpdate(code) {
    const roomState = activeRooms[code];
    if (!roomState) return;

    roomState.version = (roomState.version || 0) + 1;
    roomState.lastUpdated = Date.now();

    // Instant real-time push to all devices in room channel AND broadcast fallback
    io.to(code).emit('room_update', roomState);
    io.emit('room_update', roomState);
}

io.on('connection', (socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    socket.on('join_room_channel', ({ roomCode }) => {
        if (roomCode) {
            socket.join(roomCode);
            const roomState = activeRooms[roomCode];
            if (roomState) {
                socket.emit('room_update', roomState);
            }
        }
    });

    socket.on('create_room', ({ user, config }, callback) => {
        const roomCode = generate4DigitCode();
        removePlayerFromOtherRooms(user.id, roomCode);
        const entryCoins = [10, 20, 50, 100].includes(Number(config.entryCoins)) ? Number(config.entryCoins) : 10;
        const userCoins = getUserCoins(user.id);
        const roomState = {
            code: roomCode,
            hostId: user.id,
            numDecks: parseInt(config.numDecks || 2, 10),
            turnTimerSec: parseInt(config.turnTimerSec || 30, 10),
            entryCoins: entryCoins,
            pot: 0,
            roundDeductions: {},
            status: 'WAITING',
            players: [{ id: user.id, name: user.name, photoUrl: user.photoUrl, coins: userCoins, online: true, score: 0, handCards: [], cardsCount: 0 }],
            currentTurnPlayerId: user.id,
            wildJoker: null,
            drawPile: [],
            discardPile: [],
            createdAt: new Date().toISOString(),
            version: 1
        };
        activeRooms[roomCode] = roomState;
        socket.join(roomCode);
        if (callback) callback({ success: true, roomState });
        broadcastRoomUpdate(roomCode);
        io.emit('room_list_update');
        console.log(`[Room Created via Socket] Code: ${roomCode} (Entry: ${entryCoins}🪙)`);
    });

    socket.on('register_tournament', ({ userId }, callback) => {
        const room = activeRooms['9999'];
        if (room) {
            if (!room.registeredPlayers) room.registeredPlayers = [];
            const uidStr = String(userId);
            if (!room.registeredPlayers.some(id => String(id) === uidStr)) {
                room.registeredPlayers.push(uidStr);
            }
            if (callback) callback({ success: true, roomState: room });
            broadcastRoomUpdate('9999');
            io.emit('room_list_update');
            console.log(`[Tournament Registered via Socket] User: ${userId}`);
        } else if (callback) {
            callback({ success: false });
        }
    });

    socket.on('unregister_tournament', ({ userId }, callback) => {
        const room = activeRooms['9999'];
        if (room) {
            if (!room.registeredPlayers) room.registeredPlayers = [];
            const uidStr = String(userId);
            room.registeredPlayers = room.registeredPlayers.filter(id => String(id) !== uidStr);
            room.players = room.players.filter(p => String(p.id) !== uidStr);
            if (callback) callback({ success: true, roomState: room });
            broadcastRoomUpdate('9999');
            io.emit('room_list_update');
            console.log(`[Tournament Unregistered via Socket] User: ${userId}`);
        } else if (callback) {
            callback({ success: false });
        }
    });

    socket.on('join_room', ({ roomCode, user }, callback) => {
        const code = (roomCode || '').toString().trim();
        const roomState = activeRooms[code];
        if (!roomState) {
            if (callback) callback({ success: false, message: `Room [${code}] not found.` });
            return;
        }

        if (code === '9999' || roomState.isTournament) {
            if (!roomState.registeredPlayers || !roomState.registeredPlayers.some(id => String(id) === String(user.id))) {
                if (callback) callback({ success: false, message: 'Please register for the tournament first.' });
                return;
            }
        }

        removePlayerFromOtherRooms(user.id, code);

        const userCoins = getUserCoins(user.id);
        let player = roomState.players.find(p => String(p.id) === String(user.id));
        if (!player) {
            player = { id: user.id, name: user.name, photoUrl: user.photoUrl, coins: userCoins, online: true, score: 0, handCards: [], cardsCount: 0 };
            roomState.players.push(player);
        } else {
            player.online = true;
            player.coins = userCoins;
        }

        autoStartGameIfReady(roomState);

        socket.join(code);
        if (callback) callback({ success: true, roomState });
        broadcastRoomUpdate(code);
        io.emit('room_list_update');
        console.log(`[Player Joined via Socket] ${user.name} -> Room ${code} (Status: ${roomState.status})`);
    });

    socket.on('delete_room', ({ roomCode, hostId }, callback) => {
        const code = (roomCode || '').toString().trim();
        const roomState = activeRooms[code];
        if (roomState && (String(roomState.hostId) === String(hostId) || code !== '9999')) {
            delete activeRooms[code];
            io.to(code).emit('room_deleted', { roomCode: code, message: 'Room has been deleted by the host.' });
            io.emit('room_deleted', { roomCode: code, message: 'Room has been deleted by the host.' });
            io.emit('room_list_update');
            if (callback) callback({ success: true });
            console.log(`[Room Deleted by Host] Room ${code} deleted by host ${hostId}`);
        } else if (callback) {
            callback({ success: false, message: 'Only the host can delete this room.' });
        }
    });

    socket.on('leave_room', ({ roomCode, userId }) => {
        const code = (roomCode || '').toString().trim();
        const roomState = activeRooms[code];
        if (roomState) {
            const leavingPlayer = roomState.players.find(p => String(p.id) === String(userId));
            const isLiveGame = roomState.status === 'PLAYING';
            roomState.players = roomState.players.filter(p => String(p.id) !== String(userId));

            if (isLiveGame && leavingPlayer) {
                console.log(`[Live Game Forfeit] User ${userId} left live room ${code}`);
                if (roomState.players.length === 1) {
                    // Remaining player wins the pot automatically
                    const winner = roomState.players[0];
                    const potAwarded = roomState.pot || (roomState.entryCoins * 2);

                    const users = loadUsers();
                    const winUser = users.find(u => String(u.id) === String(winner.id));
                    if (winUser) {
                        winUser.wins = (winUser.wins || 0) + 1;
                        winUser.coins = (winUser.coins || 0) + potAwarded;
                        winner.coins = winUser.coins;
                    }
                    const forfeitUser = users.find(u => String(u.id) === String(userId));
                    if (forfeitUser) {
                        forfeitUser.losses = (forfeitUser.losses || 0) + 1;
                    }
                    saveUsers(users);

                    roomState.status = 'ROUND_OVER';
                    roomState.lastDeclaration = {
                        declarerId: userId,
                        declarerName: leavingPlayer.name,
                        winnerId: winner.id,
                        winnerName: winner.name,
                        valid: true,
                        isAllTriplets: false,
                        reason: `${leavingPlayer.name} returned to lobby. ${winner.name} wins the pot by forfeit!`,
                        scores: [{ id: winner.id, name: winner.name, isWinner: true, coinsChange: potAwarded - (roomState.entryCoins || 10), coins: winner.coins }],
                        allPlayers: [{ id: winner.id, name: winner.name, photoUrl: winner.photoUrl, isWinner: true, coinsChange: potAwarded - (roomState.entryCoins || 10), coins: winner.coins, handCards: winner.handCards || [], groups: [winner.handCards || []] }],
                        pot: potAwarded,
                        entryCoins: roomState.entryCoins || 10,
                        timestamp: Date.now()
                    };
                    broadcastRoomUpdate(code);
                    io.to(code).emit('game_declared', roomState.lastDeclaration);
                }
            }

            if (roomState.players.length === 0) {
                if (code !== '9999') {
                    delete activeRooms[code];
                } else {
                    roomState.status = 'WAITING';
                    roomState.currentTurnPlayerId = null;
                    roomState.wildJoker = null;
                    roomState.drawPile = [];
                    roomState.discardPile = [];
                    roomState.pot = 0;
                }
            } else {
                broadcastRoomUpdate(code);
            }
            io.emit('room_list_update');
            console.log(`[Player Left Room] User ${userId} <- Room ${code}`);
        }
        socket.leave(code);
    });

    socket.on('start_game', ({ roomCode }, callback) => {
        const roomState = activeRooms[roomCode];
        if (roomState) {
            if (roomState.status === 'PLAYING') {
                if (callback) callback({ success: true, roomState });
                return;
            }
            if (roomState.code === '9999' || roomState.isTournament) {
                const registered = roomState.registeredPlayers || [];
                const allJoined = registered.length >= 2 && registered.every(regId => roomState.players.some(p => String(p.id) === String(regId)));
                if (!allJoined) {
                    if (callback) callback({ success: false, message: 'Tournament will automatically start once all registered players join.' });
                    return;
                }
            }
            if (roomState.players.length >= 1) {
                const started = startNewRound(roomState);
                if (started) {
                    if (callback) callback({ success: true, roomState });
                    broadcastRoomUpdate(roomCode);
                } else if (callback) {
                    callback({ success: true, roomState });
                }
            }
        }
    });

    socket.on('draw_card', ({ roomCode, userId, fromDiscard }, callback) => {
        const roomState = activeRooms[roomCode];
        if (roomState && String(roomState.currentTurnPlayerId) === String(userId)) {
            const player = roomState.players.find(p => String(p.id) === String(userId));
            if (player && player.handCards.length < 14) {
                let drawnCard = fromDiscard ? roomState.discardPile.pop() : roomState.drawPile.pop();
                // If draw pile ran out, recycle discard pile (except top card)
                if (!drawnCard && !fromDiscard && roomState.discardPile.length > 1) {
                    const topDiscard = roomState.discardPile.pop();
                    roomState.drawPile = roomState.discardPile;
                    roomState.discardPile = [topDiscard];
                    drawnCard = roomState.drawPile.pop();
                }
                if (drawnCard) {
                    player.handCards.push(drawnCard);
                    player.cardsCount = player.handCards.length;
                }
            }
            if (callback) callback({ success: true, roomState });
            broadcastRoomUpdate(roomCode);
        }
    });

    socket.on('discard_card', ({ roomCode, userId, cardIndex }, callback) => {
        const roomState = activeRooms[roomCode];
        if (roomState && String(roomState.currentTurnPlayerId) === String(userId)) {
            const player = roomState.players.find(p => String(p.id) === String(userId));
            if (player && player.handCards.length >= 14) {
                const discarded = player.handCards.splice(cardIndex, 1)[0];
                if (discarded) {
                    player.cardsCount = player.handCards.length;
                    roomState.discardPile.push(discarded);
                    const currentIdx = roomState.players.findIndex(p => String(p.id) === String(userId));
                    const nextIdx = (currentIdx + 1) % roomState.players.length;
                    roomState.currentTurnPlayerId = roomState.players[nextIdx].id;
                }
            }
            if (callback) callback({ success: true, roomState });
            broadcastRoomUpdate(roomCode);
        }
    });

    socket.on('declare_game', ({ roomCode, userId, declaration }, callback) => {
        const roomState = activeRooms[roomCode];
        if (roomState && roomState.status === 'PLAYING') {
            const declarer = roomState.players.find(p => String(p.id) === String(userId));
            const playerName = declarer ? declarer.name : 'Player';

            const isValid = declaration && declaration.valid === true;
            let winnerId = isValid ? userId : null;
            let winnerName = isValid ? playerName : 'Opponent';

            if (isValid) {
                // If declarer provided a discard card, move it to the discard pile and update declarer's hand
                if (declaration && declaration.discardCard && declarer) {
                    roomState.discardPile.push(declaration.discardCard);
                    declarer.handCards = (declarer.handCards || []).filter(c => c.id !== declaration.discardCard.id);
                    declarer.cardsCount = declarer.handCards.length;
                }
                if (declaration && declaration.groups && declarer) {
                    const discardId = declaration.discardCard ? declaration.discardCard.id : null;
                    declarer.cardGroups = declaration.groups.map(g => 
                        g.filter(c => !discardId || c.id !== discardId)
                    ).filter(g => g.length > 0);
                }
            } else {
                const otherPlayer = roomState.players.find(p => String(p.id) !== String(userId));
                if (otherPlayer) {
                    winnerId = otherPlayer.id;
                    winnerName = otherPlayer.name;
                } else {
                    winnerId = userId;
                    winnerName = playerName;
                }
            }

            const entryCoins = roomState.entryCoins || 10;
            const isAllTriplets = Boolean(declaration && declaration.isAllTriplets === true);
            const winPoints = isAllTriplets ? 160 : 80;
            const winsEarned = 1; // Standard 1 win for all victories, including All Triplets!

            // Calculate Coin Settlements & Double Coins for All Triplets
            let coinsChangeMap = {};
            let potAwarded = roomState.pot || (roomState.players.length * entryCoins);

            const users = loadUsers();
            if (!isValid) {
                // INVALID / WRONG DECLARATION:
                // Declarer loses their coins in this game, and the pot is EQUALLY DISTRIBUTED to all other players!
                const otherPlayers = roomState.players.filter(p => String(p.id) !== String(userId));
                const otherCount = otherPlayers.length > 0 ? otherPlayers.length : 1;
                const sharePerOtherPlayer = Math.floor(potAwarded / otherCount);

                otherPlayers.forEach(p => {
                    const user = users.find(u => String(u.id) === String(p.id));
                    if (user) {
                        user.coins = (user.coins || 0) + sharePerOtherPlayer;
                        user.wins = (user.wins || 0) + 1;
                    }
                    p.coins = user ? user.coins : ((p.coins || 500) + sharePerOtherPlayer);
                    coinsChangeMap[p.id] = +(sharePerOtherPlayer - entryCoins);
                });

                // Declarer loses stake and gets 1 loss
                const declUser = users.find(u => String(u.id) === String(userId));
                if (declUser) {
                    declUser.losses = (declUser.losses || 0) + 1;
                }
                coinsChangeMap[userId] = -entryCoins;
                saveUsers(users);
            } else if (isAllTriplets) {
                // SPECIAL RULE: All Triplets winner gets DOUBLE COINS from all other players!
                // Losers pay 2x entry coins total. Since they already paid 1x in pot, they pay an extra 1x entry coins.
                const extraCoinsPerOpponent = entryCoins;
                let extraCoinsTotal = 0;

                roomState.players.forEach(p => {
                    if (String(p.id) !== String(winnerId)) {
                        const user = users.find(u => String(u.id) === String(p.id));
                        const currentBalance = user ? (user.coins || 0) : (p.coins || 0);
                        const actualExtraDeduct = Math.min(currentBalance, extraCoinsPerOpponent);
                        if (user) {
                            user.coins = Math.max(0, currentBalance - actualExtraDeduct);
                            user.losses = (user.losses || 0) + 1;
                        }
                        p.coins = user ? user.coins : Math.max(0, currentBalance - actualExtraDeduct);
                        coinsChangeMap[p.id] = -(entryCoins + actualExtraDeduct);
                        extraCoinsTotal += actualExtraDeduct;
                    }
                });

                // Award pot + extra double-coins to winner
                const winnerUser = users.find(u => String(u.id) === String(winnerId));
                const winnerNetGain = (potAwarded - entryCoins) + extraCoinsTotal;
                if (winnerUser) {
                    winnerUser.coins = (winnerUser.coins || 0) + potAwarded + extraCoinsTotal;
                    winnerUser.wins = (winnerUser.wins || 0) + 1;
                    const winnerPlayer = roomState.players.find(p => String(p.id) === String(winnerId));
                    if (winnerPlayer) winnerPlayer.coins = winnerUser.coins;
                }
                coinsChangeMap[winnerId] = +winnerNetGain;
                potAwarded += extraCoinsTotal;
                saveUsers(users);
            } else {
                // Standard Valid Win: Winner receives the full pot
                const winnerUser = users.find(u => String(u.id) === String(winnerId));
                if (winnerUser) {
                    winnerUser.coins = (winnerUser.coins || 0) + potAwarded;
                    winnerUser.wins = (winnerUser.wins || 0) + 1;
                    const winnerPlayer = roomState.players.find(p => String(p.id) === String(winnerId));
                    if (winnerPlayer) winnerPlayer.coins = winnerUser.coins;
                }

                roomState.players.forEach(p => {
                    if (String(p.id) === String(winnerId)) {
                        coinsChangeMap[p.id] = +(potAwarded - entryCoins);
                    } else {
                        const user = users.find(u => String(u.id) === String(p.id));
                        if (user) {
                            user.losses = (user.losses || 0) + 1;
                            p.coins = user.coins;
                        }
                        coinsChangeMap[p.id] = -entryCoins;
                    }
                });
                saveUsers(users);
            }

            // Sync all roomState player coins with users database
            roomState.players.forEach(p => {
                const user = users.find(u => String(u.id) === String(p.id));
                if (user && typeof user.coins === 'number') {
                    p.coins = user.coins;
                }
            });

            const scores = roomState.players.map(p => {
                const isWin = String(p.id) === String(winnerId);
                return {
                    id: p.id,
                    name: p.name,
                    isWinner: isWin,
                    coinsChange: coinsChangeMap[p.id] || 0,
                    coins: p.coins || 500
                };
            });

            // Capture everyone's cards and groups for the declaration display
            const discardId = (declaration && declaration.discardCard) ? declaration.discardCard.id : null;
            const allPlayers = roomState.players.map(p => {
                const isWin = String(p.id) === String(winnerId);
                const isDecl = String(p.id) === String(userId);
                let groups = [];
                if (isDecl && declaration && declaration.groups && declaration.groups.length > 0) {
                    groups = declaration.groups.map(g => 
                        g.filter(c => !discardId || c.id !== discardId)
                    ).filter(g => g.length > 0);
                } else if (p.cardGroups && Array.isArray(p.cardGroups) && p.cardGroups.length > 0) {
                    groups = p.cardGroups.map(g => 
                        g.filter(c => !isDecl || !discardId || c.id !== discardId)
                    ).filter(g => g.length > 0);
                } else if (p.handCards && p.handCards.length > 0) {
                    const filteredCards = p.handCards.filter(c => !isDecl || !discardId || c.id !== discardId);
                    groups = [ filteredCards ];
                }
                return {
                    id: p.id,
                    name: p.name,
                    photoUrl: p.photoUrl,
                    isWinner: isWin,
                    isDeclarer: isDecl,
                    coinsChange: coinsChangeMap[p.id] || 0,
                    coins: p.coins || 500,
                    handCards: p.handCards || [],
                    groups: groups
                };
            });

            roomState.status = 'ROUND_OVER';
            roomState.lastDeclaration = {
                declarerId: userId,
                declarerName: playerName,
                winnerId: winnerId,
                winnerName: winnerName,
                valid: isValid,
                isAllTriplets: isAllTriplets,
                reason: declaration ? declaration.reason : (isValid ? (isAllTriplets ? 'Special Hand: All Triplets (1 Win & Double Coins!)' : 'Valid sequence & set combinations formed.') : 'Invalid declaration.'),
                scores: scores,
                allPlayers: allPlayers,
                pot: potAwarded,
                entryCoins: entryCoins,
                groups: (declaration && declaration.groups) ? declaration.groups : [],
                discardCard: (declaration && declaration.discardCard) ? declaration.discardCard : null,
                isTournament: roomState.code === '9999' || !!roomState.isTournament,
                timestamp: Date.now()
            };

            // Broadcast IMMEDIATELY to all room devices so results display with zero delay
            if (callback) callback({ success: true, roomState });
            broadcastRoomUpdate(roomCode);
            io.to(roomCode).emit('game_declared', roomState.lastDeclaration);
            console.log(`[Game Declared via Socket] Room ${roomCode}: Declarer=${playerName}, Winner=${winnerName}, Valid=${isValid}, AllTriplets=${isAllTriplets}, Pot=${potAwarded}🪙`);
        }
    });

    socket.on('sync_hand_groups', ({ roomCode, userId, groups }) => {
        const code = (roomCode || '').toString().trim();
        const roomState = activeRooms[code];
        if (roomState && roomState.players && Array.isArray(groups)) {
            const player = roomState.players.find(p => String(p.id) === String(userId));
            if (player) {
                player.cardGroups = groups;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket Disconnected] ID: ${socket.id}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 SOCKET.IO RUMMY SERVER RUNNING ON PORT ${PORT}`);
    console.log(`   Local Access: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
