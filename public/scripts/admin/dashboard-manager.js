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

    // ===== Init =====
    document.addEventListener('DOMContentLoaded', () => {
        if (!API.requireAuth(['admin'])) return;

        // Fetch all data concurrently
        fetchBookStats();
        fetchUserStats();
        fetchTransactionStats();
        fetchRecentBooks();
    });
})();
