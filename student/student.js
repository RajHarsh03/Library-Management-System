// Student portal — shared behavior

document.addEventListener('DOMContentLoaded', () => {
    initStudentSidebar();
    initSidebarCollapse('lms-student-sidebar-collapsed');
    initStudentTopbar();
    initStudentTableSearch();
    initBrowseSearch();
});

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
                window.location.href = '../index';
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

function initStudentTopbar() {
    const searchInput = document.querySelector('.topbar-search input');
    if (!searchInput) return;

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const q = searchInput.value.trim();
            if (q) {
                window.location.href = 'browse?q=' + encodeURIComponent(q);
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
