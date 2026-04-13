/**
 * Student Data Loader
 * Dynamically fetches and renders data for student dashboard, browse, and my-books pages.
 */

document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();
    if (page === 'dashboard') loadDashboard();
    else if (page === 'browse') loadBrowse();
    else if (page === 'my-books') loadMyBooks();
    else if (page === 'account') loadAccount();
});

function detectPage() {
    const path = window.location.pathname;
    if (path.includes('account')) return 'account';
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

        // ── Topbar profile
        updateTopbar(user);

        // ── Greeting
        const hour = new Date().getHours();
        let greet = 'Good evening';
        if (hour < 12) greet = 'Good morning';
        else if (hour < 17) greet = 'Good afternoon';

        const greetEl = document.getElementById('dashGreeting');
        const nameSpan = document.getElementById('dashUserName');
        if (greetEl && nameSpan && user) {
            const firstName = user.firstName || user.name || 'Student';
            nameSpan.textContent = firstName;
            greetEl.innerHTML = `${greet}, <span>${firstName}</span>`;
        }

        // ── Date
        const dateEl = document.getElementById('dashDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
            });
        }

        // ── Stat cards
        setText('statLoans', stats.activeLoans ?? 0);
        setText('statOverdue', stats.overdueLoans ?? 0);
        setText('statHolds', stats.holds ?? 0);
        setText('statReturned', stats.returned ?? 0);

        // ── Currently borrowed table (or latest borrows if none active)
        const tbody = document.getElementById('dashLoansBody');
        const titleEl = document.getElementById('dashBorrowedTitle');
        if (tbody) {
            // Determine which dataset to show
            let displayLoans = activeLoans;
            let showingRecent = false;

            if ((!activeLoans || activeLoans.length === 0) && data.data.recentBorrows && data.data.recentBorrows.length > 0) {
                displayLoans = data.data.recentBorrows;
                showingRecent = true;
            }

            if (titleEl) titleEl.textContent = showingRecent ? 'Latest Borrows' : 'Currently Borrowed';

            if (!displayLoans || displayLoans.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="dash-empty-cell">No books on loan. <a href="/student/browse" style="color:#6366f1;">Browse the catalog</a></td></tr>`;
            } else {
                tbody.innerHTML = displayLoans.slice(0, 5).map(loan => {
                    const book = loan.book || {};
                    let duePill, duePillText;
                    if (loan.isReturned || loan.status === 'returned') {
                        duePill = 'returned';
                        duePillText = 'Returned';
                    } else if (loan.isOverdue) {
                        duePill = 'overdue';
                        duePillText = `${loan.daysOverdue}d overdue`;
                    } else if (loan.daysRemaining <= 3) {
                        duePill = 'soon';
                        duePillText = 'Due soon';
                    } else {
                        duePill = 'ok';
                        duePillText = 'On track';
                    }
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

        // ── Recommended books
        const booksRow = document.getElementById('dashRecommended');
        if (booksRow) {
            if (!recommendedBooks || recommendedBooks.length === 0) {
                booksRow.innerHTML = '<p class="dash-empty-text">No recommendations yet. Start borrowing to get suggestions.</p>';
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

        // ── Notices
        loadStudentNotices();

    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

// ── Load student notices from /api/notices
async function loadStudentNotices() {
    const container = document.getElementById('dashNotifList');
    if (!container) return;

    try {
        const resp = await fetch('/api/notices?limit=5', { headers: authHeaders() });
        const data = await resp.json();

        if (!data.success || !data.data || data.data.length === 0) {
            container.innerHTML = '<p class="dash-empty-text">No new notices</p>';
            return;
        }

        container.innerHTML = data.data.map(n => {
            const timeAgo = studentTimeAgo(n.createdAt);
            const priorityIcons = { urgent: 'error', important: 'warning_amber', normal: 'campaign' };
            const icon = priorityIcons[n.priority] || 'campaign';
            const priorityLabel = n.priority !== 'normal'
                ? `<span class="notice-priority ${n.priority}">${n.priority}</span>` : '';

            return `<div class="notice-item ${n.priority}">
                <div class="notice-icon">
                    <span class="material-icons-outlined">${icon}</span>
                </div>
                <div class="notice-body">
                    <div class="notice-title">${n.title}${priorityLabel}</div>
                    <div class="notice-msg">${n.message}</div>
                    <div class="notice-meta">${timeAgo}${n.publishedBy ? ' · ' + n.publishedBy : ''}</div>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Failed to load notices:', e);
    }
}

