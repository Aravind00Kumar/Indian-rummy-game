import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { listPlayerStats } from '../../services/multiplayer-service';

export function LeaderboardModal() {
    const isLeaderboardModalOpen = useGameStore((state) => state.isLeaderboardModalOpen);
    const setLeaderboardModalOpen = useGameStore((state) => state.setLeaderboardModalOpen);

    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isLeaderboardModalOpen) {
            setLoading(true);
            listPlayerStats().then(data => {
                const sorted = (data || []).sort((a, b) => (b.wins || 0) - (a.wins || 0));
                setStats(sorted);
                setLoading(false);
            });
        }
    }, [isLeaderboardModalOpen]);

    if (!isLeaderboardModalOpen) return null;

    return (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
            <div className="w-full max-w-md bg-emerald-950/95 border-2 border-amber-500/70 rounded-2xl p-5 shadow-2xl backdrop-blur-md max-h-[90vh] overflow-y-auto text-white">
                <h2 className="text-lg font-bold text-amber-400 mb-3 flex items-center justify-center gap-2">
                    🏆 Player Leaderboard & Stats
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-white/20 text-slate-300">
                                <th className="py-2 px-1">Player</th>
                                <th className="py-2 px-1 text-center">Coins</th>
                                <th className="py-2 px-1 text-center">Wins</th>
                                <th className="py-2 px-1 text-center">Losses</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="py-4 text-center text-slate-400">Loading stats...</td></tr>
                            ) : stats.length === 0 ? (
                                <tr><td colSpan={4} className="py-4 text-center text-slate-400">No stats recorded yet.</td></tr>
                            ) : (
                                stats.map((p, idx) => (
                                    <tr key={idx} className="border-b border-white/10 hover:bg-white/5">
                                        <td className="py-2 px-1 flex items-center gap-2">
                                            <img
                                                src={p.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`}
                                                className="w-7 h-7 rounded-full border border-amber-400 bg-slate-900 object-cover"
                                                alt="avatar"
                                            />
                                            <span className="font-bold truncate max-w-[110px]">{p.username}</span>
                                        </td>
                                        <td className="py-2 px-1 text-center font-bold text-amber-400">🪙 {p.coins ?? 500}</td>
                                        <td className="py-2 px-1 text-center font-bold text-emerald-400">{p.wins || 0}</td>
                                        <td className="py-2 px-1 text-center font-bold text-red-400">{p.losses || 0}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <button
                    onClick={() => setLeaderboardModalOpen(false)}
                    className="w-full mt-4 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-xs"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
