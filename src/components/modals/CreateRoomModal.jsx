import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useAuthStore } from '../../store/useAuthStore';
import { createRoom } from '../../services/multiplayer-service';

export function CreateRoomModal() {
    const isCreateModalOpen = useGameStore((state) => state.isCreateModalOpen);
    const setCreateModalOpen = useGameStore((state) => state.setCreateModalOpen);
    const setRoomState = useGameStore((state) => state.setRoomState);
    const setActiveScreen = useGameStore((state) => state.setActiveScreen);
    const user = useAuthStore((state) => state.user);

    const [deckCount, setDeckCount] = useState('2');
    const [turnTimerSec, setTurnTimerSec] = useState('30');
    const [entryCoins, setEntryCoins] = useState('10');
    const [loading, setLoading] = useState(false);

    if (!isCreateModalOpen) return null;

    const handleCreate = async () => {
        setLoading(true);
        const roomState = await createRoom(user, {
            deckCount: parseInt(deckCount),
            turnTimerSec: parseInt(turnTimerSec),
            entryCoins: parseInt(entryCoins)
        });
        setLoading(false);

        if (roomState) {
            setRoomState(roomState);
            setCreateModalOpen(false);
            setActiveScreen('game');
        } else {
            alert('Failed to create room. Check connection.');
        }
    };

    return (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
            <div className="w-full max-w-sm bg-emerald-950/95 border-2 border-blue-600/70 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-center text-white">
                <h2 className="text-lg font-bold text-amber-400 mb-3 flex items-center justify-center gap-2">
                    <span>➕</span> Create Game Room
                </h2>

                <div className="text-left mb-3">
                    <label className="text-xs font-semibold text-slate-300">Number of Decks:</label>
                    <select
                        value={deckCount}
                        onChange={(e) => setDeckCount(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs border border-slate-600"
                    >
                        <option value="1">1 Standard Deck (2 Players)</option>
                        <option value="2">2 Standard Decks (2-6 Players)</option>
                        <option value="3">3 Standard Decks (4-6 Players)</option>
                    </select>
                </div>

                <div className="text-left mb-3">
                    <label className="text-xs font-semibold text-slate-300">Turn Timer (seconds):</label>
                    <select
                        value={turnTimerSec}
                        onChange={(e) => setTurnTimerSec(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs border border-slate-600"
                    >
                        <option value="15">15 Seconds (Fast)</option>
                        <option value="30">30 Seconds (Standard)</option>
                        <option value="45">45 Seconds</option>
                        <option value="60">60 Seconds</option>
                    </select>
                </div>

                <div className="text-left mb-4">
                    <label className="text-xs font-semibold text-slate-300">🪙 Coins Entry Stake:</label>
                    <select
                        value={entryCoins}
                        onChange={(e) => setEntryCoins(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs border border-slate-600"
                    >
                        <option value="10">🪙 10 Coins (Default)</option>
                        <option value="20">🪙 20 Coins</option>
                        <option value="50">🪙 50 Coins</option>
                        <option value="100">🪙 100 Coins</option>
                    </select>
                </div>

                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow transition active:scale-95 text-xs sm:text-sm"
                >
                    {loading ? 'Creating...' : 'Generate Code & Create'}
                </button>
                <button
                    onClick={() => setCreateModalOpen(false)}
                    className="w-full mt-2 py-1.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition active:scale-95 text-xs"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
