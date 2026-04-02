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
                window.location.href = '../auth/index.html';
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

/** Collapse / expand sidebar (desktop). Preference stored in localStorage. */
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

    try {
        if (localStorage.getItem(storageKey) === '1' && window.innerWidth > 768) {
            applyCollapsed(true);
        }
    } catch (e) { /* ignore */ }

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
    const searchInput = document.querySelector('.topbar-search input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    // Handle search - for now just log
                    console.log('Search:', query);
                }
            }
        });
    }

    // Notification bell
    const notifBtn = document.querySelector('.topbar-icon-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            // Toggle notification panel
            const dot = notifBtn.querySelector('.notification-dot');
            if (dot) dot.style.display = 'none';
        });
    }
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

function generateTopbarHTML(searchPlaceholder, userName, userRole) {
    return `
    <div class="topbar-search">
        <span class="material-icons-outlined">search</span>
        <input type="text" placeholder="${searchPlaceholder}" id="topbarSearch">
    </div>
    <div class="topbar-right">
        <button class="topbar-icon-btn" id="notificationBtn">
            <span class="material-icons-outlined">notifications</span>
            <span class="notification-dot"></span>
        </button>
        <button class="topbar-icon-btn" id="helpBtn">
            <span class="material-icons-outlined">help_outline</span>
        </button>
        <div class="topbar-profile">
            <div class="topbar-profile-info">
                <div class="name">${userName}</div>
                <div class="role">${userRole}</div>
            </div>
            <div class="topbar-avatar">${userName.split(' ').map(n => n[0]).join('')}</div>
        </div>
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
        bar.style.height = heightPct + '%';
        
        if (d.label) {
            const label = document.createElement('span');
            label.className = 'bar-label';
            label.textContent = d.label;
            bar.appendChild(label);
        }

        container.appendChild(bar);
    });
}
