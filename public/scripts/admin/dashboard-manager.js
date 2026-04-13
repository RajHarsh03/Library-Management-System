/**
 * Dashboard Manager
 * Fetches live data from APIs and populates dashboard widgets
 */
(function () {
    'use strict';

    // ===== Helpers =====
    function timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function setStatText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ===== Fetch Stats =====
    async function fetchBookStats() {
        try {
            const res = await API.get('/books/stats');
            if (res.success && res.data) {
                const ov = res.data.overview;
                setStatText('statTotalBooks', ov.totalBooks);
                setStatText('statAvailable', ov.availableCopies);
            }
        } catch (err) {
            console.error('Failed to fetch book stats:', err);
            setStatText('statTotalBooks', '0');
            setStatText('statAvailable', '0');
        }
    }

    async function fetchUserStats() {
        try {
            const res = await API.get('/users/stats');
            if (res.success && res.data) {
                const ov = res.data.overview;
                setStatText('statTotalUsers', ov.total);
                setStatText('statActiveUsers', ov.active);
            }
        } catch (err) {
            console.error('Failed to fetch user stats:', err);
            setStatText('statTotalUsers', '0');
            setStatText('statActiveUsers', '0');
        }
    }

    async function fetchTransactionStats() {
        try {
            const res = await API.get('/transactions/stats');
            if (res.success && res.data) {
                const ov = res.data.overview;
                setStatText('statOverdue', ov.overdue);
                setStatText('statActiveLoans', ov.active);
                setStatText('statTodayBorrowed', ov.todayBorrowed);
                setStatText('statTodayReturned', ov.todayReturned);

                // Render recent activity
                renderRecentActivity(res.data.recentActivity || []);
            }
        } catch (err) {
            console.error('Failed to fetch transaction stats:', err);
            setStatText('statOverdue', '0');
            setStatText('statActiveLoans', '0');
            setStatText('statTodayBorrowed', '0');
            setStatText('statTodayReturned', '0');
            renderRecentActivity([]);
        }
    }

    // ===== Fetch Recent Books =====
    async function fetchRecentBooks() {
        const container = document.getElementById('recentBooksContainer');
        if (!container) return;

        try {
            const res = await API.get('/books?limit=4&sort=-createdAt');
            if (res.success && res.data) {
                const books = res.data.books || res.data;
                if (Array.isArray(books) && books.length > 0) {
                    container.innerHTML = books.map(book => renderBookCard(book)).join('');
                } else {
                    container.innerHTML = `
                        <div class="dash-empty">
                            <span class="material-icons-outlined">library_books</span>
                            <p>No books added yet</p>
                            <a href="books.html" class="dash-empty-link">Add your first book</a>
                        </div>`;
                }
            }
        } catch (err) {
            console.error('Failed to fetch recent books:', err);
            container.innerHTML = `
                <div class="dash-empty">
                    <span class="material-icons-outlined">error_outline</span>
                    <p>Could not load books</p>
                </div>`;
        }
    }

    function renderBookCard(book) {
        const title = book.title || 'Untitled';
        const author = book.authors && book.authors.length > 0
            ? book.authors.map(a => a.name || a).join(', ')
            : 'Unknown Author';
        const isbn = book.isbn || book.isbn13 || 'N/A';
        const status = book.status || 'available';
        const category = book.categories && book.categories.length > 0
            ? book.categories[0]
            : 'General';

        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const categoryClass = category.toLowerCase().replace(/\s+/g, '-');
        const coverUrl = book.coverImage
            || `https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=280&fit=crop`;

        return `
            <div class="book-card">
                <div class="book-card-cover">
                    <img src="${coverUrl}" alt="${title}" onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=280&fit=crop'">
                </div>
                <div class="book-card-info">
                    <span class="category-tag ${categoryClass}">${category}</span>
                    <h3>${title}</h3>
                    <p class="author">by ${author}</p>
                    <div class="isbn">
                        <span class="material-icons-outlined" style="font-size:0.9rem">qr_code_2</span>
                        <span>ISBN: ${isbn}</span>
                    </div>
                    <span class="status-badge ${status}">${statusLabel}</span>
                </div>
            </div>`;
    }

    // ===== Render Recent Activity =====
    function renderRecentActivity(transactions) {
        const container = document.getElementById('recentActivityContainer');
        if (!container) return;

        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="dash-empty">
                    <span class="material-icons-outlined">swap_horiz</span>
                    <p>No recent activity</p>
                </div>`;
            return;
        }

        container.innerHTML = transactions.slice(0, 5).map(tx => {
            const userName = tx.user
                ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim()
                : 'Unknown';
            const bookTitle = tx.book ? (tx.book.title || 'Unknown Book') : 'Unknown Book';
            const time = timeAgo(tx.createdAt);

            let iconClass, icon, actionText, statusClass, statusText;

            if (tx.status === 'completed') {
                iconClass = 'returned';
                icon = 'check_circle';
                actionText = `Returned: ${bookTitle}`;
                statusClass = 'on-time';
                statusText = 'Returned';
            } else if (tx.status === 'overdue') {
                iconClass = 'overdue';
                icon = 'warning';
                actionText = `Overdue: ${bookTitle}`;
                statusClass = 'expired';
                statusText = 'Overdue';
            } else {
                iconClass = 'issued';
                icon = 'call_made';
                actionText = `Borrowed: ${bookTitle}`;
                statusClass = 'days';
                statusText = 'Active';
            }

            return `
                <div class="ledger-item">
                    <div class="ledger-icon ${iconClass}">
                        <span class="material-icons-outlined">${icon}</span>
                    </div>
                    <div class="ledger-info">
                        <div class="name">${userName}</div>
                        <div class="detail">${actionText}</div>
                    </div>
                    <div class="ledger-meta">
                        <div class="time">${time.toUpperCase()}</div>
                        <div class="status ${statusClass}">${statusText}</div>
                    </div>
                </div>`;
        }).join('');
    }

    // ===== Notice Management =====
    function initNoticeForm() {
        const form = document.getElementById('noticeForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('noticeSubmitBtn');
            const title = document.getElementById('noticeTitle').value.trim();
            const message = document.getElementById('noticeMessage').value.trim();
            const priority = document.getElementById('noticePriority').value;

            if (!title || !message) return;

            btn.disabled = true;
            btn.textContent = 'Publishing...';

            try {
                const res = await API.post('/notices', { title, message, priority });
                if (res.success) {
                    form.reset();
                    if (window.showToast) showToast('Notice published!', 'success');
                    loadAdminNotices();
                } else {
                    if (window.showToast) showToast(res.message || 'Failed to publish', 'error');
                }
            } catch (err) {
                console.error('Failed to publish notice:', err);
                if (window.showToast) showToast('Error publishing notice', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Publish';
            }
        });
    }

    async function loadAdminNotices() {
        const container = document.getElementById('adminNoticeList');
        if (!container) return;

        try {
            const res = await API.get('/notices?limit=5');
            if (!res.success || !res.data || res.data.length === 0) {
                container.innerHTML = '<p style="color:var(--gray-400);font-size:0.8rem;text-align:center;margin:8px 0;">No notices published yet</p>';
                return;
            }

            container.innerHTML = res.data.map(n => {
                const time = timeAgo(n.createdAt);
                const priorityColors = { urgent: '#ef4444', important: '#f59e0b', normal: '#6b7280' };
                const color = priorityColors[n.priority] || '#6b7280';
                const priorityLabel = n.priority !== 'normal'
                    ? `<span style="display:inline-block;padding:1px 6px;background:${color}12;color:${color};border-radius:4px;font-size:0.65rem;font-weight:600;text-transform:uppercase;margin-left:6px;">${n.priority}</span>`
                    : '';

                return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100);" data-notice-id="${n._id}">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.82rem;font-weight:600;color:var(--gray-800);margin-bottom:2px;">${n.title}${priorityLabel}</div>
                        <div style="font-size:0.75rem;color:var(--gray-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.message}</div>
                        <div style="font-size:0.7rem;color:var(--gray-400);margin-top:3px;">${time}</div>
                    </div>
                    <button onclick="window.deleteNotice('${n._id}')" title="Remove notice"
                        style="background:none;border:none;cursor:pointer;color:var(--gray-400);padding:4px;border-radius:6px;transition:all 0.2s;"
                        onmouseenter="this.style.color='#ef4444';this.style.background='#fef2f2'"
                        onmouseleave="this.style.color='var(--gray-400)';this.style.background='none'">
                        <span class="material-icons-outlined" style="font-size:16px;">close</span>
                    </button>
                </div>`;
            }).join('');
        } catch (err) {
            console.error('Failed to load notices:', err);
            container.innerHTML = '<p style="color:var(--gray-400);font-size:0.8rem;text-align:center;">Could not load notices</p>';
        }
    }

    window.deleteNotice = async function (id) {
        if (!confirm('Remove this notice?')) return;
        try {
            const res = await API.del(`/notices/${id}`);
            if (res.success) {
                if (window.showToast) showToast('Notice removed', 'success');
                loadAdminNotices();
            }
        } catch (err) {
            console.error('Failed to delete notice:', err);
        }
    };

    // ===== Init =====
    document.addEventListener('DOMContentLoaded', () => {
        if (!API.requireAuth(['admin'])) return;

        // Fetch all data concurrently
        fetchBookStats();
        fetchUserStats();
        fetchTransactionStats();
        fetchRecentBooks();

        // Notice management
        initNoticeForm();
        loadAdminNotices();
    });
})();
