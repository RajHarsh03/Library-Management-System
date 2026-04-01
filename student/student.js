// Student portal — shared behavior

document.addEventListener('DOMContentLoaded', () => {
    initStudentSidebar();
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
                window.location.href = '../index.html';
            }
        });
    }
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
