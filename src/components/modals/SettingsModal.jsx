import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useAuthStore } from '../../store/useAuthStore';
import { updateUserSettings } from '../../services/auth-service';

export function SettingsModal() {
    const isSettingsModalOpen = useGameStore((state) => state.isSettingsModalOpen);
    const setSettingsModalOpen = useGameStore((state) => state.setSettingsModalOpen);
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const serverUrl = useAuthStore((state) => state.serverUrl);
    const setServerUrl = useAuthStore((state) => state.setServerUrl);

    const [urlInput, setUrlInput] = useState(serverUrl || '');
    const [username, setUsername] = useState(user?.username || '');
    const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
    const [loading, setLoading] = useState(false);

    if (!isSettingsModalOpen) return null;

    const handleSave = async () => {
        setLoading(true);
        if (urlInput) {
            setServerUrl(urlInput);
        }
        if (user) {
            const res = await updateUserSettings(user.id, username, null, user.gender, photoUrl);
            if (res.success && res.user) {
                setUser(res.user);
            }
        }
        setLoading(false);
        setSettingsModalOpen(false);
    };

    return (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
            <div className="w-full max-w-md bg-emerald-950/95 border-2 border-blue-600/70 rounded-2xl p-5 shadow-2xl backdrop-blur-md max-h-[90vh] overflow-y-auto text-white">
                <h2 className="text-lg font-bold text-amber-400 mb-3 flex items-center justify-center gap-2">⚙️ Settings</h2>

                {/* Server Connection URL */}
                <div className="border-b border-white/15 pb-3 mb-3 text-left">
                    <h3 className="text-xs font-bold text-amber-400 mb-1 border-l-2 border-amber-400 pl-2">🌐 Server Connection</h3>
                    <label className="text-xs text-slate-300">Server Connection URL:</label>
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs border border-blue-500/50"
                        placeholder="e.g. http://192.168.1.10:3000"
                    />
                </div>

                {/* User Settings */}
                {user && (
                    <div className="text-left mb-4">
                        <h3 className="text-xs font-bold text-amber-400 mb-1 border-l-2 border-amber-400 pl-2">👤 Profile Settings</h3>
                        <div className="mb-2">
                            <label className="text-xs text-slate-300">Username:</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs border border-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-300">Avatar Photo URL:</label>
                            <input
                                type="text"
                                value={photoUrl}
                                onChange={(e) => setPhotoUrl(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs border border-blue-500/50"
                                placeholder="Avatar Image URL"
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow text-xs sm:text-sm"
                    >
                        {loading ? 'Saving...' : 'Save Settings'}
                    </button>
                    <button
                        onClick={() => setSettingsModalOpen(false)}
                        className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg text-xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
