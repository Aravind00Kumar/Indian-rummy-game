import { create } from 'zustand';
import { getSavedUser, saveUserSession, refreshUserProfile, getServerUrl } from '../services/auth-service';

export const useAuthStore = create((set, get) => ({
    user: getSavedUser(),
    serverUrl: getServerUrl(),

    setUser: (user) => {
        saveUserSession(user);
        set({ user });
    },

    updateCoins: (coins) => {
        const user = get().user;
        if (user) {
            const updated = { ...user, coins };
            saveUserSession(updated);
            set({ user: updated });
        }
    },

    refreshProfile: async () => {
        const user = get().user;
        if (!user) return;
        const refreshed = await refreshUserProfile(user.id);
        if (refreshed) {
            set({ user: refreshed });
        }
    },

    logout: () => {
        saveUserSession(null);
        set({ user: null });
    },

    setServerUrl: (url) => {
        if (url) {
            localStorage.setItem('rummy_server_url', url.trim());
            set({ serverUrl: url.trim() });
        }
    }
}));
