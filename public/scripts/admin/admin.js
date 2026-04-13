// ===== ADMIN COMMON JS =====
// Shared logic for all admin pages

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initSidebarCollapse('lms-admin-sidebar-collapsed');
    initTopbar();
    initTabs();
    initPagination();
    initFilters();
});

// ===== Sidebar =====
function initSidebar() {
    // Highlight active nav item based on current page
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    
    navItems.forEach(item => {
        if (item.getAttribute('data-page') === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Logout handler
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                if (window.API) API.clearAuth();
                window.location.href = '/login';
            }
        });
    }

    // Mobile sidebar toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 
                && !sidebar.contains(e.target) 
                && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }
}

/** Collapse / expand sidebar (desktop). Preference stored in localStorage.
 *  Body starts with sidebar-collapsed class in HTML to prevent flash.
 *  JS only expands if user explicitly chose to expand ('0'). */
function initSidebarCollapse(storageKey) {
    const btn = document.getElementById('sidebarCollapseBtn');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;

    function setNavTitles(collapsed) {
        document.querySelectorAll('.sidebar .nav-item').forEach((el) => {
            const label = el.querySelector('span:not(.material-icons-outlined)');
            if (label && label.textContent) {
                if (collapsed) {
                    el.setAttribute('title', label.textContent.trim());
                } else {
                    el.removeAttribute('title');
                }
            }
        });
    }

    function applyCollapsed(collapsed) {
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
        setNavTitles(collapsed);
        try {
            localStorage.setItem(storageKey, collapsed ? '1' : '0');
        } catch (e) { /* ignore */ }
    }

    // Body starts collapsed via HTML class. If user previously chose expanded, un-collapse.
    try {
        if (localStorage.getItem(storageKey) === '0' && window.innerWidth > 768) {
            applyCollapsed(false);
        } else {
            // Keep collapsed (already set in HTML), just set titles
            setNavTitles(true);
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Expand navigation');
        }
    } catch (e) {
        setNavTitles(true);
    }

    btn.addEventListener('click', () => {
        applyCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            document.body.classList.remove('sidebar-collapsed');
            setNavTitles(false);
        }
    });
}

// ===== Topbar =====
function initTopbar() {
    // Greeting based on time of day
    const greetingEl = document.getElementById('topbarGreeting');
    if (greetingEl) {
        function updateGreeting() {
            const hour = new Date().getHours();
            let greetText;
            if (hour >= 5 && hour < 12) {
                greetText = 'Good Morning';
            } else if (hour >= 12 && hour < 17) {
                greetText = 'Good Afternoon';
            } else if (hour >= 17 && hour < 21) {
                greetText = 'Good Evening';
            } else {
                greetText = 'Good Evening';
            }

            // Get logged-in user name
            let userName = 'Admin';
            if (window.API && API.getUser) {
                const user = API.getUser();
                if (user) {
                    userName = user.firstName || user.name || 'Admin';
                }
            }

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

            greetingEl.innerHTML =
                `<div class="greeting-primary">${greetText}, <span class="greeting-name">${userName}</span></div>` +
                `<div class="greeting-sub">${dateStr}</div>`;
        }
        updateGreeting();
        setInterval(updateGreeting, 60000);
    }

    // ─── Notification Panel ───
    initNotificationPanel();

    // ─── Help Modal ───
    initHelpModal();
}

