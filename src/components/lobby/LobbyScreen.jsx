import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { fetchRoomList, joinRoom, subscribeRoomListUpdate } from '../../services/multiplayer-service';

export function LobbyScreen() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const setCreateModalOpen = useGameStore((state) => state.setCreateModalOpen);
    const setJoinModalOpen = useGameStore((state) => state.setJoinModalOpen);
    const setSettingsModalOpen = useGameStore((state) => state.setSettingsModalOpen);
    const setAboutModalOpen = useGameStore((state) => state.setAboutModalOpen);
    const setRoomState = useGameStore((state) => state.setRoomState);
    const setActiveScreen = useGameStore((state) => state.setActiveScreen);

    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);

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
        const res = await joinRoom(roomCode, user);
        if (res.success && res.roomState) {
            setRoomState(res.roomState);
            setActiveScreen('game');
        } else {
            alert(res.message || 'Could not join room');
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-start p-2 sm:p-4 overflow-hidden bg-gradient-to-b from-emerald-950 to-slate-950 text-white">
            <div className="w-full max-w-lg h-full flex flex-col bg-emerald-950/95 border-2 border-blue-600/60 rounded-2xl p-3 sm:p-5 shadow-2xl backdrop-blur-md text-center overflow-hidden">
                
                {/* Header */}
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
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <button onClick={() => setAboutModalOpen(true)} className="text-amber-400 hover:text-amber-300 text-xs font-bold px-2 py-1 rounded bg-white/5 border border-white/10 transition">ℹ️ About</button>
                        <button onClick={logout} className="text-red-400 hover:text-red-300 text-xs font-semibold transition">Logout</button>
                    </div>
                </div>

                {/* Create / Join Buttons */}
                <div className="flex flex-row gap-2.5 my-2 flex-shrink-0">
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
                            rooms.map((rm) => (
                                <div key={rm.code} className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between hover:border-amber-400/50 transition">
                                    <div>
                                        <div className="text-sm font-bold text-amber-400">ROOM: {rm.code}</div>
                                        <div className="text-[11px] text-slate-300">Players: {rm.playersCount}/6 | Stake: 🪙 {rm.entryCoins || 10}</div>
                                    </div>
                                    <button
                                        onClick={() => handleJoinClick(rm.code)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition active:scale-95"
                                    >
                                        Join
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
