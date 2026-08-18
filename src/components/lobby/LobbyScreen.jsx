import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { 
    fetchRoomList, 
    joinRoom, 
    deleteRoom,
    registerTournamentPlayer, 
    unregisterTournamentPlayer, 
    subscribeRoomListUpdate 
} from '../../services/multiplayer-service';
import { getServerUrl, apiRequest } from '../../services/auth-service';

export function LobbyScreen() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const updateCoins = useAuthStore((state) => state.updateCoins);
    const setCreateModalOpen = useGameStore((state) => state.setCreateModalOpen);
    const setJoinModalOpen = useGameStore((state) => state.setJoinModalOpen);
    const setSettingsModalOpen = useGameStore((state) => state.setSettingsModalOpen);
    const setAboutModalOpen = useGameStore((state) => state.setAboutModalOpen);
    const setLeaderboardModalOpen = useGameStore((state) => state.setLeaderboardModalOpen);
    const setRoomState = useGameStore((state) => state.setRoomState);
    const setActiveScreen = useGameStore((state) => state.setActiveScreen);

    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const isNative = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();

    const loadRooms = async () => {
        setLoadingRooms(true);
        const list = await fetchRoomList();
        setRooms(list);
        setLoadingRooms(false);
    };

    useEffect(() => {
        loadRooms();
        const unsub = subscribeRoomListUpdate(() => loadRooms());
        return () => unsub();
    }, []);

    const handleJoinClick = async (roomCode) => {
        setActionLoading(true);
        const res = await joinRoom(roomCode, user);
        setActionLoading(false);
        if (res.success && res.roomState) {
            setRoomState(res.roomState);
            setActiveScreen('game');
        } else {
            alert(res.message || 'Could not join room');
        }
    };

    const handleRegisterTournament = async (roomCode) => {
        if (!user) return;
        setActionLoading(true);
        const roomState = await registerTournamentPlayer(user.id);
        setActionLoading(false);
        if (roomState) {
            loadRooms();
        } else {
            alert('Failed to register for tournament.');
        }
    };

    const handleUnregisterTournament = async (roomCode) => {
        if (!user) return;
        setActionLoading(true);
        const roomState = await unregisterTournamentPlayer(user.id);
        setActionLoading(false);
        if (roomState) {
            loadRooms();
        } else {
            alert('Failed to unregister from tournament.');
        }
    };

    const handleDeleteRoom = async (roomCode) => {
        if (!user) return;
        if (window.confirm(`Delete Room #${roomCode}? All connected players will return to the lobby.`)) {
            const success = await deleteRoom(roomCode, user.id);
            if (success) {
                loadRooms();
            } else {
                alert('Only room host can delete this room.');
            }
        }
    };

    const handleClaimBonus = async () => {
        if (!user) return;
        const newCoins = (user.coins || 0) + 100;
        updateCoins(newCoins);
        await apiRequest('update_settings', { userId: user.id, username: user.username, coins: newCoins });
        alert('🎉 Claimed +100 Free Bonus Coins!');
    };

    const handleDownloadApk = () => {
        const serverUrl = getServerUrl();
        window.location.href = `${serverUrl}/api/download_apk`;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-start p-2 sm:p-4 overflow-hidden bg-gradient-to-b from-emerald-950 to-slate-950 text-white">
            <div className="w-full max-w-lg h-full flex flex-col bg-emerald-950/95 border-2 border-blue-600/60 rounded-2xl p-3 sm:p-5 shadow-2xl backdrop-blur-md text-center overflow-hidden">
                
                {/* User Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2.5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div onClick={() => setSettingsModalOpen(true)} className="flex flex-col items-center cursor-pointer group" title="Tap to Edit Profile">
                            <img
                                className="w-11 h-11 rounded-full border-2 border-amber-400 object-cover bg-[#091a12] group-hover:scale-105 transition"
                                src={user?.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'player'}`}
                                alt="Avatar"
                            />
                            <span className="text-[9px] text-amber-300 font-extrabold mt-0.5">⚙️ Edit</span>
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-sm sm:text-base text-white truncate max-w-[140px]">{user?.username || 'Player'}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-emerald-400 font-semibold">● Online</span>
                                <span className="text-white/30 text-[10px]">|</span>
                                <div className="inline-flex items-center gap-1 bg-black/40 border border-amber-500/40 px-2 py-0.5 rounded-full text-amber-400 text-xs font-extrabold shadow">
                                    <span>🪙</span>
                                    <span>{user?.coins ?? 500}</span>
                                    {(user?.coins < 50) && (
                                        <button
                                            onClick={handleClaimBonus}
                                            className="ml-1 px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-extrabold transition animate-pulse"
                                            title="Claim 100 Free Bonus Coins"
                                        >
                                            🎁 +100
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <button onClick={() => setLeaderboardModalOpen(true)} className="text-amber-400 hover:text-amber-300 text-xs font-bold px-2 py-1 rounded bg-white/5 border border-white/10 transition">📊 Leaderboard</button>
                        <div className="flex items-center gap-2 mt-0.5">
                            <button onClick={() => setAboutModalOpen(true)} className="text-slate-300 hover:text-white text-[11px] font-semibold">ℹ️ About</button>
                            <button onClick={logout} className="text-red-400 hover:text-red-300 text-[11px] font-semibold">Logout</button>
                        </div>
                    </div>
                </div>

                {/* Android APK Download Banner (Visible on Web) */}
                {!isNative && (
                    <div className="mb-2.5 p-2 bg-gradient-to-r from-emerald-900/80 to-teal-900/80 border border-emerald-400/40 rounded-xl flex items-center justify-between gap-2 shadow-md text-left flex-shrink-0">
                        <div>
                            <p className="text-xs font-bold text-emerald-300 flex items-center gap-1"><span>📱</span> Android App Available</p>
                            <p className="text-[10px] text-slate-300">Install native APK for faster gaming</p>
                        </div>
                        <button
                            onClick={handleDownloadApk}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-lg shadow border border-emerald-400/40 transition active:scale-95 flex items-center gap-1"
                        >
                            <span>⬇️</span> Install APK
                        </button>
                    </div>
                )}

                {/* Create / Join Buttons */}
                <div className="flex flex-row gap-2.5 my-1.5 flex-shrink-0">
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow transition active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                        <span>➕</span> Create Room
                    </button>
                    <button
                        onClick={() => setJoinModalOpen(true)}
                        className="flex-1 py-2.5 px-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg shadow transition active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                        <span>🚪</span> Join Room
                    </button>
                </div>

                {/* Available Rooms List */}
                <div className="mt-2 text-left border-t border-white/10 pt-2.5 flex-1 min-h-0 flex flex-col">
                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wide">Available Rooms</span>
                        <button onClick={loadRooms} className="text-blue-400 hover:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded transition">🔄 Refresh</button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
                        {loadingRooms ? (
                            <span className="text-xs text-slate-400 text-center block py-4">Loading rooms...</span>
                        ) : rooms.length === 0 ? (
                            <span className="text-xs text-slate-400 text-center block py-4">No active rooms. Create one!</span>
                        ) : (
                            rooms.map((rm) => {
                                const isTour = rm.code === '9999' || rm.isTournament;
                                const isHost = user && (String(rm.hostId) === String(user.id));
                                const registeredList = rm.registeredPlayers || [];
                                const isRegistered = user && registeredList.map(String).includes(String(user.id));
                                const registeredCount = registeredList.length;

                                if (isTour) {
                                    return (
                                        <div key={rm.code} className="p-3 bg-gradient-to-r from-amber-950/60 to-emerald-950/80 border-2 border-amber-500/80 rounded-xl flex flex-col gap-2 shadow-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-extrabold text-amber-400 flex items-center gap-1.5">
                                                        <span>🏆</span> Tournament #9999
                                                    </div>
                                                    <div className="text-[11px] text-slate-300">Decks: {rm.numDecks || 2} | Timer: {rm.turnTimerSec || 60}s | 🪙 Stake: {rm.entryCoins || 10}</div>
                                                    <div className="text-[11px] text-emerald-400 font-semibold">
                                                        📝 {registeredCount} Registered | 👥 {rm.playersCount || 0}/{registeredCount || 0} Joined
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${rm.status === 'WAITING' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                                                    {rm.status}
                                                </span>
                                            </div>

                                            <div className="flex gap-2 mt-1">
                                                {isRegistered ? (
                                                    <button
                                                        disabled={actionLoading}
                                                        onClick={() => handleUnregisterTournament(rm.code)}
                                                        className="flex-1 py-1.5 px-2 bg-red-900/60 hover:bg-red-800 text-red-300 border border-red-500/50 font-bold rounded-lg text-xs transition active:scale-95"
                                                    >
                                                        ❌ Unregister ({registeredCount})
                                                    </button>
                                                ) : (
                                                    <button
                                                        disabled={actionLoading}
                                                        onClick={() => handleRegisterTournament(rm.code)}
                                                        className="flex-1 py-1.5 px-2 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-extrabold rounded-lg text-xs transition active:scale-95 shadow"
                                                    >
                                                        📝 Register ({registeredCount})
                                                    </button>
                                                )}

                                                <button
                                                    disabled={!isRegistered || actionLoading}
                                                    onClick={() => handleJoinClick(rm.code)}
                                                    className={`flex-1 py-1.5 px-2 font-bold rounded-lg text-xs transition active:scale-95 ${isRegistered ? 'bg-blue-600 hover:bg-blue-500 text-white shadow' : 'bg-white/10 text-slate-500 cursor-not-allowed'}`}
                                                    title={!isRegistered ? 'Please click Register first to join Tournament!' : 'Join Tournament Room'}
                                                >
                                                    🚪 Join Tournament
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={rm.code} className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between hover:border-amber-400/50 transition">
                                        <div>
                                            <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                                                <span>🚪</span> Room #{rm.code}
                                            </div>
                                            <div className="text-[11px] text-slate-300">
                                                Players: {rm.playersCount}/6 | Decks: {rm.numDecks} | Timer: {rm.turnTimerSec}s
                                            </div>
                                            <div className="text-[11px] text-amber-300 font-bold">🪙 Stake: {rm.entryCoins || 10} Coins</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={actionLoading}
                                                onClick={() => handleJoinClick(rm.code)}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition active:scale-95"
                                            >
                                                Join
                                            </button>
                                            {isHost && (
                                                <button
                                                    onClick={() => handleDeleteRoom(rm.code)}
                                                    className="px-2.5 py-1.5 bg-red-900/80 hover:bg-red-800 text-white border border-red-500/50 rounded-lg text-xs font-bold transition active:scale-95"
                                                    title="Delete Room"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
