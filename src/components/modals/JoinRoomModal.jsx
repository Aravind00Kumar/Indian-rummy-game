import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useAuthStore } from '../../store/useAuthStore';
import { joinRoom } from '../../services/multiplayer-service';

export function JoinRoomModal() {
    const isJoinModalOpen = useGameStore((state) => state.isJoinModalOpen);
    const setJoinModalOpen = useGameStore((state) => state.setJoinModalOpen);
    const setRoomState = useGameStore((state) => state.setRoomState);
    const setActiveScreen = useGameStore((state) => state.setActiveScreen);
    const user = useAuthStore((state) => state.user);

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isJoinModalOpen) return null;

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!code || code.length !== 4) {
            alert('Please enter a valid 4-digit room code.');
            return;
        }

        setLoading(true);
        const res = await joinRoom(code, user);
        setLoading(false);

        if (res.success && res.roomState) {
            setRoomState(res.roomState);
            setJoinModalOpen(false);
            setActiveScreen('game');
        } else {
            alert(res.message || 'Room not found.');
        }
    };

    return (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
            <div className="w-full max-w-xs bg-emerald-950/95 border-2 border-blue-600/70 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-center text-white">
                <h2 className="text-base sm:text-lg font-bold text-amber-400 mb-2">Enter 4-Digit Room Code</h2>
                
                <form onSubmit={handleJoin}>
                    <input
                        type="text"
                        maxLength={4}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="text-2xl font-extrabold tracking-widest text-center w-36 px-3 py-2 rounded-lg border-2 border-teal-500 bg-[#091a12] text-amber-400 my-3 focus:outline-none focus:border-amber-400"
                        placeholder="0000"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow transition active:scale-95 text-xs sm:text-sm"
                    >
                        {loading ? 'Joining...' : 'Join Room'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setJoinModalOpen(false)}
                        className="w-full mt-2 py-1.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition active:scale-95 text-xs"
                    >
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
}
