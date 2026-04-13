// Student portal — shared behavior

document.addEventListener('DOMContentLoaded', () => {
    checkMaintenanceMode();
    initStudentSidebar();
    initSidebarCollapse('lms-student-sidebar-collapsed');
    initStudentTopbar();
    initStudentTableSearch();
    initBrowseSearch();
});

// ===== Maintenance Mode Check =====
async function checkMaintenanceMode() {
    try {
        const resp = await fetch('/api/settings/public');
        const data = await resp.json();
        if (data.success && data.data && data.data.maintenanceMode) {
            showMaintenanceBanner(data.data.maintenanceMessage);
        }
    } catch (e) { /* fail silently */ }
}

function showMaintenanceBanner(message) {
    const content = document.querySelector('.page-content') || document.querySelector('.content-area') || document.querySelector('.main-content');
    if (!content) return;
    const banner = document.createElement('div');
    banner.style.cssText = `
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 48px 32px; margin: 32px auto; max-width: 520px; text-align: center;
        background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #f59e0b;
        border-radius: 16px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.15);
    `;
    banner.innerHTML = `
        <span class="material-icons-outlined" style="font-size:48px;color:#d97706;margin-bottom:12px;">construction</span>
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.2rem;color:#92400e;margin-bottom:8px;">System Under Maintenance</h3>
        <p style="font-size:0.88rem;color:#78350f;line-height:1.6;">${message || 'The library system is currently under maintenance. Please try again later.'}</p>
    `;
    // Insert at the top of content
    content.insertBefore(banner, content.firstChild);
}

function initStudentSidebar() {
    const file = window.location.pathname.split('/').pop().replace('.html', '');
    document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
        if (item.getAttribute('data-page') === file) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Sign out of your student account?')) {
                if (window.API) API.clearAuth();
                window.location.href = '/login';
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

function initStudentTopbar() {
    const searchInput = document.querySelector('.topbar-search input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = searchInput.value.trim();
                if (q) {
                    window.location.href = 'browse.html?q=' + encodeURIComponent(q);
                }
            }
        });
    }

    // ─── Notification Panel ───
    initStudentNotificationPanel();

    // ─── Help Modal ───
    initStudentHelpModal();
}

// ===== STUDENT NOTIFICATION PANEL =====
function initStudentNotificationPanel() {
    const notifBtn = document.getElementById('notificationBtn');
    if (!notifBtn) return;

    injectStudentPanelStyles();

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
        if (panelOpen) loadStudentNotifications();
    });

    document.addEventListener('click', (e) => {
        if (panelOpen && !panel.contains(e.target) && !notifBtn.contains(e.target)) {
            panelOpen = false;
            panel.classList.remove('open');
        }
    });

    document.getElementById('notifMarkAll').addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('lms_token') || (window.API && API.getToken && API.getToken());
            await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            loadStudentNotifications();
            loadStudentUnreadCount();
        } catch (e) { /* ignore */ }
    });

    loadStudentUnreadCount();
    setInterval(loadStudentUnreadCount, 60000);
}

async function loadStudentNotifications() {
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
            const timeAgo = studentTimeAgo(n.createdAt);
            const iconColors = {
                maintenance: '#f59e0b', system: '#3b82f6', overdue: '#ef4444',
                due_reminder: '#f97316', account: '#8b5cf6', registration: '#10b981',
                fine: '#ef4444', borrow: '#0ea5e9', return: '#22c55e',
            };
            const color = iconColors[n.type] || '#6b7280';
            const readClass = n.read ? 'read' : '';

            return `<div class="notif-item ${readClass}" data-id="${n._id}" onclick="markStudentNotifRead('${n._id}', this)">
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

async function loadStudentUnreadCount() {
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

window.markStudentNotifRead = async function (id, el) {
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
        loadStudentUnreadCount();
    } catch (e) { /* ignore */ }
};

function studentTimeAgo(dateStr) {
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

// ===== STUDENT HELP MODAL =====
function initStudentHelpModal() {
    const helpBtn = document.getElementById('helpBtn');
    if (!helpBtn) return;

    const faqs = [
        { q: 'How do I borrow a book?', a: 'Visit the Browse Catalog page, find the book you want, and click "Borrow". The librarian will process the request and assign a due date based on the library\'s loan policy.' },
        { q: 'How do I return a book?', a: 'Bring the physical book to the library circulation desk. The librarian will process the return in the system. You\'ll receive a notification confirming the return.' },
        { q: 'How do I renew a borrowed book?', a: 'Go to My Books → find the active loan → click the Renew button. Renewals are subject to library policy limits. You cannot renew if the book is reserved by another student.' },
        { q: 'How are late fines calculated?', a: 'Fines start after a grace period and are charged per day overdue, capped at a maximum amount. Check your My Books page for any outstanding fines. Contact the library to pay fines.' },
        { q: 'What does "System Under Maintenance" mean?', a: 'When the library system is in maintenance mode, you cannot borrow, return, or renew books online. The library staff is performing updates. Try again later.' },
        { q: 'How do I search for a specific book?', a: 'Use the search bar at the top of any page, or go to Browse Catalog and use the filters (genre, availability) to narrow your search by title, author, or subject.' },
        { q: 'What is my borrowing limit?', a: 'Your borrowing limit is set by the library administrator. Check My Books to see how many books you currently have on loan versus your maximum allowed.' },
        { q: 'How do I update my profile information?', a: 'Currently, profile updates must be requested through the library administrator. Contact the front desk or send an email to the library.' },
    ];

    const overlay = document.createElement('div');
    overlay.className = 'help-overlay';
    overlay.id = 'helpOverlay';

    const modal = document.createElement('div');
    modal.className = 'help-modal';
    modal.id = 'helpModal';
    modal.innerHTML = `
        <div class="help-modal-header">
            <h3><span class="material-icons-outlined" style="vertical-align:middle;margin-right:8px;color:#6366f1;">help_outline</span>Help & FAQ</h3>
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

function injectStudentPanelStyles() {
    if (document.getElementById('student-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'student-panel-styles';
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
            width: 8px; height: 8px; min-width: 8px; border-radius: 50%; background: #6366f1;
            margin-top: 6px;
        }
        .notif-empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 0.82rem; }
        .notif-loading { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 0.82rem; }
        .notification-dot { display: none; }

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

function initStudentTableSearch() {
    const input = document.getElementById('myBooksSearch');
    const tbody = document.getElementById('myBooksBody');
    if (!input || !tbody) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        tbody.querySelectorAll('tr[data-title]').forEach((row) => {
            const title = (row.getAttribute('data-title') || '').toLowerCase();
            const author = (row.getAttribute('data-author') || '').toLowerCase();
            const match = !q || title.includes(q) || author.includes(q);
            row.style.display = match ? '' : 'none';
        });
    });
}

