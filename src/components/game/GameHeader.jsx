import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { leaveRoom } from '../../services/multiplayer-service';
import { useAuthStore } from '../../store/useAuthStore';

export function GameHeader() {
    const roomState = useGameStore((state) => state.roomState);
    const user = useAuthStore((state) => state.user);
    const setActiveScreen = useGameStore((state) => state.setActiveScreen);

    const [timerSec, setTimerSec] = useState(roomState?.turnTimerSec || 30);

    useEffect(() => {
        if (!roomState || !roomState.turnStartTime) return;

        const timerLimit = roomState.turnTimerSec || 30;
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - roomState.turnStartTime) / 1000);
            const remain = Math.max(0, timerLimit - elapsed);
            setTimerSec(remain);
        }, 500);

        return () => clearInterval(interval);
    }, [roomState]);

    const handleLeave = () => {
        if (roomState && user) {
            leaveRoom(roomState.code, user.id);
        }
        setActiveScreen('lobby');
    };

    return (
        <div className="w-full h-8 sm:h-10 bg-black/60 border-b border-white/10 flex items-center justify-between px-2.5 sm:px-4 flex-shrink-0 z-20">
            <div className="flex items-center gap-2">
                <span className="bg-black/60 border border-amber-500 text-amber-400 text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wide">
                    ROOM: <strong className="text-white">{roomState?.code || '----'}</strong>
                </span>
                <div className="bg-amber-950/80 border border-amber-500 text-amber-300 text-[10px] sm:text-xs font-extrabold px-2 sm:px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <span>🪙 POT:</span>
                    <span className="text-white font-bold">{roomState?.potCoins || 0}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={handleLeave}
                    className="bg-red-800/90 hover:bg-red-700 border border-red-500/50 text-white px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 active:scale-95 shadow"
                >
                    🚪 Lobby
                </button>
                <div className="font-extrabold text-amber-400 text-[11px] sm:text-xs tracking-wide">
                    Turn: <span className="text-white">{timerSec}</span>s
                </div>
            </div>
        </div>
    );
}
