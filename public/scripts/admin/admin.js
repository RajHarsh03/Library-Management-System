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
        // Update every minute to stay real-time
        setInterval(updateGreeting, 60000);
    }

    // Notification bell
    const notifBtn = document.querySelector('.topbar-icon-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
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
    const container = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} toast-enhanced`;
    
    const icons = {
        success: 'check_circle',
        error: 'error_outline',
        info: 'info',
        warning: 'warning'
    };
    
    toast.innerHTML = `
        <span class="material-icons-outlined">${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
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

// Export for use in other scripts
window.showToast = showToast;
window.renderBarChart = renderBarChart;
window.animateStatCards = animateStatCards;
