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
    if (!searchInput) return;

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
