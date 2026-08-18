// Authentication Service (ES Module)
const STORAGE_KEY = 'rummy_user_session';

export function getServerUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3000';
    const isNative = window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
    const saved = localStorage.getItem('rummy_server_url');
    if (saved && saved.trim()) {
        const cleanSaved = saved.trim().replace(/\/$/, '');
        if (!isNative || (!cleanSaved.includes('localhost') && !cleanSaved.includes('127.0.0.1'))) {
            return cleanSaved;
        }
    }
    if (window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) {
        return window.APP_CONFIG.SERVER_URL.replace(/\/$/, '');
    }
    if (window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.protocol.startsWith('http')) {
        return window.location.origin;
    }
    return 'http://192.168.29.56:3000';
}

export async function apiRequest(endpoint, bodyData) {
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
            message: `Could not connect to server at [${serverUrl}]. Check your Wi-Fi or tap ⚙️ to update Server URL.` 
        };
    }
}

export function getSavedUser() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch(e) {
        return null;
    }
}

export function saveUserSession(user) {
    if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export async function registerUser(username, password, gender) {
    const res = await apiRequest('register', { username, password, gender });
    if (res.success && res.user) {
        saveUserSession(res.user);
    }
    return res;
}

export async function loginUser(username, password) {
    const res = await apiRequest('login', { username, password });
    if (res.success && res.user) {
        saveUserSession(res.user);
    }
    return res;
}

export async function updateUserSettings(userId, username, password, gender, photoUrl) {
    const res = await apiRequest('update_settings', { userId, username, password, gender, photoUrl });
    if (res.success && res.user) {
        saveUserSession(res.user);
    }
    return res;
}

export async function refreshUserProfile(userId) {
    const res = await apiRequest('get_profile', { userId });
    if (res.success && res.user) {
        saveUserSession(res.user);
        return res.user;
    }
    return null;
}