// ===== NOTIFICATION PANEL =====
function initNotificationPanel() {
    const notifBtn = document.getElementById('notificationBtn');
    if (!notifBtn) return;

    // Inject styles
    injectNotificationStyles();

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'notif-panel';
    panel.innerHTML = `
        <div class="notif-header">
            <h3>Notifications</h3>
            <button class="notif-mark-all" id="notifMarkAll" title="Mark all as read">
                <span class="material-icons-outlined">done_all</span>
            </button>
        </div>
        <div class="notif-body" id="notifBody">
            <div class="notif-loading">Loading...</div>
        </div>
    `;
    notifBtn.parentElement.style.position = 'relative';
    notifBtn.parentElement.appendChild(panel);

    let panelOpen = false;

    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panelOpen = !panelOpen;
        panel.classList.toggle('open', panelOpen);
        if (panelOpen) loadNotifications();
    });

    document.addEventListener('click', (e) => {
        if (panelOpen && !panel.contains(e.target) && !notifBtn.contains(e.target)) {
            panelOpen = false;
            panel.classList.remove('open');
        }
    });

    // Mark all read
    document.getElementById('notifMarkAll').addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('lms_token') || (window.API && API.getToken && API.getToken());
            await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            loadNotifications();
        } catch (e) { /* ignore */ }
    });

    // Load unread count on page load
    loadUnreadCount();
    // Refresh every 60 seconds
    setInterval(loadUnreadCount, 60000);
}