// ── Helper: update topbar profile
function updateTopbar(user) {
    const nameEl = document.querySelector('.topbar-profile .name');
    const avatarEl = document.querySelector('.topbar-avatar');
    if (nameEl && user) nameEl.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (avatarEl && user) {
        const initials = `${(user.firstName || 'S')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase();
        avatarEl.textContent = initials;
    }
}

// ── Helper: set text by ID
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ─── BROWSE CATALOG ──────────────────────────────────────
let browseCurrentPage = 1;
let browseDebounce = null;

async function loadBrowse(page = 1) {
    const grid = document.getElementById('browseGrid');
    if (!grid) return;

    // Update topbar profile
    updateTopbar(window.API && API.getUser ? API.getUser() : null);

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

        // Sort
        const sortSelect = document.getElementById('sortBySelect');
        if (sortSelect && sortSelect.value) {
            params.set('sortBy', sortSelect.value);
        }

        // Availability filter — collect all checked
        const availChecked = document.querySelectorAll('.availability-filter:checked');
        if (availChecked.length > 0) {
            const vals = Array.from(availChecked).map(cb => cb.value);
            // If only 'available' is checked, filter to available
            if (vals.includes('available') && !vals.includes('unavailable')) {
                params.set('availability', 'available');
            } else if (vals.includes('unavailable') && !vals.includes('available')) {
                params.set('availability', 'unavailable');
            }
            // If both checked, no filter needed (show all)
        }

        // Category filter — collect all checked (skip 'all')
        const catChecked = document.querySelectorAll('.category-filter:checked:not([value="all"])');
        if (catChecked.length > 0) {
            const categories = Array.from(catChecked).map(cb => cb.value).join(',');
            params.set('category', categories);
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
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!filterPanel.contains(e.target) && !filterToggle.contains(e.target)) {
                filterPanel.classList.remove('open');
            }
        });
    }

    // Category "All" toggle logic
    document.querySelectorAll('.category-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.value === 'all' && cb.checked) {
                // Uncheck all specific categories
                document.querySelectorAll('.category-filter:not([value="all"])').forEach(c => c.checked = false);
            } else if (cb.value !== 'all') {
                // Uncheck "All" when a specific category is checked
                const allCb = document.querySelector('.category-filter[value="all"]');
                if (allCb) allCb.checked = false;
                // If nothing is checked, re-check "All"
                const anyChecked = document.querySelector('.category-filter:checked');
                if (!anyChecked && allCb) allCb.checked = true;
            }
        });
    });

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
            const sortSelect = document.getElementById('sortBySelect');
            if (sortSelect) sortSelect.value = 'popularity';
            if (filterPanel) filterPanel.classList.remove('open');
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

// ─── ACCOUNT PAGE ────────────────────────────────────────
let accountUserData = null; // store for edit/cancel

async function loadAccount() {
    // Fetch fresh profile data from server instead of localStorage
    let user = null;
    try {
        const profileResp = await fetch('/api/auth/me', { headers: authHeaders() });
        const profileData = await profileResp.json();
        if (profileData.success && profileData.data && profileData.data.user) {
            user = profileData.data.user;
        }
    } catch (e) {
        console.warn('Could not fetch fresh profile, using cached data');
    }
    // Fallback to localStorage
    if (!user) user = window.API && API.getUser ? API.getUser() : null;
    if (!user) return;

    accountUserData = { ...user };
    updateTopbar(user);

    // Profile card
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
    const initials = `${(user.firstName || 'S')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase();

    const avatarEl = document.getElementById('accountAvatar');
    if (avatarEl) avatarEl.textContent = initials;

    setText('accountName', fullName);

    const roleEl = document.getElementById('accountRole');
    if (roleEl) roleEl.textContent = (user.role || 'student').toUpperCase();

    const joinedEl = document.getElementById('accountJoined');
    if (joinedEl && user.createdAt) {
        const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
            month: 'long', year: 'numeric'
        });
        joinedEl.innerHTML = `<span class="material-icons-outlined">calendar_today</span>Member since ${joinDate}`;
    }

    // Personal information
    setText('fieldFirstName', user.firstName || '—');
    setText('fieldLastName', user.lastName || '—');
    setText('fieldEmail', user.email || '—');
    setText('fieldPhone', user.phone || 'Not provided');

    // Library information — 'course' is the backend field for department
    setText('fieldStudentId', user.studentId || user.id?.substring(0, 10) || '—');
    setText('fieldDepartment', user.course || user.department || 'General');

    const statusEl = document.getElementById('fieldStatus');
    if (statusEl) {
        const isActive = user.status !== 'inactive' && user.status !== 'suspended';
        statusEl.innerHTML = `<span class="status-dot ${isActive ? 'active' : 'inactive'}"></span> ${isActive ? 'Active' : 'Suspended'}`;
    }

    setText('fieldLimit', user.maxBooksAllowed || '10');

    // Fetch stats from dashboard API
    try {
        const resp = await fetch('/api/student/dashboard', { headers: authHeaders() });
        const data = await resp.json();
        if (data.success) {
            const { stats } = data.data;
            setText('acctStatLoans', stats.activeLoans ?? 0);
            setText('acctStatReturned', stats.returned ?? 0);
            setText('acctStatHolds', stats.holds ?? 0);
            setText('acctStatOverdue', stats.overdueLoans ?? 0);
        }
    } catch (e) {
        console.error('Account stats error:', e);
    }
}

