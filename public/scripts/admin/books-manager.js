/**
 * Books Manager — Admin Books Page
 * Handles CRUD operations for books via the API
 */
(function () {
    'use strict';

    // ─── State ───
    let currentPage = 1;
    const limit = 10;
    let totalBooks = 0;
    let totalPages = 0;
    let searchTimeout = null;

    // ─── DOM Elements ───
    const tbody = document.querySelector('#booksTable tbody');
    const footerInfo = document.querySelector('.table-footer-info');
    const paginationContainer = document.querySelector('.pagination');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const addBookBtn = document.getElementById('addBookBtn');
    const statusCheckboxes = document.querySelectorAll('.status-checkbox');
    const resetFilterBtn = document.getElementById('resetFilterBtn');
    const filterBtn = document.getElementById('filterBtn');
    const filterPanel = document.getElementById('filterPanel');

    // ─── Toast helper ───
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

    // ─── Fetch books from API ───
    async function fetchBooks() {
        const search = searchInput?.value.trim() || '';
        const selectedStatuses = Array.from(statusCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        let endpoint = `/books?page=${currentPage}&limit=${limit}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        if (selectedStatuses.length === 1) endpoint += `&status=${selectedStatuses[0]}`;

        try {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--gray-400);"><span class="material-icons-outlined" style="font-size:2rem;display:block;margin-bottom:8px;animation:spin 1s linear infinite;">sync</span>Loading books...</td></tr>`;
            const data = await API.get(endpoint);
            if (data.success) {
                totalBooks = data.pagination?.total || 0;
                totalPages = data.pagination?.pages || 1;
                renderBooks(data.data || []);
                renderPagination();
                renderFooterInfo();
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--danger);">Failed to load books</td></tr>`;
            }
        } catch (err) {
            console.error('fetchBooks error:', err);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--danger);">${err.message || 'Network error'}</td></tr>`;
        }
    }

    // ─── Render book rows ───
    function renderBooks(books) {
        if (books.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;">
                <span class="material-icons-outlined" style="font-size:2.5rem;color:var(--gray-300);margin-bottom:8px;display:block;">menu_book</span>
                <div style="color:var(--gray-500);font-size:0.92rem;">No books found</div>
                <div style="color:var(--gray-400);font-size:0.8rem;margin-top:4px;">Try a different search or add a new book</div>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = books.map(book => {
            const title = book.title || 'Untitled';
            const author = book.authors?.map(a => a.name).join(', ') || 'Unknown';
            const isbn = book.isbn || book.isbn13 || book.sku || '—';
            const category = (book.categories && book.categories[0]) || book.category || '';
            const status = book.status || 'available';
            const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
            const coverUrl = book.coverImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=6366f1&color=fff&size=100&font-size=0.35&bold=true`;
            const copies = book.availableCopies != null ? `${book.availableCopies}/${book.totalCopies || 1}` : '';

            return `<tr data-id="${book._id}">
                <td>
                    <div class="cell-book">
                        <div class="cell-book-cover">
                            <img src="${coverUrl}" alt="${title}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=e2e8f0&color=64748b&size=100&font-size=0.3'">
                        </div>
                        <div class="cell-book-info">
                            <div class="title">${escapeHtml(title)}</div>
                            <div class="subtitle">${escapeHtml(category)}${copies ? ' · ' + copies + ' copies' : ''}</div>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(author)}</td>
                <td><span class="isbn-badge">${escapeHtml(isbn)}</span></td>
                <td><span class="status-badge ${status}">${statusLabel}</span></td>
                <td>
                    <button class="action-btn edit-book-btn" data-id="${book._id}" title="Edit"><span class="material-icons-outlined">edit</span></button>
                    <button class="action-btn delete-book-btn" data-id="${book._id}" title="Delete"><span class="material-icons-outlined">delete_outline</span></button>
                </td>
            </tr>`;
        }).join('');
    }

    // ─── Custom Confirm Dialog ───
    function showDeleteConfirm(id, type) {
        // Remove existing confirm dialog
        const existing = document.getElementById('deleteConfirmDialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'deleteConfirmDialog';
        dialog.innerHTML = `
            <div class="confirm-overlay active">
                <div class="confirm-box">
                    <div class="confirm-icon">
                        <span class="material-icons-outlined" style="font-size:2rem;color:#ef4444;">warning_amber</span>
                    </div>
                    <h3>Delete this ${type}?</h3>
                    <p>This action cannot be undone. The ${type} will be permanently removed.</p>
                    <div class="confirm-actions">
                        <button class="confirm-cancel" id="confirmCancel">Cancel</button>
                        <button class="confirm-delete" id="confirmDelete">Yes, Delete</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(dialog);
        document.body.style.overflow = 'hidden';

        // Cancel
        document.getElementById('confirmCancel').addEventListener('click', () => {
            dialog.remove();
            document.body.style.overflow = '';
        });
        // Click overlay to cancel
        dialog.querySelector('.confirm-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                dialog.remove();
                document.body.style.overflow = '';
            }
        });
        // Confirm delete
        document.getElementById('confirmDelete').addEventListener('click', async () => {
            const delBtn = document.getElementById('confirmDelete');
            delBtn.disabled = true;
            delBtn.textContent = 'Deleting...';
            try {
                const result = await API.del(`/books/${id}`);
                if (result && result.success) {
                    showToast('Book deleted successfully', 'success');
                } else {
                    showToast((result && result.message) || 'Failed to delete book', 'error');
                }
            } catch (err) {
                showToast(err.message || 'Failed to delete book', 'error');
            }
            dialog.remove();
            document.body.style.overflow = '';
            fetchBooks();
        });
    }

    // ─── Footer info ───
    function renderFooterInfo() {
        if (!footerInfo) return;
        const start = totalBooks === 0 ? 0 : (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalBooks);
        footerInfo.innerHTML = `Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${totalBooks.toLocaleString()}</strong> volumes`;
    }

    // ─── Pagination ───
    function renderPagination() {
        if (!paginationContainer) return;
        let html = '';
        html += `<button class="page-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}><span class="material-icons-outlined">chevron_left</span></button>`;
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) html += `<button class="page-btn" style="pointer-events:none;color:var(--gray-300);">...</button>`;
        }
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<button class="page-btn" style="pointer-events:none;color:var(--gray-300);">...</button>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        html += `<button class="page-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}><span class="material-icons-outlined">chevron_right</span></button>`;
        paginationContainer.innerHTML = html;

        paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = btn.dataset.page;
                if (p === 'prev' && currentPage > 1) currentPage--;
                else if (p === 'next' && currentPage < totalPages) currentPage++;
                else if (p !== 'prev' && p !== 'next') currentPage = parseInt(p);
                fetchBooks();
            });
        });
    }

    // ─── Add/Edit Book Modal ───
    function createModal() {
        if (document.getElementById('bookModal')) return;
        const modal = document.createElement('div');
        modal.id = 'bookModal';
        modal.innerHTML = `
        <div class="modal-overlay" id="bookModalOverlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="bookModalTitle">Add New Book</h2>
                    <button class="modal-close" id="bookModalClose"><span class="material-icons-outlined">close</span></button>
                </div>
                <form id="bookForm" autocomplete="off" enctype="multipart/form-data">
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Cover Image</label>
                            <div class="cover-upload" id="coverUploadArea">
                                <input type="file" id="bookCoverInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
                                <div class="cover-preview" id="coverPreview" style="display:none">
                                    <img id="coverPreviewImg" alt="Cover preview">
                                    <button type="button" class="cover-remove" id="coverRemoveBtn" title="Remove image">
                                        <span class="material-icons-outlined">close</span>
                                    </button>
                                </div>
                                <div class="cover-placeholder" id="coverPlaceholder">
                                    <span class="material-icons-outlined">add_photo_alternate</span>
                                    <span>Click or drag to upload cover</span>
                                    <span class="cover-hint">JPG, PNG, WebP — max 5 MB</span>
                                </div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Title *</label>
                                <input type="text" id="bookTitle" required placeholder="Enter book title">
                            </div>
                        </div>
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Author *</label>
                                <input type="text" id="bookAuthor" required placeholder="Author name">
                            </div>
                            <div class="form-group">
                                <label>ISBN</label>
                                <input type="text" id="bookIsbn" placeholder="978-X-XX-XXXXXX-X">
                            </div>
                        </div>
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Category</label>
                                <input type="text" id="bookCategory" placeholder="e.g. Fiction, Science">
                            </div>
                            <div class="form-group">
                                <label>Publisher</label>
                                <input type="text" id="bookPublisher" placeholder="Publisher name">
                            </div>
                        </div>
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Total Copies</label>
                                <input type="number" id="bookCopies" value="1" min="1">
                            </div>
                            <div class="form-group">
                                <label>Pages</label>
                                <input type="number" id="bookPages" min="1" placeholder="—">
                            </div>
                        </div>
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Price ($)</label>
                                <input type="number" id="bookPrice" step="0.01" min="0" placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="bookStatus">
                                    <option value="available">Available</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="bookDescription" rows="2" placeholder="Brief description..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-modal-cancel" id="bookModalCancel">Cancel</button>
                        <button type="submit" class="btn-modal-submit" id="bookModalSubmit">
                            <span class="material-icons-outlined">add</span> Add Book
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
        document.body.appendChild(modal);
        injectModalStyles();

        // Close handlers
        document.getElementById('bookModalClose').addEventListener('click', closeModal);
        document.getElementById('bookModalCancel').addEventListener('click', closeModal);
        document.getElementById('bookModalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Submit handler
        document.getElementById('bookForm').addEventListener('submit', handleBookSubmit);

        // ── Cover image upload logic ──
        const coverInput = document.getElementById('bookCoverInput');
        const uploadArea = document.getElementById('coverUploadArea');
        const preview = document.getElementById('coverPreview');
        const previewImg = document.getElementById('coverPreviewImg');
        const placeholder = document.getElementById('coverPlaceholder');
        const removeBtn = document.getElementById('coverRemoveBtn');

        // Click to open file picker
        uploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.cover-remove')) return;
            coverInput.click();
        });

        // File selected
        coverInput.addEventListener('change', () => {
            const file = coverInput.files[0];
            if (file) showCoverPreview(file);
        });

        // Drag & drop
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                // Set file to input via DataTransfer
                const dt = new DataTransfer();
                dt.items.add(file);
                coverInput.files = dt.files;
                showCoverPreview(file);
            }
        });

        // Remove image
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            coverInput.value = '';
            preview.style.display = 'none';
            placeholder.style.display = '';
        });
    }

    function showCoverPreview(file) {
        const preview = document.getElementById('coverPreview');
        const previewImg = document.getElementById('coverPreviewImg');
        const placeholder = document.getElementById('coverPlaceholder');
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.style.display = 'flex';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    let editingBookId = null;

    function openAddModal() {
        createModal();
        editingBookId = null;
        document.getElementById('bookModalTitle').textContent = 'Add New Book';
        document.getElementById('bookModalSubmit').innerHTML = '<span class="material-icons-outlined">add</span> Add Book';
        document.getElementById('bookForm').reset();
        document.getElementById('bookCopies').value = '1';
        document.getElementById('bookStatus').value = 'available';
        // Reset cover preview
        document.getElementById('coverPreview').style.display = 'none';
        document.getElementById('coverPlaceholder').style.display = '';
        document.getElementById('bookCoverInput').value = '';
        document.getElementById('bookModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    async function openEditModal(id) {
        createModal();
        editingBookId = id;
        document.getElementById('bookModalTitle').textContent = 'Edit Book';
        document.getElementById('bookModalSubmit').innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
        document.getElementById('bookModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const data = await API.get(`/books/${id}`);
            const book = data.data?.book;
            if (book) {
                document.getElementById('bookTitle').value = book.title || '';
                document.getElementById('bookAuthor').value = book.authors?.map(a => a.name).join(', ') || '';
                document.getElementById('bookIsbn').value = book.isbn || book.isbn13 || '';
                document.getElementById('bookCategory').value = (book.categories && book.categories[0]) || '';
                document.getElementById('bookPublisher').value = book.publisher || '';
                document.getElementById('bookCopies').value = book.totalCopies || 1;
                document.getElementById('bookPages').value = book.pages || '';
                document.getElementById('bookPrice').value = book.price || '';
                document.getElementById('bookStatus').value = book.status || 'available';
                document.getElementById('bookDescription').value = book.description || '';
                // Show existing cover image
                if (book.coverImage) {
                    const previewImg = document.getElementById('coverPreviewImg');
                    const preview = document.getElementById('coverPreview');
                    const placeholder = document.getElementById('coverPlaceholder');
                    previewImg.src = book.coverImage;
                    preview.style.display = 'flex';
                    placeholder.style.display = 'none';
                }
            }
        } catch (err) {
            showToast('Failed to load book details', 'error');
        }
    }

    function closeModal() {
        const overlay = document.getElementById('bookModalOverlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        editingBookId = null;
    }

    async function handleBookSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('bookModalSubmit');
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';

        const authorNames = document.getElementById('bookAuthor').value.split(',').map(s => s.trim()).filter(Boolean);

        // Build FormData for multipart upload
        const formData = new FormData();
        formData.append('title', document.getElementById('bookTitle').value.trim());
        formData.append('authors', JSON.stringify(authorNames.map(name => ({ name }))));

        const isbn = document.getElementById('bookIsbn').value.trim();
        if (isbn) formData.append('isbn', isbn);

        const category = document.getElementById('bookCategory').value.trim();
        formData.append('categories', JSON.stringify(category ? [category] : []));

        const publisher = document.getElementById('bookPublisher').value.trim();
        if (publisher) formData.append('publisher', publisher);

        formData.append('totalCopies', parseInt(document.getElementById('bookCopies').value) || 1);

        const pages = parseInt(document.getElementById('bookPages').value);
        if (pages) formData.append('pages', pages);

        const price = parseFloat(document.getElementById('bookPrice').value);
        if (price) formData.append('price', price);

        formData.append('status', document.getElementById('bookStatus').value || 'available');

        const description = document.getElementById('bookDescription').value.trim();
        if (description) formData.append('description', description);

        // Append cover image file if selected
        const coverInput = document.getElementById('bookCoverInput');
        if (coverInput.files[0]) {
            formData.append('coverImage', coverInput.files[0]);
        }

        try {
            if (editingBookId) {
                await API.put(`/books/${editingBookId}`, formData);
                showToast('Book updated successfully', 'success');
            } else {
                await API.post('/books', formData);
                showToast('Book added successfully!', 'success');
            }
            closeModal();
            currentPage = 1;
            fetchBooks();
        } catch (err) {
            const msg = err.errors ? err.errors.map(e => e.msg || e.message).join(', ') : (err.message || 'Failed to save book');
            showToast(msg, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }

    // ─── Modal styles injection ───
    function injectModalStyles() {
        if (document.getElementById('modalStyles')) return;
        const style = document.createElement('style');
        style.id = 'modalStyles';
        style.textContent = `
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
            .modal-overlay {
                position: fixed; inset: 0; z-index: 10000;
                background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
                padding: 16px;
            }
            .modal-overlay.active { opacity: 1; pointer-events: auto; }
            .modal-content {
                background: #fff; border-radius: 16px;
                width: 100%; max-width: 520px;
                max-height: calc(100vh - 32px); overflow-y: auto;
                box-shadow: 0 24px 64px rgba(0,0,0,0.18);
                transform: translateY(24px) scale(0.97); transition: transform 0.3s ease;
            }
            .modal-overlay.active .modal-content { transform: translateY(0) scale(1); }
            .modal-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 20px 24px 14px; border-bottom: 1px solid #f1f5f9;
                position: sticky; top: 0; background: #fff; z-index: 1;
                border-radius: 16px 16px 0 0;
            }
            .modal-header h2 {
                font-family: 'Space Grotesk', sans-serif; font-size: 1.2rem;
                font-weight: 700; color: #18181b;
            }
            .modal-close {
                width: 34px; height: 34px; border: 1px solid #e2e8f0;
                border-radius: 10px; background: #fff; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                color: #64748b; transition: all 0.2s ease; flex-shrink: 0;
            }
            .modal-close:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
            .modal-body { padding: 20px 24px; }
            .modal-body .form-row { margin-bottom: 14px; }
            .modal-body .form-row.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .modal-body .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 2px; }
            .modal-body label {
                font-size: 0.7rem; font-weight: 700; letter-spacing: 0.8px;
                text-transform: uppercase; color: #6b7490;
            }
            .modal-body input, .modal-body textarea, .modal-body select {
                padding: 9px 12px; border: 1.5px solid #e2e8f0;
                border-radius: 8px; font-family: 'Inter', sans-serif;
                font-size: 0.85rem; color: #18181b; background: #fafafa;
                outline: none; transition: all 0.2s ease; width: 100%;
                box-sizing: border-box;
            }
            .modal-body input:focus, .modal-body textarea:focus, .modal-body select:focus {
                border-color: #6366f1; background: #fff;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
            }
            .modal-body textarea { resize: vertical; min-height: 60px; }
            .modal-footer {
                display: flex; justify-content: flex-end; gap: 10px;
                padding: 14px 24px 20px; border-top: 1px solid #f1f5f9;
                position: sticky; bottom: 0; background: #fff;
                border-radius: 0 0 16px 16px;
            }
            .btn-modal-cancel {
                padding: 9px 20px; border: 1.5px solid #e2e8f0;
                border-radius: 10px; background: #fff; color: #64748b;
                font-family: 'Inter', sans-serif; font-size: 0.85rem;
                font-weight: 500; cursor: pointer; transition: all 0.2s ease;
            }
            .btn-modal-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
            .btn-modal-submit {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 9px 20px; border: none; border-radius: 10px;
                background: linear-gradient(135deg, #18283e, #243b55, #324e6a);
                color: #fff; font-family: 'Inter', sans-serif; font-size: 0.85rem;
                font-weight: 600; cursor: pointer; transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(0, 102, 204, 0.25);
            }
            .btn-modal-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0, 102, 204, 0.35); }
            .btn-modal-submit .material-icons-outlined { font-size: 1rem; }
            @media (max-width: 500px) {
                .modal-body .form-row.two-col { grid-template-columns: 1fr; }
                .modal-content { max-width: 100%; border-radius: 16px 16px 0 0; margin-top: auto; }
                .modal-overlay { padding: 8px; align-items: flex-end; }
            }
            /* Cover Upload */
            .cover-upload {
                border: 2px dashed #e2e8f0; border-radius: 12px;
                cursor: pointer; transition: all 0.2s ease; overflow: hidden;
                min-height: 120px; position: relative;
            }
            .cover-upload:hover, .cover-upload.drag-over {
                border-color: #6366f1; background: rgba(99, 102, 241, 0.03);
            }
            .cover-placeholder {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; gap: 6px; padding: 28px 16px;
                color: #94a3b8; text-align: center;
            }
            .cover-placeholder .material-icons-outlined {
                font-size: 2rem; color: #cbd5e1;
            }
            .cover-placeholder span { font-size: 0.82rem; }
            .cover-hint {
                font-size: 0.72rem !important; color: #a1a1aa !important;
            }
            .cover-preview {
                display: flex; align-items: center; justify-content: center;
                padding: 12px; position: relative;
            }
            .cover-preview img {
                max-height: 160px; max-width: 100%; border-radius: 8px;
                object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }
            .cover-remove {
                position: absolute; top: 8px; right: 8px;
                width: 28px; height: 28px; border-radius: 50%;
                border: none; background: rgba(239, 68, 68, 0.9);
                color: #fff; cursor: pointer; display: flex;
                align-items: center; justify-content: center;
                opacity: 0; transition: opacity 0.2s;
            }
            .cover-remove .material-icons-outlined { font-size: 0.9rem; }
            .cover-upload:hover .cover-remove { opacity: 1; }
            /* Confirm Dialog */
            .confirm-overlay {
                position: fixed; inset: 0; z-index: 10002;
                background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
                padding: 16px;
            }
            .confirm-overlay.active { opacity: 1; pointer-events: auto; }
            .confirm-box {
                background: #fff; border-radius: 16px; padding: 28px 32px;
                text-align: center; max-width: 380px; width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                transform: scale(0.95); transition: transform 0.25s ease;
            }
            .confirm-overlay.active .confirm-box { transform: scale(1); }
            .confirm-icon { margin-bottom: 12px; }
            .confirm-box h3 {
                font-family: 'Space Grotesk', sans-serif; font-size: 1.15rem;
                font-weight: 700; color: #18181b; margin: 0 0 8px;
            }
            .confirm-box p {
                font-size: 0.85rem; color: #64748b; margin: 0 0 20px;
                line-height: 1.5;
            }
            .confirm-actions { display: flex; gap: 10px; justify-content: center; }
            .confirm-cancel {
                padding: 9px 22px; border: 1.5px solid #e2e8f0;
                border-radius: 10px; background: #fff; color: #64748b;
                font-family: 'Inter', sans-serif; font-size: 0.85rem;
                font-weight: 500; cursor: pointer; transition: all 0.2s ease;
            }
            .confirm-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
            .confirm-delete {
                padding: 9px 22px; border: none; border-radius: 10px;
                background: linear-gradient(135deg, #dc2626, #ef4444);
                color: #fff; font-family: 'Inter', sans-serif; font-size: 0.85rem;
                font-weight: 600; cursor: pointer; transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
            }
            .confirm-delete:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4); }
            .confirm-delete:disabled { opacity: 0.6; pointer-events: none; }
        `;
        document.head.appendChild(style);
    }

    // ─── Utility ───
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Filter Panel Toggle ───
    function initFilterPanel() {
        if (!filterBtn || !filterPanel) return;

        filterBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            filterPanel.style.display = filterPanel.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#filterBtn') && !e.target.closest('#filterPanel')) {
                filterPanel.style.display = 'none';
            }
        });
    }

    // ─── Init ───
    document.addEventListener('DOMContentLoaded', () => {
        if (!API.requireAuth(['admin'])) return;

        // Inject styles immediately (for confirm dialog & modal)
        injectModalStyles();

        // Event delegation for edit/delete buttons (registered once)
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-book-btn');
                if (deleteBtn) {
                    e.stopPropagation();
                    e.preventDefault();
                    const id = deleteBtn.getAttribute('data-id');
                    if (id) showDeleteConfirm(id, 'book');
                    return;
                }
                const editBtn = e.target.closest('.edit-book-btn');
                if (editBtn) {
                    e.stopPropagation();
                    e.preventDefault();
                    const id = editBtn.getAttribute('data-id');
                    if (id) openEditModal(id);
                    return;
                }
            });
        }

        // Wire up Add Book button
        if (addBookBtn) addBookBtn.addEventListener('click', openAddModal);

        // Initialize filter panel toggle
        initFilterPanel();

        // Search with debounce
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (clearSearchBtn) clearSearchBtn.style.display = searchInput.value.trim() ? 'block' : 'none';
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => { currentPage = 1; fetchBooks(); }, 350);
            });
        }

        // Clear search
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';
                currentPage = 1;
                fetchBooks();
            });
        }

        // Status filter checkboxes — trigger API reload
        statusCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => { currentPage = 1; fetchBooks(); });
        });
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener('click', () => {
                statusCheckboxes.forEach(cb => cb.checked = false);
                currentPage = 1;
                fetchBooks();
            });
        }

        // Load books
        fetchBooks();
    });
})();
