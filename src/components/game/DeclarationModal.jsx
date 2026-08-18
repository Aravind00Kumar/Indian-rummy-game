import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export function DeclarationModal({ onConfirmRestart }) {
    const declarationResult = useGameStore((state) => state.declarationResult);
    const setDeclarationResult = useGameStore((state) => state.setDeclarationResult);
    const setActiveScreen = useGameStore((state) => state.setActiveScreen);

    if (!declarationResult) return null;

    const { winner, declarer, reason, isValid, scoreboard = [] } = declarationResult;

    return (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-3">
            <div className="w-full max-w-xl bg-emerald-950/95 border-2 border-amber-500/70 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md text-center max-h-[94vh] overflow-y-auto text-white">
                <h2 className={`text-xl font-extrabold mb-1.5 ${isValid ? 'text-amber-400' : 'text-red-400'}`}>
                    {isValid ? '🏆 Round Completed' : '❌ Wrong Declaration Penalty'}
                </h2>
                <div className="text-xs sm:text-sm text-slate-300 mb-3">{reason}</div>

                {/* Scoreboard Settlement */}
                <div className="text-xs font-bold text-amber-400 mb-1 text-left flex items-center gap-1">
                    <span>🪙</span> <span>Coins Settlement & Points Summary:</span>
                </div>
                <div className="text-left mb-4 flex flex-col gap-1.5 bg-black/40 p-2.5 rounded-xl border border-white/10">
                    {scoreboard.map((sb, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                            <span className="font-bold">{sb.username} {sb.isWinner ? '👑 (WINNER)' : ''}</span>
                            <div className="flex items-center gap-3">
                                <span>Points: <strong className="text-amber-300">{sb.points}</strong></span>
                                <span>Coins: <strong className={sb.coinChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>{sb.coinChange >= 0 ? `+${sb.coinChange}` : sb.coinChange}</strong></span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={onConfirmRestart}
                        className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow transition active:scale-95 text-xs sm:text-sm"
                    >
                        🔄 Confirm & Play Next Round
                    </button>
                    <button
                        onClick={() => {
                            setDeclarationResult(null);
                            setActiveScreen('lobby');
                        }}
                        className="w-full py-1.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition active:scale-95 text-xs"
                    >
                        🚪 Return to Lobby
                    </button>
                </div>
            </div>
        </div>
    );
}