// ── Toggle Edit Mode
function toggleEditMode() {
    document.getElementById('editProfileBtn').style.display = 'none';
    document.getElementById('editActions').style.display = 'flex';

    // Populate inputs from current values and show them
    const fieldMap = {
        inputFirstName: 'fieldFirstName',
        inputLastName: 'fieldLastName',
        inputPhone: 'fieldPhone',
        inputDepartment: 'fieldDepartment',
    };

    for (const [inputId, valueId] of Object.entries(fieldMap)) {
        const input = document.getElementById(inputId);
        const display = document.getElementById(valueId);
        if (input && display) {
            const val = display.textContent.trim();
            input.value = (val === '—' || val === 'Not provided') ? '' : val;
            display.style.display = 'none';
            input.style.display = 'block';
            input.closest('.account-field')?.classList.add('editing');
        }
    }
}

// ── Cancel Edit
function cancelEdit() {
    document.getElementById('editProfileBtn').style.display = 'inline-flex';
    document.getElementById('editActions').style.display = 'none';

    // Hide inputs, show values
    document.querySelectorAll('.account-field-input').forEach(input => {
        input.style.display = 'none';
        input.closest('.account-field')?.classList.remove('editing');
    });
    document.querySelectorAll('.account-field-value').forEach(el => {
        el.style.display = 'flex';
    });
}

// ── Save Profile
async function saveProfile() {
    const firstName = document.getElementById('inputFirstName')?.value.trim();
    const lastName = document.getElementById('inputLastName')?.value.trim();
    const phone = document.getElementById('inputPhone')?.value.trim();
    const department = document.getElementById('inputDepartment')?.value.trim();

    if (!firstName || !lastName) {
        if (window.showStudentToast) showStudentToast('First name and last name are required', 'error');
        return;
    }

    const saveBtn = document.getElementById('saveProfileBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="material-icons-outlined">hourglass_top</span> Saving...';

    try {
        const resp = await fetch('/api/student/profile', {
            method: 'PUT',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ firstName, lastName, phone, department }),
        });

        const data = await resp.json();

        if (data.success) {
            // Update localStorage with new data
            const currentUser = window.API && API.getUser ? API.getUser() : {};
            const updatedUser = {
                ...currentUser,
                firstName: data.data.user.firstName,
                lastName: data.data.user.lastName,
                phone: data.data.user.phone,
                course: data.data.user.department,
            };
            localStorage.setItem('auth_user', JSON.stringify(updatedUser));

            // Update display values
            setText('fieldFirstName', data.data.user.firstName || '—');
            setText('fieldLastName', data.data.user.lastName || '—');
            setText('fieldPhone', data.data.user.phone || 'Not provided');
            setText('fieldDepartment', data.data.user.department || 'General');

            // Update profile card & topbar
            const fullName = `${data.data.user.firstName} ${data.data.user.lastName}`.trim();
            setText('accountName', fullName);
            const initials = `${data.data.user.firstName[0]}${data.data.user.lastName[0] || ''}`.toUpperCase();
            const avatarEl = document.getElementById('accountAvatar');
            if (avatarEl) avatarEl.textContent = initials;
            updateTopbar(updatedUser);

            cancelEdit();
            if (window.showStudentToast) showStudentToast('Profile updated successfully!', 'success');
        } else {
            if (window.showStudentToast) showStudentToast(data.message || 'Failed to update', 'error');
        }
    } catch (e) {
        console.error('Save profile error:', e);
        if (window.showStudentToast) showStudentToast('Network error — could not save', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-outlined">check</span> Save';
    }
}