async function loadNotifications() {
    const body = document.getElementById('notifBody');
    if (!body) return;

    try {
        const token = localStorage.getItem('lms_token') || (window.API && API.getToken && API.getToken());
        const resp = await fetch('/api/notifications?limit=25', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();

        if (!data.success || !data.data.length) {
            body.innerHTML = `<div class="notif-empty">
                <span class="material-icons-outlined" style="font-size:40px;color:#cbd5e1;">notifications_none</span>
                <p>No notifications yet</p>
            </div>`;
            return;
        }

        body.innerHTML = data.data.map(n => {
            const timeAgo = getTimeAgo(n.createdAt);
            const iconColors = {
                maintenance: '#f59e0b', system: '#3b82f6', overdue: '#ef4444',
                due_reminder: '#f97316', account: '#8b5cf6', registration: '#10b981',
                fine: '#ef4444', borrow: '#0ea5e9', return: '#22c55e',
            };
            const color = iconColors[n.type] || '#6b7280';
            const readClass = n.read ? 'read' : '';

            return `<div class="notif-item ${readClass}" data-id="${n._id}" onclick="markNotifRead('${n._id}', this)">
                <div class="notif-icon" style="background:${color}15;color:${color}">
                    <span class="material-icons-outlined">${n.icon || 'notifications'}</span>
                </div>
                <div class="notif-content">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-msg">${n.message}</div>
                    <div class="notif-time">${timeAgo}</div>
                </div>
                ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
            </div>`;
        }).join('');
    } catch (e) {
        body.innerHTML = '<div class="notif-empty"><p>Unable to load notifications</p></div>';
    }
}

async function loadUnreadCount() {
    try {
        const token = localStorage.getItem('lms_token') || (window.API && API.getToken && API.getToken());
        if (!token) return;
        const resp = await fetch('/api/notifications/unread-count', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        const dot = document.querySelector('#notificationBtn .notification-dot');
        if (dot) {
            dot.style.display = (data.success && data.data.unread > 0) ? 'block' : 'none';
        }
    } catch (e) { /* ignore */ }
}

window.markNotifRead = async function (id, el) {
    try {
        const token = localStorage.getItem('lms_token') || (window.API && API.getToken && API.getToken());
        await fetch(`/api/notifications/${id}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (el) {
            el.classList.add('read');
            const dot = el.querySelector('.notif-unread-dot');
            if (dot) dot.remove();
        }
        loadUnreadCount();
    } catch (e) { /* ignore */ }
};

function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function injectNotificationStyles() {
    if (document.getElementById('notif-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'notif-panel-styles';
    style.textContent = `
        .notif-panel {
            position: absolute; top: 52px; right: 0; width: 380px; max-height: 480px;
            background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
            z-index: 1000; opacity: 0; transform: translateY(-8px) scale(0.97); pointer-events: none;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column;
            overflow: hidden;
        }
        .notif-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
        .notif-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 20px 12px; border-bottom: 1px solid #f1f5f9;
        }
        .notif-header h3 { font-family: 'Space Grotesk', sans-serif; font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; }
        .notif-mark-all {
            width: 32px; height: 32px; border-radius: 8px; border: none; background: #f1f5f9;
            cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .notif-mark-all:hover { background: #e2e8f0; }
        .notif-mark-all .material-icons-outlined { font-size: 1.1rem; color: #64748b; }
        .notif-body { overflow-y: auto; max-height: 380px; padding: 8px 0; }
        .notif-item {
            display: flex; align-items: flex-start; gap: 12px; padding: 12px 20px; cursor: pointer;
            transition: background 0.15s; position: relative;
        }
        .notif-item:hover { background: #f8fafc; }
        .notif-item.read { opacity: 0.6; }
        .notif-icon {
            width: 36px; height: 36px; min-width: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
        }
        .notif-icon .material-icons-outlined { font-size: 1.15rem; }
        .notif-content { flex: 1; min-width: 0; }
        .notif-title { font-size: 0.82rem; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
        .notif-msg { font-size: 0.75rem; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .notif-time { font-size: 0.68rem; color: #94a3b8; margin-top: 4px; }
        .notif-unread-dot {
            width: 8px; height: 8px; min-width: 8px; border-radius: 50%; background: #3b82f6;
            margin-top: 6px;
        }
        .notif-empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 0.82rem; }
        .notif-loading { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 0.82rem; }

        /* Help modal */
        .help-overlay {
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px);
            z-index: 9998; opacity: 0; pointer-events: none; transition: opacity 0.25s;
        }
        .help-overlay.open { opacity: 1; pointer-events: auto; }
        .help-modal {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95);
            width: 520px; max-width: 92vw; max-height: 80vh; background: #fff; border-radius: 20px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.2); z-index: 9999; opacity: 0; pointer-events: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column;
            overflow: hidden;
        }
        .help-modal.open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
        .help-modal-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 20px 24px 16px; border-bottom: 1px solid #f1f5f9;
        }
        .help-modal-header h3 { font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0; }
        .help-close {
            width: 32px; height: 32px; border-radius: 8px; border: none; background: #f1f5f9;
            cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .help-close:hover { background: #e2e8f0; }
        .help-close .material-icons-outlined { font-size: 1.1rem; color: #64748b; }
        .help-body { overflow-y: auto; padding: 16px 24px 24px; }
        .faq-item { margin-bottom: 12px; border: 1px solid #f1f5f9; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
        .faq-item:hover { border-color: #e2e8f0; }
        .faq-q {
            display: flex; justify-content: space-between; align-items: center; padding: 14px 16px;
            cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #334155; gap: 8px;
            background: #fafbfc; transition: background 0.15s;
        }
        .faq-q:hover { background: #f1f5f9; }
        .faq-q .material-icons-outlined { font-size: 1.2rem; color: #94a3b8; transition: transform 0.3s; }
        .faq-item.open .faq-q .material-icons-outlined { transform: rotate(180deg); }
        .faq-a { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
        .faq-item.open .faq-a { max-height: 200px; }
        .faq-a-inner { padding: 0 16px 14px; font-size: 0.8rem; color: #64748b; line-height: 1.6; }
    `;
    document.head.appendChild(style);
}

// ===== HELP MODAL =====
function initHelpModal() {
    const helpBtn = document.getElementById('helpBtn');
    if (!helpBtn) return;

    const faqs = [
        { q: 'How do I issue a book to a student?', a: 'Go to Transactions page → Click "Issue Book" → Select the student and book → Confirm. The system will auto-calculate the due date based on your circulation policy settings.' },
        { q: 'How do I change the loan period or fine rates?', a: 'Navigate to Settings → Circulation Policies section. You can set default loan days, fine per day, maximum fine, grace period, and max renewals.' },
        { q: 'What happens when I enable maintenance mode?', a: 'Students will see a maintenance banner and cannot access any library services. Admin access remains fully functional. A notification is auto-generated for all users.' },
        { q: 'How are overdue fines calculated?', a: 'Fines = (Days overdue − Grace period) × Fine per day, capped at the Maximum fine amount. All values come from your Circulation Policies in Settings.' },
        { q: 'Can I disable student self-registration?', a: 'Yes. Go to Settings → System → Toggle "Allow Student Registration" OFF and save. The signup page will show a disabled message. You can still create students from the Users page.' },
        { q: 'How do I add a new book to the library?', a: 'Go to the Books page → Click the "+ Add Book" button → Fill in the title, author, ISBN, and other details → Upload a cover image → Click Save.' },
        { q: 'How do I export data?', a: 'On Books, Users, and Transactions pages, look for the Export button in the top actions area. You can export to CSV format.' },
        { q: 'What do the dashboard statistics show?', a: 'The dashboard shows: Total books, Active members, Active loans, Overdue books, Today\'s transactions, and fine summaries — all in real-time.' },
    ];

    // Create overlay + modal
    const overlay = document.createElement('div');
    overlay.className = 'help-overlay';
    overlay.id = 'helpOverlay';

    const modal = document.createElement('div');
    modal.className = 'help-modal';
    modal.id = 'helpModal';
    modal.innerHTML = `
        <div class="help-modal-header">
            <h3><span class="material-icons-outlined" style="vertical-align:middle;margin-right:8px;color:#3b82f6;">help_outline</span>Help & FAQ</h3>
            <button class="help-close" id="helpClose"><span class="material-icons-outlined">close</span></button>
        </div>
        <div class="help-body">
            ${faqs.map((f, i) => `
                <div class="faq-item" data-faq="${i}">
                    <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">
                        <span>${f.q}</span>
                        <span class="material-icons-outlined">expand_more</span>
                    </div>
                    <div class="faq-a"><div class="faq-a-inner">${f.a}</div></div>
                </div>
            `).join('')}
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    helpBtn.addEventListener('click', () => {
        overlay.classList.add('open');
        modal.classList.add('open');
    });

    const closeHelp = () => {
        overlay.classList.remove('open');
        modal.classList.remove('open');
    };

    document.getElementById('helpClose').addEventListener('click', closeHelp);
    overlay.addEventListener('click', closeHelp);
}

// ===== Tabs =====
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns.length === 0) return;

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Trigger custom event
            const tabName = btn.getAttribute('data-tab');
            document.dispatchEvent(new CustomEvent('tabChange', { detail: { tab: tabName } }));
        });
    });
}

// ===== Pagination =====
function initPagination() {
    const pageBtns = document.querySelectorAll('.page-btn[data-page]');
    if (pageBtns.length === 0) return;

    pageBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            pageBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const page = btn.getAttribute('data-page');
            document.dispatchEvent(new CustomEvent('pageChange', { detail: { page } }));
        });
    });
}

// ===== Filter Pills =====
function initFilters() {
    const pills = document.querySelectorAll('.pill');
    if (pills.length === 0) return;

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const filter = pill.getAttribute('data-filter');
            document.dispatchEvent(new CustomEvent('filterChange', { detail: { filter } }));
        });
    });
}

// ===== Utility Functions =====
function generateSidebarHTML(activePage) {
    return `
    <div class="sidebar-brand">
        <div class="sidebar-brand-icon">
            <span class="material-icons-outlined">auto_stories</span>
        </div>
        <div class="sidebar-brand-text">
            <h2>The Archivist</h2>
            <span>Management Portal</span>
        </div>
    </div>
    <nav class="sidebar-nav">
        <a href="dashboard" class="nav-item" data-page="dashboard">
            <span class="material-icons-outlined">dashboard</span>
            <span>Dashboard</span>
        </a>
        <a href="books" class="nav-item" data-page="books">
            <span class="material-icons-outlined">auto_stories</span>
            <span>Books</span>
        </a>
        <a href="users" class="nav-item" data-page="users">
            <span class="material-icons-outlined">group</span>
            <span>Users</span>
        </a>
        <a href="transactions" class="nav-item" data-page="transactions">
            <span class="material-icons-outlined">swap_horiz</span>
            <span>Transactions</span>
        </a>
    </nav>
    <div class="sidebar-footer">
        <a href="#" class="nav-item" data-page="settings">
            <span class="material-icons-outlined">settings</span>
            <span>Settings</span>
        </a>
        <a href="../index" class="nav-item logout-btn">
            <span class="material-icons-outlined">logout</span>
            <span>Logout</span>
        </a>
    </div>`;
}

function generateTopbarHTML() {
    return `
    <div class="topbar-greeting" id="topbarGreeting"></div>
    <div class="topbar-right">
        <button class="topbar-icon-btn" id="notificationBtn">
            <span class="material-icons-outlined">notifications</span>
            <span class="notification-dot"></span>
        </button>
        <button class="topbar-icon-btn" id="helpBtn">
            <span class="material-icons-outlined">help_outline</span>
        </button>
    </div>`;
}

// Simple bar chart renderer
function renderBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const maxVal = Math.max(...data.map(d => d.value));
    container.innerHTML = '';

    data.forEach((d, i) => {
        const heightPct = (d.value / maxVal) * 100;
        const bar = document.createElement('div');
        bar.className = 'bar' + (d.highlight ? ' highlight' : '');
        bar.style.height = '0%';
        bar.style.transition = 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        
        if (d.label) {
            const label = document.createElement('span');
            label.className = 'bar-label';
            label.textContent = d.label;
            bar.appendChild(label);
        }

        container.appendChild(bar);
        
        // Animate bar height after a small delay
        setTimeout(() => {
            bar.style.height = heightPct + '%';
        }, i * 100);
    });
}

