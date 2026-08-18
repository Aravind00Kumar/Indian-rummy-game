// Authentication Service with local backend database persistence

const AUTH_SERVICE = (function() {
    const STORAGE_KEY = 'rummy_user_session';
    let currentUser = null;
    let authChangeCallbacks = [];

    function getServerUrl() {
        const isNative = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
        const saved = localStorage.getItem('rummy_server_url');
        if (saved && saved.trim()) {
            const cleanSaved = saved.trim().replace(/\/$/, '');
            // On native Android app, prevent localhost/127.0.0.1 since server runs on LAN host
            if (!isNative || (!cleanSaved.includes('localhost') && !cleanSaved.includes('127.0.0.1'))) {
                return cleanSaved;
            }
        }
        if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) {
            return window.APP_CONFIG.SERVER_URL.replace(/\/$/, '');
        }
        if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.protocol.startsWith('http')) {
            return window.location.origin;
        }
        return 'http://192.168.29.56:3000';
    }

    async function refreshProfile() {
        if (!currentUser) return null;
        const res = await apiRequest('get_profile', { userId: currentUser.id });
        if (res.success && res.user) {
            currentUser = { ...currentUser, ...res.user };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
            notifyListeners();
            return currentUser;
        }
        return null;
    }

    function updateCachedCoins(newCoins) {
        if (currentUser && typeof newCoins === 'number') {
            currentUser.coins = newCoins;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
        }
    }

    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                currentUser = JSON.parse(saved);
            } catch(e) {
                currentUser = null;
            }
        }
        if (currentUser) {
            // Eagerly refresh latest coins and stats from server
            refreshProfile().catch(() => {});
        }
    }

    function getCurrentUser() {
        return currentUser;
    }

    async function apiRequest(endpoint, bodyData) {
        const serverUrl = getServerUrl();
        try {
            const response = await fetch(`${serverUrl}/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const resData = await response.json();
            if (!response.ok) {
                return { success: false, message: resData.message || 'Server error' };
            }
            return { success: true, user: resData.user };
        } catch(e) {
            console.error('API request failed to', serverUrl, e);
            return { 
                success: false, 
                message: `Could not connect to authentication server at [${serverUrl}]. Check your Wi-Fi or tap ⚙️ to update Server URL.` 
            };
        }
    }

    async function register(username, password, gender) {
        const res = await apiRequest('register', { username, password, gender });
        if (res.success) {
            currentUser = res.user;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
            notifyListeners();
        }
        return res;
    }

    async function login(username, password) {
        const res = await apiRequest('login', { username, password });
        if (res.success) {
            currentUser = res.user;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
            notifyListeners();
        }
        return res;
    }

    async function updateSettings(username, password, gender, photoUrl) {
        if (!currentUser) return { success: false, message: 'Not logged in.' };
        const res = await apiRequest('update_settings', { userId: currentUser.id, username, password, gender, photoUrl });
        if (res.success) {
            currentUser = res.user;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
            notifyListeners();
        }
        return res;
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem(STORAGE_KEY);
        notifyListeners();
    }

    function onAuthChange(callback) {
        authChangeCallbacks.push(callback);
        callback(currentUser);
    }

    function notifyListeners() {
        authChangeCallbacks.forEach(cb => cb(currentUser));
    }

    init();

    return {
        getServerUrl,
        getCurrentUser,
        refreshProfile,
        updateCachedCoins,
        register,
        login,
        updateSettings,
        logout,
        onAuthChange
    };
})();
