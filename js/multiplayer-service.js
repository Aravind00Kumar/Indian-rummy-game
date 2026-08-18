// Ultra-Low-Latency Real-Time Socket.IO Multiplayer Service

const MULTIPLAYER_SERVICE = (function() {
    let currentRoomCode = null;
    let roomUpdateCallbacks = [];
    let gameDeclaredCallbacks = [];
    let socket = null;

    function getServerUrl() {
        const isNative = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
        const saved = localStorage.getItem('rummy_server_url');
        if (saved && saved.trim()) {
            const cleanSaved = saved.trim().replace(/\/$/, '');
            // On native Android app, prevent localhost/127.0.0.1 since server runs on LAN host
            if (!isNative || (!cleanSaved.includes('localhost') && !cleanSaved.includes('127.0.0.1'))) {
                return cleanSaved;
            }
        }
        if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) {
            return window.APP_CONFIG.SERVER_URL.replace(/\/$/, '');
        }
        if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.protocol.startsWith('http')) {
            return window.location.origin;
        }
        return 'http://192.168.29.56:3000';
    }

    function initSocket() {
        if (socket && socket.connected) return socket;
        if (typeof io === 'undefined') {
            console.warn('Socket.IO client library not loaded yet.');
            return null;
        }

        const serverUrl = getServerUrl();
        try {
            socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 500,
                reconnectionDelayMax: 2000,
                timeout: 8000
            });

            socket.on('connect', () => {
                console.log('⚡ [Socket.IO Connected] ID:', socket.id, 'at', serverUrl);
                if (currentRoomCode) {
                    socket.emit('join_room_channel', { roomCode: currentRoomCode });
                }
            });

            socket.on('room_update', (roomState) => {
                if (roomState && roomState.code) {
                    notifyRoomUpdate(roomState);
                }
            });

            socket.on('game_declared', (declaration) => {
                notifyGameDeclared(declaration);
            });

            socket.on('room_deleted', (data) => {
                notifyRoomDeleted(data);
            });

            socket.on('room_list_update', () => {
                notifyRoomListUpdate();
            });

            socket.on('disconnect', (reason) => {
                console.warn('⚠️ [Socket.IO Disconnected]:', reason);
            });

            socket.on('connect_error', (err) => {
                console.error('❌ [Socket.IO Connect Error]:', err);
            });
        } catch(e) {
            console.error('Socket initialization failed:', e);
        }

        return socket;
    }

    async function apiRequest(endpoint, bodyData = {}) {
        const serverUrl = getServerUrl();
        try {
            const response = await fetch(`${serverUrl}/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            if (!response.ok) {
                const err = await response.json();
                alert(err.message || 'Error communicating with game server.');
                return null;
            }
            return await response.json();
        } catch(e) {
            console.error('API Request failed:', e);
            return null;
        }
    }

    function createRoom(hostUser, config = {}) {
        return new Promise(async (resolve) => {
            const s = initSocket();
            if (s && s.connected) {
                s.emit('create_room', { user: hostUser, config }, (res) => {
                    if (res && res.success) {
                        currentRoomCode = res.roomState.code;
                        notifyRoomUpdate(res.roomState);
                        resolve(res.roomState);
                    } else {
                        resolve(null);
                    }
                });
            } else {
                const roomState = await apiRequest('create_room', { user: hostUser, config });
                if (roomState) {
                    currentRoomCode = roomState.code;
                    notifyRoomUpdate(roomState);
                    if (s) s.emit('join_room_channel', { roomCode: roomState.code });
                }
                resolve(roomState);
            }
        });
    }

    function joinRoom(roomCode, user) {
        return new Promise(async (resolve) => {
            const cleanCode = (roomCode || '').toString().trim();
            const s = initSocket();
            if (s && s.connected) {
                s.emit('join_room', { roomCode: cleanCode, user }, (res) => {
                    if (res && res.success) {
                        currentRoomCode = res.roomState.code;
                        notifyRoomUpdate(res.roomState);
                        resolve({ success: true, roomState: res.roomState });
                    } else {
                        alert(res.message || `Room [${cleanCode}] not found.`);
                        resolve({ success: false });
                    }
                });
            } else {
                const roomState = await apiRequest('join_room', { roomCode: cleanCode, user });
                if (roomState) {
                    currentRoomCode = roomState.code;
                    notifyRoomUpdate(roomState);
                    if (s) s.emit('join_room_channel', { roomCode: roomState.code });
                    resolve({ success: true, roomState });
                } else {
                    resolve({ success: false });
                }
            }
        });
    }

    function startNewGame(roomCode) {
        return new Promise(async (resolve) => {
            const s = initSocket();
            if (s && s.connected) {
                s.emit('start_game', { roomCode }, (res) => {
                    if (res && res.success) {
                        notifyRoomUpdate(res.roomState);
                        resolve(res.roomState);
                    } else {
                        resolve(null);
                    }
                });
            } else {
                const roomState = await apiRequest('start_game', { roomCode });
                if (roomState) notifyRoomUpdate(roomState);
                resolve(roomState);
            }
        });
    }

    function drawCard(roomCode, userId, fromDiscard) {
        const s = initSocket();
        if (s && s.connected) {
            s.emit('draw_card', { roomCode, userId, fromDiscard }, (res) => {
                if (res && res.success) {
                    notifyRoomUpdate(res.roomState);
                }
            });
        } else {
            apiRequest('draw_card', { roomCode, userId, fromDiscard }).then(res => {
                if (res) notifyRoomUpdate(res);
            });
        }
    }

    function discardCard(roomCode, userId, cardIndex) {
        const s = initSocket();
        if (s && s.connected) {
            s.emit('discard_card', { roomCode, userId, cardIndex }, (res) => {
                if (res && res.success) {
                    notifyRoomUpdate(res.roomState);
                }
            });
        } else {
            apiRequest('discard_card', { roomCode, userId, cardIndex }).then(res => {
                if (res) notifyRoomUpdate(res);
            });
        }
    }

    function declareGame(roomCode, userId, declaration) {
        return new Promise(async (resolve) => {
            const s = initSocket();
            if (s && s.connected) {
                s.emit('declare_game', { roomCode, userId, declaration }, (res) => {
                    if (res && res.success) {
                        notifyRoomUpdate(res.roomState);
                        resolve(res.roomState);
                    } else {
                        resolve(null);
                    }
                });
            } else {
                const roomState = await apiRequest('declare_game', { roomCode, userId, declaration });
                if (roomState) notifyRoomUpdate(roomState);
                resolve(roomState);
            }
        });
    }

    function registerTournamentPlayer(userId) {
        return new Promise(async (resolve) => {
            const s = initSocket();
            if (s && s.connected) {
                s.emit('register_tournament', { userId }, (res) => {
                    resolve(res ? res.roomState : null);
                });
            } else {
                const res = await apiRequest('register_tournament', { userId });
                resolve(res ? res.roomState : null);
            }
        });
    }

    function unregisterTournamentPlayer(userId) {
        return new Promise(async (resolve) => {
            const s = initSocket();
            if (s && s.connected) {
                s.emit('unregister_tournament', { userId }, (res) => {
                    resolve(res ? res.roomState : null);
                });
            } else {
                const res = await apiRequest('unregister_tournament', { userId });
                resolve(res ? res.roomState : null);
            }
        });
    }

    async function listRooms() {
        const res = await apiRequest('list_rooms');
        return res ? res.rooms : [];
    }

    async function listPlayerStats() {
        const res = await apiRequest('list_player_stats');
        return res ? res.stats : [];
    }

    function onRoomUpdate(callback) {
        roomUpdateCallbacks.push(callback);
    }

    function notifyRoomUpdate(roomState) {
        roomUpdateCallbacks.forEach(cb => cb(roomState));
    }

    // Initialize socket connection on startup
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            initSocket();
        });
        // Auto-reconnect / sync when mobile browser tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const s = initSocket();
                if (s && currentRoomCode) {
                    s.emit('join_room_channel', { roomCode: currentRoomCode });
                }
            }
        });
    }

    let roomDeletedCallbacks = [];
    let roomListUpdateCallbacks = [];

    function onRoomDeleted(callback) {
        roomDeletedCallbacks.push(callback);
    }

    function onRoomListUpdate(callback) {
        roomListUpdateCallbacks.push(callback);
    }

    function onGameDeclared(callback) {
        gameDeclaredCallbacks.push(callback);
    }

    function notifyRoomDeleted(data) {
        roomDeletedCallbacks.forEach(cb => cb(data));
    }

    function notifyRoomListUpdate() {
        roomListUpdateCallbacks.forEach(cb => cb());
    }

    function notifyGameDeclared(data) {
        gameDeclaredCallbacks.forEach(cb => cb(data));
    }

    function deleteRoom(roomCode, hostId) {
        return new Promise(async (resolve) => {
            const cleanCode = (roomCode || '').toString().trim();
            const s = initSocket();
            if (s && s.connected) {
                s.emit('delete_room', { roomCode: cleanCode, hostId }, (res) => {
                    resolve(res && res.success);
                });
            } else {
                const res = await apiRequest('delete_room', { roomCode: cleanCode, hostId });
                resolve(res && res.success);
            }
        });
    }

    function syncHandGroups(roomCode, userId, groups) {
        const cleanCode = (roomCode || '').toString().trim();
        const s = initSocket();
        if (s && s.connected) {
            s.emit('sync_hand_groups', { roomCode: cleanCode, userId, groups });
        }
    }

    function leaveRoom(roomCode, userId) {
        const s = initSocket();
        if (s) {
            s.emit('leave_room', { roomCode, userId });
        }
        currentRoomCode = null;
    }

    // Eagerly connect socket on load
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            initSocket();
        });
        setTimeout(initSocket, 200);
    }

    return {
        initSocket,
        getServerUrl,
        createRoom,
        joinRoom,
        deleteRoom,
        syncHandGroups,
        registerTournamentPlayer,
        unregisterTournamentPlayer,
        leaveRoom,
        startNewGame,
        drawCard,
        discardCard,
        declareGame,
        onRoomUpdate,
        onRoomDeleted,
        onRoomListUpdate,
        onGameDeclared,
        listRooms,
        listPlayerStats
    };
})();
