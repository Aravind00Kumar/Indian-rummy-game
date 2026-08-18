import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useAuthStore } from '../../store/useAuthStore';

export function OpponentsSidebar() {
    const roomState = useGameStore((state) => state.roomState);
    const user = useAuthStore((state) => state.user);

    if (!roomState || !roomState.players) return null;

    const currentTurnUserId = roomState.currentTurnUserId;
    const opponents = roomState.players.filter(p => p.id !== user?.id);

    return (
        <div className="w-[76px] sm:w-[88px] flex-shrink-0 flex flex-col justify-start items-center gap-1 py-1 px-0.5 ml-0 rounded-r-xl bg-black/45 border-r border-y border-white/15 overflow-y-auto scrollbar-none shadow-lg">
            {opponents.map((opp) => {
                const isCurrentTurn = opp.id === currentTurnUserId;
                const handCount = opp.hand ? opp.hand.length : 13;

                return (
                    <div
                        key={opp.id}
                        className={`w-full p-1 rounded-lg flex flex-col items-center border transition ${isCurrentTurn ? 'border-amber-400 bg-amber-950/40 animate-pulse' : 'border-white/10 bg-black/30'}`}
                    >
                        <div className="relative">
                            <img
                                className="w-8 h-8 rounded-full border border-amber-400 object-cover bg-[#091a12]"
                                src={opp.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${opp.username}`}
                                alt={opp.username}
                            />
                            {isCurrentTurn && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-black animate-ping" />
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-white truncate max-w-[65px] mt-0.5">{opp.username}</span>
                        <div className="text-[9px] text-amber-300 font-extrabold mt-0.5">🎴 {handCount} cards</div>
                    </div>
                );
            })}
        </div>
    );
}
