// ===== API Configuration =====
// Shared API helper for all frontend scripts

const API = (() => {
    // Auto-detect API base URL
    const BASE_URL = window.location.origin + '/api';

    // Get stored auth token
    function getToken() {
        return localStorage.getItem('auth_token');
    }

    // Get stored user data
    function getUser() {
        const data = localStorage.getItem('auth_user');
        return data ? JSON.parse(data) : null;
    }

    // Save auth data
    function saveAuth(token, user) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    }

    // Clear auth data
    function clearAuth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }

    // Check if user is logged in
    function isLoggedIn() {
        return !!getToken();
    }

    // Build headers
    function getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (includeAuth) {
            const token = getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return headers;
    }

    // Generic fetch wrapper with error handling
    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        const config = {
            headers: getHeaders(options.auth !== false),
            ...options,
        };

        // Don't set Content-Type header for FormData
        if (options.body && options.body instanceof FormData) {
            config.body = options.body;
            // Remove Content-Type so browser sets multipart boundary
            delete config.headers['Content-Type'];
        } else if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Handle 401 — token expired/invalid
                if (response.status === 401) {
                    clearAuth();
                    // Redirect to login if not already there
                    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/auth/')) {
                        window.location.href = '/login';
                        return;
                    }
                }
                throw { status: response.status, ...data };
            }

            return data;
        } catch (err) {
            if (err.status) throw err; // Re-throw API errors
            // Network error
            throw {
                success: false,
                message: 'Network error. Please check your connection.',
                status: 0,
            };
        }
    }

    // Convenience methods
    async function get(endpoint) {
        return request(endpoint, { method: 'GET' });
    }

    async function post(endpoint, body, auth = true) {
        return request(endpoint, { method: 'POST', body, auth });
    }

    async function put(endpoint, body) {
        return request(endpoint, { method: 'PUT', body });
    }

    async function patch(endpoint, body) {
        return request(endpoint, { method: 'PATCH', body });
    }

    async function del(endpoint) {
        return request(endpoint, { method: 'DELETE' });
    }

    // Auth-specific methods
    async function login(email, password) {
        const data = await post('/auth/login', { email, password }, false);
        if (data.success && data.data) {
            saveAuth(data.data.token, data.data.user);
        }
        return data;
    }

    async function register(userData) {
        const data = await post('/auth/register', userData, false);
        if (data.success && data.data) {
            saveAuth(data.data.token, data.data.user);
        }
        return data;
    }

    async function logout() {
        try {
            await post('/auth/logout', {});
        } catch (e) {
            // Ignore — clear local data anyway
        }
        clearAuth();
    }

    // Auth guard — redirect if not authenticated
    function requireAuth(allowedRoles = []) {
        if (!isLoggedIn()) {
            window.location.href = '/login';
            return false;
        }
        const user = getUser();
        if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    return {
        BASE_URL,
        getToken,
        getUser,
        saveAuth,
        clearAuth,
        isLoggedIn,
        get,
        post,
        put,
        patch,
        del,
        login,
        register,
        logout,
        requireAuth,
    };
})();

// Make globally available
window.API = API;

// ── Notification Badge: fetch unread count on every page ──
(function initNotificationBadge() {
    async function fetchNotificationCount() {
        const badge = document.getElementById('notifBadge');
        if (!badge) return;

        const token = localStorage.getItem('auth_token') || localStorage.getItem('lms_token');
        if (!token) return;

        try {
            const resp = await fetch('/api/notifications/unread-count', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            // Handle rate-limit or non-OK responses gracefully
            if (!resp.ok) return;

            const data = await resp.json();
            if (data.success) {
                const count = data.data.unread || 0;
                if (count > 0) {
                    badge.textContent = count > 9 ? '9+' : count;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {
            // Silently fail — badge stays as-is
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Initial fetch after a short delay to let auth settle
        setTimeout(fetchNotificationCount, 500);
        // Poll every 30 seconds
        setInterval(fetchNotificationCount, 30000);
    });

    window.fetchNotificationCount = fetchNotificationCount;
})();
