// Multiplayer Socket.IO Client Service (ES Module)
import { io } from 'socket.io-client';
import { getServerUrl } from './auth-service';

let socket = null;
let currentRoomCode = null;
const roomUpdateCallbacks = [];
const roomDeletedCallbacks = [];
const roomListCallbacks = [];
const gameDeclaredCallbacks = [];

export function getSocket() {
    if (socket && socket.connected) return socket;

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
            console.log('⚡ [Socket.IO Connected]:', socket.id, 'at', serverUrl);
            if (currentRoomCode) {
                socket.emit('join_room_channel', { roomCode: currentRoomCode });
            }
        });

        socket.on('room_update', (roomState) => {
            if (roomState && roomState.code) {
                currentRoomCode = roomState.code;
                roomUpdateCallbacks.forEach(cb => cb(roomState));
            }
        });

        socket.on('game_declared', (declaration) => {
            gameDeclaredCallbacks.forEach(cb => cb(declaration));
        });

        socket.on('room_deleted', (data) => {
            roomDeletedCallbacks.forEach(cb => cb(data));
        });

        socket.on('room_list_update', () => {
            roomListCallbacks.forEach(cb => cb());
        });

        socket.on('disconnect', (reason) => {
            console.warn('⚠️ [Socket.IO Disconnected]:', reason);
        });
    } catch(e) {
        console.error('Socket.IO initialization error:', e);
    }

    return socket;
}

export function subscribeRoomUpdate(cb) {
    roomUpdateCallbacks.push(cb);
    return () => {
        const idx = roomUpdateCallbacks.indexOf(cb);
        if (idx !== -1) roomUpdateCallbacks.splice(idx, 1);
    };
}

export function subscribeGameDeclared(cb) {
    gameDeclaredCallbacks.push(cb);
    return () => {
        const idx = gameDeclaredCallbacks.indexOf(cb);
        if (idx !== -1) gameDeclaredCallbacks.splice(idx, 1);
    };
}

export function subscribeRoomDeleted(cb) {
    roomDeletedCallbacks.push(cb);
    return () => {
        const idx = roomDeletedCallbacks.indexOf(cb);
        if (idx !== -1) roomDeletedCallbacks.splice(idx, 1);
    };
}

export function subscribeRoomListUpdate(cb) {
    roomListCallbacks.push(cb);
    return () => {
        const idx = roomListCallbacks.indexOf(cb);
        if (idx !== -1) roomListCallbacks.splice(idx, 1);
    };
}

export function createRoom(hostUser, config = {}) {
    return new Promise((resolve) => {
        const s = getSocket();
        if (s && s.connected) {
            s.emit('create_room', { user: hostUser, config }, (res) => {
                if (res && res.success) {
                    currentRoomCode = res.roomState.code;
                    resolve(res.roomState);
                } else {
                    resolve(null);
                }
            });
        } else {
            resolve(null);
        }
    });
}

export function joinRoom(roomCode, user) {
    return new Promise((resolve) => {
        const cleanCode = (roomCode || '').toString().trim();
        const s = getSocket();
        if (s && s.connected) {
            s.emit('join_room', { roomCode: cleanCode, user }, (res) => {
                if (res && res.success) {
                    currentRoomCode = res.roomState.code;
                    resolve({ success: true, roomState: res.roomState });
                } else {
                    resolve({ success: false, message: res?.message || 'Failed to join room' });
                }
            });
        } else {
            resolve({ success: false, message: 'Socket disconnected' });
        }
    });
}

export function registerTournamentPlayer(userId) {
    return new Promise((resolve) => {
        const s = getSocket();
        if (s && s.connected) {
            s.emit('register_tournament', { userId }, (res) => {
                resolve(res && res.success ? res.roomState : null);
            });
        } else {
            resolve(null);
        }
    });
}

export function unregisterTournamentPlayer(userId) {
    return new Promise((resolve) => {
        const s = getSocket();
        if (s && s.connected) {
            s.emit('unregister_tournament', { userId }, (res) => {
                resolve(res && res.success ? res.roomState : null);
            });
        } else {
            resolve(null);
        }
    });
}

export async function listPlayerStats() {
    const serverUrl = getServerUrl();
    try {
        const res = await fetch(`${serverUrl}/api/list_player_stats`, { method: 'POST' });
        const data = await res.json();
        return data.stats || [];
    } catch(e) {
        console.error('Failed to fetch player stats:', e);
        return [];
    }
}

export function startNewGame(roomCode) {
    return new Promise((resolve) => {
        const s = getSocket();
        if (s && s.connected) {
            s.emit('start_game', { roomCode }, (res) => {
                resolve(res && res.success ? res.roomState : null);
            });
        } else {
            resolve(null);
        }
    });
}

export function drawCard(roomCode, userId, fromDiscard) {
    const s = getSocket();
    if (s && s.connected) {
        s.emit('draw_card', { roomCode, userId, fromDiscard });
    }
}

export function discardCard(roomCode, userId, cardIndex) {
    const s = getSocket();
    if (s && s.connected) {
        s.emit('discard_card', { roomCode, userId, cardIndex });
    }
}

export function declareGame(roomCode, userId, declaration) {
    return new Promise((resolve) => {
        const s = getSocket();
        if (s && s.connected) {
            s.emit('declare_game', { roomCode, userId, declaration }, (res) => {
                resolve(res && res.success ? res.roomState : null);
            });
        } else {
            resolve(null);
        }
    });
}

export function deleteRoom(roomCode, hostId) {
    return new Promise((resolve) => {
        const s = getSocket();
        if (s && s.connected) {
            s.emit('delete_room', { roomCode, hostId }, (res) => {
                resolve(res && res.success);
            });
        } else {
            resolve(false);
        }
    });
}

export function leaveRoom(roomCode, userId) {
    const s = getSocket();
    if (s && s.connected) {
        s.emit('leave_room', { roomCode, userId });
    }
    currentRoomCode = null;
}

export function syncHandGroups(roomCode, userId, groups) {
    const s = getSocket();
    if (s && s.connected) {
        s.emit('sync_hand_groups', { roomCode, userId, groups });
    }
}

export async function fetchRoomList() {
    const serverUrl = getServerUrl();
    try {
        const res = await fetch(`${serverUrl}/api/list_rooms`, { method: 'POST' });
        const data = await res.json();
        return data.rooms || [];
    } catch(e) {
        console.error('Failed to list rooms:', e);
        return [];
    }
}