// ===== Enhanced Interactions =====

// Add ripple effect to all buttons
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-primary, .btn-outline, .action-btn, .page-btn, .pill, .topbar-icon-btn');
    if (!btn) return;
    
    const ripple = document.createElement('span');
    ripple.style.cssText = `
        position: absolute;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
    `;
    
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
    
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
});

// Add ripple animation keyframes
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

// Enhanced stat card counter animation
function animateStatCards() {
    const statValues = document.querySelectorAll('.stat-card-value');
    statValues.forEach(el => {
        const finalValue = el.textContent;
        const isNumber = /^[\d,]+$/.test(finalValue.replace(/,/g, ''));
        
        if (isNumber) {
            const target = parseInt(finalValue.replace(/,/g, ''));
            let current = 0;
            const increment = target / 30;
            const duration = 800;
            const stepTime = duration / 30;
            
            el.textContent = '0';
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    el.textContent = finalValue;
                    clearInterval(timer);
                } else {
                    el.textContent = Math.floor(current).toLocaleString();
                }
            }, stepTime);
        }
    });
}

// Run stat card animation when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(animateStatCards, 300);
});

// Enhanced hover effects for table rows
document.querySelectorAll('.data-table tbody tr').forEach(row => {
    row.addEventListener('mouseenter', () => {
        row.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    });
});

// Enhanced book card interactions
document.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        const cover = card.querySelector('.book-card-cover img');
        if (cover) {
            cover.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        }
    });
});

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 24px; right: 24px; z-index: 10001;
        padding: 14px 24px; border-radius: 12px; font-family: 'Inter', sans-serif;
        font-size: 0.88rem; font-weight: 500; color: #fff;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18); animation: toastIn 0.35s ease;
        max-width: 380px;
    `;
    const colors = {
        success: 'linear-gradient(135deg, #059669, #10b981)',
        error: 'linear-gradient(135deg, #dc2626, #ef4444)',
        info: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    };
    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; toast.style.transition = 'all 0.3s ease'; }, 2800);
    setTimeout(() => toast.remove(), 3200);
}

// Export for use in other scripts
window.showToast = showToast;
window.renderBarChart = renderBarChart;
window.animateStatCards = animateStatCards;
