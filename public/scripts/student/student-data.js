/**
 * Student Data Loader
 * Dynamically fetches and renders data for student dashboard, browse, and my-books pages.
 */

document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();
    if (page === 'dashboard') loadDashboard();
    else if (page === 'browse') loadBrowse();
    else if (page === 'my-books') loadMyBooks();
});

function detectPage() {
    const path = window.location.pathname;
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('browse')) return 'browse';
    if (path.includes('my-books')) return 'my-books';
    return null;
}

function authHeaders() {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('lms_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fallbackCover(url) {
    if (url && (url.startsWith('http') || url.startsWith('/uploads'))) return url;
    return 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=280&fit=crop';
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function authorNames(authors) {
    if (!authors || !authors.length) return 'Unknown Author';
    return authors.map(a => typeof a === 'string' ? a : a.name).join(', ');
}

// ─── DASHBOARD ───────────────────────────────────────────
async function loadDashboard() {
    try {
        const resp = await fetch('/api/student/dashboard', { headers: authHeaders() });
        const data = await resp.json();
        if (!data.success) return;

        const { stats, activeLoans, recentActivity, recommendedBooks } = data.data;
        const user = window.API && API.getUser ? API.getUser() : null;

        // ── Welcome section
        const welcome = document.querySelector('.student-welcome');
        if (welcome) {
            const firstName = user ? (user.firstName || user.name || 'Student') : 'Student';
            const loansCount = stats.activeLoans || 0;
            const holdsCount = stats.holds || 0;
            let summary = `You have ${loansCount} title${loansCount !== 1 ? 's' : ''} on loan`;
            if (holdsCount > 0) summary += ` and ${holdsCount} hold${holdsCount !== 1 ? 's' : ''} active`;
            summary += '. Keep an eye on due dates to stay in good standing.';

            const h2 = welcome.querySelector('h2');
            if (h2) h2.textContent = `Welcome back, ${firstName}`;
            const p = welcome.querySelector('p');
            if (p) p.textContent = summary;

            // Update meta
            const metas = welcome.querySelectorAll('.meta-item');
            if (metas.length >= 1 && user) {
                metas[0].innerHTML = `<span class="material-icons-outlined">school</span>${user.department || 'Student'}`;
            }
            if (metas.length >= 2 && user) {
                metas[1].innerHTML = `<span class="material-icons-outlined">badge</span>ID ${user.studentId || user.id?.substring(0, 8) || '—'}`;
            }
        }

        // ── Profile in topbar
        const nameEl = document.querySelector('.topbar-profile .name');
        const avatarEl = document.querySelector('.topbar-avatar');
        if (nameEl && user) nameEl.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        if (avatarEl && user) {
            const initials = `${(user.firstName || 'S')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase();
            avatarEl.textContent = initials;
        }

        // ── Stat cards
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Books on loan</span>
                        <div class="stat-card-icon blue"><span class="material-icons-outlined">menu_book</span></div>
                    </div>
                    <div class="stat-card-value">${stats.activeLoans}</div>
                    <span class="stat-card-change neutral">Max allowed: ${stats.maxAllowed}</span>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Overdue</span>
                        <div class="stat-card-icon ${stats.overdueLoans > 0 ? 'red' : 'green'}"><span class="material-icons-outlined">${stats.overdueLoans > 0 ? 'warning' : 'check_circle'}</span></div>
                    </div>
                    <div class="stat-card-value">${stats.overdueLoans}</div>
                    <span class="stat-card-change ${stats.overdueLoans > 0 ? 'negative' : 'positive'}">${stats.overdueLoans > 0 ? 'Return ASAP to avoid fines' : 'All books on track!'}</span>
                </div>
            `;
        }

        // ── Currently borrowed table
        const tbody = document.querySelector('.student-loans-table-wrap tbody');
        if (tbody) {
            if (activeLoans.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#94a3b8;">No books currently on loan. <a href="/student/browse" style="color:#6366f1;">Browse the catalog</a></td></tr>`;
            } else {
                tbody.innerHTML = activeLoans.map(loan => {
                    const book = loan.book || {};
                    const duePill = loan.isOverdue ? 'overdue' : loan.daysRemaining <= 3 ? 'soon' : 'ok';
                    const duePillText = loan.isOverdue ? `${loan.daysOverdue}d overdue` : loan.daysRemaining <= 3 ? 'Due soon' : 'On track';
                    return `<tr>
                        <td>
                            <div class="cell-book">
                                <div class="cell-book-cover"><img src="${fallbackCover(book.coverImage)}" alt=""></div>
                                <div class="cell-book-info">
                                    <div class="title">${book.title || 'Unknown'}</div>
                                    <div class="subtitle">${authorNames(book.authors)}</div>
                                </div>
                            </div>
                        </td>
                        <td>${fmtDate(loan.dueDate)}</td>
                        <td><span class="due-pill ${duePill}">${duePillText}</span></td>
                    </tr>`;
                }).join('');
            }
        }

        // ── Suggested books
        const booksRow = document.querySelector('.book-cards-row');
        if (booksRow) {
            if (recommendedBooks.length === 0) {
                booksRow.innerHTML = '<p style="color:#94a3b8;padding:16px;">No recommendations available yet.</p>';
            } else {
                booksRow.innerHTML = recommendedBooks.map(book => {
                    const cat = (book.categories && book.categories[0]) || 'General';
                    return `<div class="book-card">
                        <div class="book-card-cover"><img src="${fallbackCover(book.coverImage)}" alt="${book.title}"></div>
                        <div class="book-card-info">
                            <span class="category-tag">${cat}</span>
                            <h3>${book.title}</h3>
                            <p class="author">by ${authorNames(book.authors)}</p>
                            <span class="status-badge available">Available</span>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // ── Holds section
        const holdSection = document.querySelector('.highlight-blue');
        if (holdSection) {
            if (stats.holds === 0) {
                holdSection.innerHTML = '<p style="color:#6b7280;">You have no active holds. Browse the catalog to place one.</p>';
            }
            // If there are holds, we'd need a separate call, keep as-is for now with count
        }

    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

// ─── BROWSE CATALOG ──────────────────────────────────────
let browseCurrentPage = 1;
let browseDebounce = null;

async function loadBrowse(page = 1) {
    const grid = document.getElementById('browseGrid');
    if (!grid) return;

    // Update topbar profile
    const user = window.API && API.getUser ? API.getUser() : null;
    const nameEl = document.querySelector('.topbar-profile .name');
    const avatarEl = document.querySelector('.topbar-avatar');
    if (nameEl && user) nameEl.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (avatarEl && user) {
        const initials = `${(user.firstName || 'S')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase();
        avatarEl.textContent = initials;
    }

    // Show loading
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#94a3b8;"><span class="material-icons-outlined" style="font-size:40px;display:block;margin-bottom:12px;">hourglass_top</span>Loading books...</div>';

    try {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', '12');

        // Search
        const searchInput = document.getElementById('advancedBrowseSearch');
        if (searchInput && searchInput.value.trim()) {
            params.set('search', searchInput.value.trim());
        }

        // URL query param support
        const urlQ = new URLSearchParams(window.location.search).get('q');
        if (urlQ && !params.get('search')) {
            params.set('search', urlQ);
            if (searchInput) searchInput.value = urlQ;
        }

        // Availability filter
        const availFilter = document.querySelector('.availability-filter:checked');
        if (availFilter && availFilter.value === 'available') {
            params.set('availability', 'available');
        }

        // Category filter
        const catFilter = document.querySelector('.category-filter:checked:not([value="all"])');
        if (catFilter) {
            params.set('category', catFilter.value);
        }

        const resp = await fetch(`/api/student/browse?${params}`, { headers: authHeaders() });
        const data = await resp.json();

        if (!data.success) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#ef4444;">Error loading books</div>';
            return;
        }

        const books = data.data;

        if (books.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:#94a3b8;">
                <span class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">search_off</span>
                <p>No books found. Try a different search.</p>
            </div>`;
            return;
        }

        grid.innerHTML = books.map(book => {
            const available = book.isAvailable;
            const copies = book.availableCopies || 0;
            const isUserBorrowing = book.userStatus === 'borrow';
            const isUserHolding = book.userStatus === 'hold';

            let actionBtn = '';
            if (isUserBorrowing) {
                actionBtn = `<span class="availability-dot borrowed" style="color:#6366f1">Borrowed</span>`;
            } else if (isUserHolding) {
                actionBtn = `<span class="availability-dot" style="color:#f59e0b">On hold</span>`;
            } else if (available) {
                actionBtn = `<span class="availability-dot">${copies} cop${copies !== 1 ? 'ies' : 'y'}</span>
                    <button type="button" class="btn-primary hold-btn btn-hold" data-book-id="${book._id}">Hold</button>`;
            } else {
                actionBtn = `<span class="availability-dot unavailable">Checked out</span>
                    <button type="button" class="btn-outline hold-btn btn-hold" data-book-id="${book._id}">Join queue</button>`;
            }

            return `<article class="browse-card" data-title="${book.title}" data-author="${authorNames(book.authors)}">
                <div class="browse-card-cover">
                    <img src="${fallbackCover(book.coverImage)}" alt="${book.title}" loading="lazy">
                </div>
                <div class="browse-card-body">
                    <h3>${book.title}</h3>
                    <p class="author">${authorNames(book.authors)}</p>
                    <div class="browse-card-actions">${actionBtn}</div>
                </div>
            </article>`;
        }).join('');

        // Re-attach hold buttons
        grid.querySelectorAll('.btn-hold').forEach(btn => {
            btn.addEventListener('click', () => placeHoldAction(btn.dataset.bookId, btn));
        });

        // Animate cards in
        grid.querySelectorAll('.browse-card').forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, i * 60);
        });

        browseCurrentPage = page;

    } catch (e) {
        console.error('Browse load error:', e);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#ef4444;">Could not connect to server</div>';
    }
}

// Place hold action
async function placeHoldAction(bookId, btn) {
    if (!bookId) return;
    btn.disabled = true;
    btn.textContent = 'Placing...';
    try {
        const resp = await fetch('/api/student/hold', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ bookId }),
        });
        const data = await resp.json();
        if (data.success) {
            btn.textContent = '✓ Held';
            btn.classList.remove('btn-primary', 'btn-outline');
            btn.style.background = '#10b981';
            btn.style.color = '#fff';
            btn.style.border = 'none';
            if (window.showStudentToast) showStudentToast('Hold placed successfully!', 'success');
        } else {
            btn.textContent = 'Hold';
            btn.disabled = false;
            if (window.showStudentToast) showStudentToast(data.message || 'Could not place hold', 'error');
        }
    } catch (e) {
        btn.textContent = 'Hold';
        btn.disabled = false;
        if (window.showStudentToast) showStudentToast('Network error', 'error');
    }
}

// Wire up browse search and filters
document.addEventListener('DOMContentLoaded', () => {
    // Search on the browse page
    const advSearch = document.getElementById('advancedBrowseSearch');
    if (advSearch) {
        advSearch.addEventListener('input', () => {
            clearTimeout(browseDebounce);
            browseDebounce = setTimeout(() => loadBrowse(1), 400);
        });
    }

    // Clear button
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn && advSearch) {
        advSearch.addEventListener('input', () => {
            clearBtn.style.display = advSearch.value ? 'flex' : 'none';
        });
        clearBtn.addEventListener('click', () => {
            advSearch.value = '';
            clearBtn.style.display = 'none';
            loadBrowse(1);
        });
    }

    // Filter apply/reset
    const filterApply = document.getElementById('filterApplyBtn');
    const filterReset = document.getElementById('filterResetBtn');
    const filterToggle = document.getElementById('filterToggle');
    const filterPanel = document.getElementById('searchFilterPanel');

    if (filterToggle && filterPanel) {
        filterToggle.addEventListener('click', () => {
            filterPanel.classList.toggle('open');
        });
    }
    if (filterApply) {
        filterApply.addEventListener('click', () => {
            if (filterPanel) filterPanel.classList.remove('open');
            loadBrowse(1);
        });
    }
    if (filterReset) {
        filterReset.addEventListener('click', () => {
            document.querySelectorAll('.availability-filter, .category-filter').forEach(cb => cb.checked = false);
            const allCat = document.querySelector('.category-filter[value="all"]');
            if (allCat) allCat.checked = true;
            loadBrowse(1);
        });
    }
});

// ─── MY BOOKS ────────────────────────────────────────────
async function loadMyBooks() {
    const tbody = document.getElementById('myBooksBody');
    if (!tbody) return;

    // Show loading
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#94a3b8;">Loading your books...</td></tr>';

    // Update topbar profile
    const user = window.API && API.getUser ? API.getUser() : null;
    const nameEl = document.querySelector('.topbar-profile .name');
    const avatarEl = document.querySelector('.topbar-avatar');
    if (nameEl && user) nameEl.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (avatarEl && user) {
        const initials = `${(user.firstName || 'S')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase();
        avatarEl.textContent = initials;
    }

    try {
        const resp = await fetch('/api/student/my-books?limit=50', { headers: authHeaders() });
        const data = await resp.json();

        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#ef4444;">Error loading books</td></tr>';
            return;
        }

        const loans = data.data;

        // Footer
        const footerInfo = document.querySelector('.table-footer-info');
        if (footerInfo) {
            footerInfo.innerHTML = `Showing <strong>${loans.length}</strong> active loan${loans.length !== 1 ? 's' : ''}`;
        }

        if (loans.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#94a3b8;">
                <span class="material-icons-outlined" style="font-size:40px;display:block;margin-bottom:8px;">library_books</span>
                You have no active loans. <a href="/student/browse" style="color:#6366f1;">Browse the catalog</a>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = loans.map(loan => {
            const book = loan.book || {};
            const daysRem = loan.daysRemaining || 0;
            const renewalsLeft = (loan.maxRenewals || 2) - (loan.renewalCount || 0);
            const canRenew = loan.canRenew;

            let duePillClass = 'ok';
            let duePillText = fmtDate(loan.dueDate);
            if (loan.daysOverdue > 0) {
                duePillClass = 'overdue';
                duePillText = `${loan.daysOverdue}d overdue!`;
            } else if (daysRem <= 3) {
                duePillClass = 'soon';
            }

            const renewBtn = canRenew
                ? `<button type="button" class="action-btn renew-btn" title="Renew" data-id="${loan._id}"><span class="material-icons-outlined">autorenew</span></button>`
                : `<button type="button" class="action-btn" disabled title="No renewals left"><span class="material-icons-outlined">block</span></button>`;

            return `<tr data-title="${book.title || ''}" data-author="${authorNames(book.authors)}">
                <td>
                    <div class="cell-book">
                        <div class="cell-book-cover"><img src="${fallbackCover(book.coverImage)}" alt=""></div>
                        <div class="cell-book-info">
                            <div class="title">${book.title || 'Unknown'}</div>
                            <div class="subtitle">${authorNames(book.authors)}${book.isbn ? ' · ISBN ' + book.isbn : ''}</div>
                        </div>
                    </div>
                </td>
                <td>${fmtDate(loan.borrowDate || loan.createdAt)}</td>
                <td><span class="due-pill ${duePillClass}">${duePillText}</span></td>
                <td>${renewalsLeft}</td>
                <td>${renewBtn}</td>
            </tr>`;
        }).join('');

        // Wire up renew buttons
        tbody.querySelectorAll('.renew-btn').forEach(btn => {
            btn.addEventListener('click', () => renewBook(btn.dataset.id, btn));
        });

    } catch (e) {
        console.error('My books load error:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#ef4444;">Could not connect to server</td></tr>';
    }
}

// Renew book action
async function renewBook(transactionId, btn) {
    if (!transactionId) return;
    btn.disabled = true;
    try {
        const resp = await fetch(`/api/transactions/${transactionId}/renew`, {
            method: 'POST',
            headers: authHeaders(),
        });
        const data = await resp.json();
        if (data.success) {
            if (window.showStudentToast) showStudentToast('Book renewed successfully!', 'success');
            loadMyBooks(); // Refresh
        } else {
            btn.disabled = false;
            if (window.showStudentToast) showStudentToast(data.message || 'Could not renew', 'error');
        }
    } catch (e) {
        btn.disabled = false;
        if (window.showStudentToast) showStudentToast('Network error', 'error');
    }
}
