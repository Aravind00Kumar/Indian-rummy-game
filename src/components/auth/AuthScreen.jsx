import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { loginUser, registerUser } from '../../services/auth-service';

export function AuthScreen({ onOpenSettings, onOpenAbout }) {
    const [isLoginTab, setIsLoginTab] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState('Male');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const setUser = useAuthStore((state) => state.setUser);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setLoading(true);

        if (!username || !password) {
            setErrorMessage('Please enter both username and password.');
            setLoading(false);
            return;
        }

        let res;
        if (isLoginTab) {
            res = await loginUser(username, password);
        } else {
            res = await registerUser(username, password, gender);
        }

        setLoading(false);
        if (res.success && res.user) {
            setUser(res.user);
        } else {
            setErrorMessage(res.message || 'Authentication failed.');
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto bg-gradient-to-b from-emerald-950 to-slate-950 text-white">
            <div className="relative w-full max-w-md bg-emerald-950/90 border-2 border-blue-600/60 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center">
                {/* Header Icons */}
                <button onClick={onOpenAbout} className="absolute top-3 left-3 text-yellow-400 p-1.5 rounded-lg text-xl hover:scale-105 active:scale-95 transition" title="About App">ℹ️</button>
                <button onClick={onOpenSettings} className="absolute top-3 right-3 text-amber-400 p-1.5 rounded-lg text-xl hover:scale-105 active:scale-95 transition" title="Server Settings">⚙️</button>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-wider mt-2 mb-1 flex items-center justify-center gap-2">
                    <span>🎴</span> RUMMY MOBILE
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mb-4">Multiplayer Indian 13-Card Rummy (React + PixiJS Engine)</p>

                {errorMessage && (
                    <div className="mb-3 p-2 bg-red-900/80 border border-red-500 rounded text-xs text-red-200">
                        {errorMessage}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-white/10 mb-5">
                    <button
                        onClick={() => setIsLoginTab(true)}
                        className={`flex-1 py-2.5 font-bold text-sm transition border-b-2 ${isLoginTab ? 'border-amber-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setIsLoginTab(false)}
                        className={`flex-1 py-2.5 font-bold text-sm transition border-b-2 ${!isLoginTab ? 'border-amber-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        Register
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
                    <div>
                        <label className="text-xs font-medium text-slate-300">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-blue-500/50 bg-[#091a12] text-white text-sm focus:outline-none focus:border-amber-400 transition"
                            placeholder="Enter Username"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-blue-500/50 bg-[#091a12] text-white text-sm focus:outline-none focus:border-amber-400 transition"
                            placeholder="Enter Password"
                        />
                    </div>

                    {!isLoginTab && (
                        <div>
                            <label className="text-xs font-medium text-slate-300">Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-blue-500/50 bg-[#091a12] text-white text-sm focus:outline-none focus:border-amber-400 transition"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full mt-2 py-2.5 px-4 font-bold rounded-lg shadow-md transition active:scale-95 text-sm ${isLoginTab ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-teal-600 hover:bg-teal-500 text-white'}`}
                    >
                        {loading ? 'Processing...' : (isLoginTab ? 'Login' : 'Register User')}
                    </button>
                </form>
            </div>
        </div>
    );
}