function initBrowseSearch() {
    if (document.getElementById('browseGrid')) {
        return;
    }
    const input = document.getElementById('browseSearch');
    if (input) {
        input.addEventListener('input', () => {
            filterBrowseCards(input.value);
        });
    }
}

function filterBrowseCards(query) {
    const q = (query || '').trim().toLowerCase();
    document.querySelectorAll('.browse-card[data-title]').forEach((card) => {
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const author = (card.getAttribute('data-author') || '').toLowerCase();
        const match = !q || title.includes(q) || author.includes(q);
        card.style.display = match ? '' : 'none';
    });
}

// ===== Enhanced Interactions =====

// Add ripple effect to buttons
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-primary, .btn-outline, .btn-hold, .btn-dark, .action-btn, .topbar-icon-btn');
    if (!btn) return;
    
    const ripple = document.createElement('span');
    ripple.style.cssText = `
        position: absolute;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: student-ripple 0.6s ease-out;
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
const studentRippleStyle = document.createElement('style');
studentRippleStyle.textContent = `
    @keyframes student-ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(studentRippleStyle);

// Enhanced browse card interactions
document.querySelectorAll('.browse-card').forEach((card, index) => {
    // Stagger animation on load
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
        card.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, index * 100);
    
    // Enhanced hover
    card.addEventListener('mouseenter', () => {
        const img = card.querySelector('.browse-card-cover img');
        if (img) {
            img.style.transform = 'scale(1.1)';
        }
    });
    
    card.addEventListener('mouseleave', () => {
        const img = card.querySelector('.browse-card-cover img');
        if (img) {
            img.style.transform = 'scale(1)';
        }
    });
});

// Stat card counter animation
function animateStudentStatCards() {
    const statValues = document.querySelectorAll('.stat-card-value');
    statValues.forEach((el, index) => {
        const finalValue = el.textContent;
        const isNumber = /^[\d]+$/.test(finalValue);
        
        if (isNumber) {
            const target = parseInt(finalValue);
            let current = 0;
            const duration = 800;
            const stepTime = duration / 30;
            
            el.textContent = '0';
            
            setTimeout(() => {
                const timer = setInterval(() => {
                    current += target / 30;
                    if (current >= target) {
                        el.textContent = finalValue;
                        clearInterval(timer);
                    } else {
                        el.textContent = Math.floor(current);
                    }
                }, stepTime);
            }, index * 200);
        }
    });
}

// Run stat card animation on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(animateStudentStatCards, 400);
});

// Toast notification helper
function showStudentToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createStudentToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 12px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04);
        border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1'};
        font-size: 0.9rem;
        animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
    `;
    
    const icons = {
        success: 'check_circle',
        error: 'error_outline',
        info: 'info',
        warning: 'warning'
    };
    
    toast.innerHTML = `
        <span class="material-icons-outlined" style="color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1'};">${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

function createStudentToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    document.body.appendChild(container);
    return container;
}

// Add toast animations
const studentToastStyle = document.createElement('style');
studentToastStyle.textContent = `
    @keyframes toastSlideIn {
        from { opacity: 0; transform: translateX(100%) scale(0.9); }
        to { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes toastSlideOut {
        to { opacity: 0; transform: translateX(100%) scale(0.9); }
    }
`;
document.head.appendChild(studentToastStyle);

// Export for use in other scripts
window.showStudentToast = showStudentToast;
window.filterBrowseCards = filterBrowseCards;
