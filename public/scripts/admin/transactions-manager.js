// ===== TRANSACTIONS MANAGER =====
// Live-fetching transaction data from the API

document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentPage = 1;
    let currentTab = 'all';
    let totalPages = 1;
    let totalTransactions = 0;
    const perPage = 10;

    // Elements
    const tbody = document.querySelector('#transactionsTable tbody');
    const tableFooterInfo = document.querySelector('.table-footer-info');
    const paginationContainer = document.querySelector('.pagination');
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Bottom info card elements
    const overdueCountEl = document.getElementById('overdueCount');
    const circulationCountEl = document.getElementById('circulationCount');
    const circulationChangeEl = document.getElementById('circulationChange');
    const integrityPercentEl = document.getElementById('integrityPercent');

    // ===== Tab Switching =====
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            currentPage = 1;
            fetchTransactions();
        });
    });

    // ===== Fetch Transactions =====
    async function fetchTransactions() {
        showTableLoading();
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: perPage,
                sortBy: 'createdAt',
                order: 'desc',
            });

            // Apply tab filters
            if (currentTab === 'active') {
                params.set('status', 'active');
            } else if (currentTab === 'overdue') {
                params.set('overdue', 'true');
            } else if (currentTab === 'returned') {
                params.set('status', 'completed');
            }

            const data = await API.get(`/transactions?${params.toString()}`);

            if (data.success) {
                const transactions = data.data || [];
                totalTransactions = data.pagination?.total || transactions.length;
                totalPages = Math.ceil(totalTransactions / perPage) || 1;
                renderTable(transactions);
                renderPagination();
                updateFooterInfo(transactions.length);
            }
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
            showTableError();
        }
    }

    // ===== Fetch Stats (for bottom cards) =====
    async function fetchStats() {
        try {
            const [statsData, booksData] = await Promise.all([
                API.get('/transactions/stats'),
                API.get('/books?limit=1'), // just to get total count from pagination
            ]);

            if (statsData.success) {
                const stats = statsData.data;
                const overdueCount = stats.overview?.overdue || 0;
                const totalActive = stats.overview?.active || 0;
                const todayReturned = stats.overview?.todayReturned || 0;
                const totalTx = stats.overview?.total || 0;

                // Overdue Notice Protocol
                if (overdueCountEl) {
                    overdueCountEl.innerHTML = `Systems indicate <strong>${overdueCount} item${overdueCount !== 1 ? 's' : ''}</strong> ${overdueCount === 1 ? 'is' : 'are'} currently past ${overdueCount === 1 ? 'its' : 'their'} return deadline. Automated reminders are scheduled for release at 18:00 UTC.`;
                }

                // Circulation Velocity - returns this week (approximate with todayReturned * 7 or use total completed)
                if (circulationCountEl) {
                    // Use active loans as a proxy for circulation activity
                    circulationCountEl.textContent = totalActive;
                }
                if (circulationChangeEl) {
                    if (todayReturned > 0) {
                        circulationChangeEl.textContent = `+${todayReturned} today`;
                        circulationChangeEl.className = 'stat-card-change positive';
                    } else {
                        circulationChangeEl.textContent = 'No returns today';
                        circulationChangeEl.className = 'stat-card-change neutral';
                    }
                }

                // Archival Integrity - calculate from books data
                if (integrityPercentEl && booksData.success) {
                    const totalBooks = booksData.pagination?.total || 0;
                    if (totalBooks > 0) {
                        const integrity = totalBooks > 0 
                            ? (((totalBooks - overdueCount) / totalBooks) * 100).toFixed(1)
                            : '100.0';
                        integrityPercentEl.textContent = `${integrity}%`;
                    } else {
                        integrityPercentEl.textContent = '100%';
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }

    // ===== Render Table =====
    function renderTable(transactions) {
        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:48px 24px;color:var(--gray-400);">
                        <span class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">receipt_long</span>
                        No transactions found
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = transactions.map(tx => {
            const txId = `#TX-${(tx._id || '').slice(-4).toUpperCase()}`;
            const book = tx.book || {};
            const user = tx.user || {};
            const bookTitle = book.title || 'Unknown Book';
            const bookAuthors = Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors || '');
            const bookIsbn = book.isbn || '';
            const coverImage = book.coverImage
                ? (book.coverImage.startsWith('http') ? book.coverImage : `/${book.coverImage}`)
                : 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&h=140&fit=crop';
            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
            const userEmail = user.email || '';

            const borrowDate = tx.borrowDate ? formatDate(tx.borrowDate) : '-';
            const dueDate = tx.dueDate ? formatDate(tx.dueDate) : '-';
            const returnDate = tx.returnDate ? formatDate(tx.returnDate) : null;

            const status = tx.status || 'active';
            const statusLabel = getStatusLabel(status);
            const statusClass = getStatusClass(status);

            // Due date styling
            let dueTdStyle = '';
            let dueDateDisplay = dueDate;
            if (status === 'overdue') {
                dueTdStyle = 'color:var(--danger);font-weight:600;';
            } else if (status === 'completed' && returnDate) {
                dueTdStyle = 'color:var(--gray-400);font-style:italic;';
                dueDateDisplay = `Returned ${returnDate}`;
            }

            // Action buttons
            let actions = '';
            if (status === 'active' || status === 'overdue') {
                actions = `
                    <button class="action-btn return-btn" data-id="${tx._id}" title="Return Book">
                        <span class="material-icons-outlined">assignment_return</span>
                    </button>
                    <button class="action-btn" title="More options">
                        <span class="material-icons-outlined">more_vert</span>
                    </button>`;
            } else {
                actions = `
                    <button class="action-btn" title="View history">
                        <span class="material-icons-outlined">history</span>
                    </button>
                    <button class="action-btn" title="More options">
                        <span class="material-icons-outlined">more_vert</span>
                    </button>`;
            }

            return `
                <tr>
                    <td style="font-weight:600;color:var(--gray-500);">${txId}</td>
                    <td>
                        <div class="cell-book">
                            <div class="cell-book-cover">
                                <img src="${coverImage}" alt="${bookTitle}" onerror="this.src='https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&h=140&fit=crop'">
                            </div>
                            <div class="cell-book-info">
                                <div class="title">${bookTitle}</div>
                                <div class="subtitle" style="color:var(--accent);">${bookIsbn ? bookIsbn : bookAuthors}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div>${userName}</div>
                        <div style="font-size:0.76rem;color:var(--gray-400);">${userEmail}</div>
                    </td>
                    <td>${borrowDate}</td>
                    <td style="${dueTdStyle}">${dueDateDisplay}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>${actions}</td>
                </tr>`;
        }).join('');

        // Attach return button listeners
        tbody.querySelectorAll('.return-btn').forEach(btn => {
            btn.addEventListener('click', () => handleReturn(btn.dataset.id));
        });
    }

    // ===== Return Book Handler =====
    async function handleReturn(transactionId) {
        if (!confirm('Are you sure you want to mark this book as returned?')) return;

        try {
            const data = await API.post('/transactions/return', {
                transactionId,
                condition: 'good',
            });

            if (data.success) {
                showToast('Book returned successfully', 'success');
                fetchTransactions();
                fetchStats();
            } else {
                showToast(data.message || 'Return failed', 'error');
            }
        } catch (err) {
            showToast(err.message || 'Error returning book', 'error');
        }
    }

    // ===== Render Pagination =====
    function renderPagination() {
        if (!paginationContainer) return;

        let html = `<button class="page-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>
            <span class="material-icons-outlined">chevron_left</span>
        </button>`;

        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        html += `<button class="page-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>
            <span class="material-icons-outlined">chevron_right</span>
        </button>`;

        paginationContainer.innerHTML = html;

        paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev' && currentPage > 1) {
                    currentPage--;
                } else if (page === 'next' && currentPage < totalPages) {
                    currentPage++;
                } else if (page !== 'prev' && page !== 'next') {
                    currentPage = parseInt(page);
                }
                fetchTransactions();
            });
        });
    }

    // ===== Update Footer Info =====
    function updateFooterInfo(shown) {
        if (!tableFooterInfo) return;
        const start = (currentPage - 1) * perPage + 1;
        const end = start + shown - 1;
        tableFooterInfo.innerHTML = `SHOWING ${totalTransactions > 0 ? start : 0} TO ${end} OF ${totalTransactions.toLocaleString()} ENTRIES`;
    }

    // ===== Loading / Error States =====
    function showTableLoading() {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:48px 24px;color:var(--gray-400);">
                    <div style="display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>
                    <div>Loading transactions...</div>
                </td>
            </tr>`;
    }

    function showTableError() {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:48px 24px;color:var(--danger);">
                    <span class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;">error_outline</span>
                    Failed to load transactions. Please try again.
                </td>
            </tr>`;
    }

    // ===== Helpers =====
    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getStatusLabel(status) {
        const labels = {
            active: 'LOANED',
            overdue: 'OVERDUE',
            completed: 'RETURNED',
            cancelled: 'CANCELLED',
        };
        return labels[status] || status.toUpperCase();
    }

    function getStatusClass(status) {
        const classes = {
            active: 'loaned',
            overdue: 'overdue',
            completed: 'returned',
            cancelled: 'cancelled',
        };
        return classes[status] || status;
    }

    // ===== Toast =====
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 24px; right: 24px; z-index: 10001;
            padding: 14px 24px; border-radius: 12px; font-family: 'Inter', sans-serif;
            font-size: 0.88rem; font-weight: 500; color: #fff;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18); animation: toastIn 0.35s ease;
            max-width: 380px;
        `;
        const colors = {
            success: 'linear-gradient(135deg, #059669, #10b981)',
            error: 'linear-gradient(135deg, #dc2626, #ef4444)',
            info: 'linear-gradient(135deg, #2563eb, #3b82f6)',
        };
        toast.style.background = colors[type] || colors.info;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; toast.style.transition = 'all 0.3s ease'; }, 2800);
        setTimeout(() => toast.remove(), 3200);
    }

    // ===== Export CSV =====
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="material-icons-outlined">hourglass_top</span> Exporting...';
            try {
                // Fetch all transactions (large limit)
                const data = await API.get('/transactions?limit=10000&sortBy=createdAt&order=desc');
                if (!data.success || !data.data || data.data.length === 0) {
                    showToast('No transactions to export.', 'info');
                    return;
                }

                const rows = data.data;
                const csvHeaders = ['Transaction ID', 'Book Title', 'ISBN', 'Borrower', 'Email', 'Borrow Date', 'Due Date', 'Return Date', 'Status', 'Fine Amount'];
                const csvRows = rows.map(tx => {
                    const book = tx.book || {};
                    const user = tx.user || {};
                    return [
                        tx._id || '',
                        `"${(book.title || '').replace(/"/g, '""')}"`,
                        book.isbn || '',
                        `"${((user.firstName || '') + ' ' + (user.lastName || '')).trim().replace(/"/g, '""')}"`,
                        user.email || '',
                        tx.borrowDate ? new Date(tx.borrowDate).toLocaleDateString() : '',
                        tx.dueDate ? new Date(tx.dueDate).toLocaleDateString() : '',
                        tx.returnDate ? new Date(tx.returnDate).toLocaleDateString() : '',
                        (tx.status || '').toUpperCase(),
                        tx.fineAmount || 0,
                    ].join(',');
                });

                const csv = [csvHeaders.join(','), ...csvRows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showToast(`Exported ${rows.length} transaction${rows.length !== 1 ? 's' : ''} to CSV.`, 'success');
            } catch (err) {
                showToast('Failed to export transactions.', 'error');
                console.error('Export error:', err);
            } finally {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<span class="material-icons-outlined">download</span> EXPORT LEDGER';
            }
        });
    }

    // ===== Inject spinner animation =====
    if (!document.getElementById('txSpinStyle')) {
        const style = document.createElement('style');
        style.id = 'txSpinStyle';
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    // ===== Init =====
    fetchTransactions();
    fetchStats();
});
