/**
 * Users Manager — Admin Users Page
 * Handles CRUD operations for users via the API
 */
(function () {
    'use strict';

    // ─── State ───
    let currentPage = 1;
    const limit = 10;
    let totalUsers = 0;
    let totalPages = 0;

    // ─── DOM Elements ───
    const tbody = document.querySelector('#usersTable tbody');
    const footerInfo = document.querySelector('.table-footer-info');
    const paginationContainer = document.querySelector('.pagination');
    const addUserBtn = document.getElementById('addUserBtn');
    const roleCheckboxes = document.querySelectorAll('.role-checkbox');
    const statusCheckboxes = document.querySelectorAll('.status-checkbox');
    const roleFilterBtn = document.querySelector('.filter-btn-role');
    const statusFilterBtn = document.querySelector('.filter-btn-status');
    const roleFilterPanel = document.querySelector('.role-filter-panel');
    const statusFilterPanel = document.querySelector('.status-filter-panel');

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

    // ─── Fetch users from API ───
    async function fetchUsers() {
        const selectedRoles = Array.from(roleCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        const selectedStatuses = Array.from(statusCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

        let endpoint = `/users?page=${currentPage}&limit=${limit}`;
        if (selectedRoles.length === 1) endpoint += `&role=${selectedRoles[0]}`;
        if (selectedStatuses.length === 1) endpoint += `&status=${selectedStatuses[0]}`;

        try {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--gray-400);"><span class="material-icons-outlined" style="font-size:2rem;display:block;margin-bottom:8px;animation:spin 1s linear infinite;">sync</span>Loading users...</td></tr>`;
            const data = await API.get(endpoint);
            if (data.success) {
                totalUsers = data.pagination?.total || 0;
                totalPages = data.pagination?.pages || 1;
                renderUsers(data.data || []);
                renderPagination();
                renderFooterInfo();
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--danger);">Failed to load users</td></tr>`;
            }
        } catch (err) {
            console.error('fetchUsers error:', err);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--danger);">${err.message || 'Network error'}</td></tr>`;
        }
    }

    // ─── Render user rows ───
    function renderUsers(users) {
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;">
                <span class="material-icons-outlined" style="font-size:2.5rem;color:var(--gray-300);margin-bottom:8px;display:block;">people_outline</span>
                <div style="color:var(--gray-500);font-size:0.92rem;">No users found</div>
                <div style="color:var(--gray-400);font-size:0.8rem;margin-top:4px;">Try a different filter or add a new user</div>
            </td></tr>`;
            return;
        }

        const avatarColors = [
            'linear-gradient(135deg, #dbeafe, #bfdbfe)',
            'linear-gradient(135deg, #dcfce7, #bbf7d0)',
            'linear-gradient(135deg, #fce7f3, #fbcfe8)',
            'linear-gradient(135deg, #f3e8ff, #e2e6ef)',
            'linear-gradient(135deg, #fef3c7, #fde68a)',
        ];
        const avatarTextColors = ['#2563eb', '#059669', '#db2777', '#7c3aed', '#d97706'];

        tbody.innerHTML = users.map((user, idx) => {
            const firstName = user.firstName || '';
            const lastName = user.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
            const email = user.email || '';
            const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
            const role = user.role || 'student';
            const roleBadgeClass = role === 'admin' ? 'admin' : role === 'librarian' ? 'faculty' : 'student';
            const roleLabel = role.toUpperCase();
            const status = user.status || 'active';
            const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
            const enrolledDate = user.createdAt ? formatDate(user.createdAt) : '—';
            const colorIdx = idx % avatarColors.length;

            return `<tr data-id="${user._id}">
                <td>
                    <div class="cell-user">
                        <div class="cell-user-avatar" style="background:${avatarColors[colorIdx]};color:${avatarTextColors[colorIdx]};">${initials}</div>
                        <div class="cell-user-info">
                            <div class="name">${escapeHtml(fullName)}</div>
                            <div class="email">${escapeHtml(email)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="role-badge ${roleBadgeClass}">${roleLabel}</span></td>
                <td>${enrolledDate}</td>
                <td><span class="status-badge ${status}">${statusLabel}</span></td>
                <td>
                    <button class="action-btn edit-user-btn" data-id="${user._id}" title="Edit"><span class="material-icons-outlined">edit</span></button>
                    <button class="action-btn delete-user-btn" data-id="${user._id}" title="Delete"><span class="material-icons-outlined">delete_outline</span></button>
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
                const result = await API.del(`/users/${id}`);
                if (result && result.success) {
                    showToast('User deleted successfully', 'success');
                } else {
                    showToast((result && result.message) || 'Failed to delete user', 'error');
                }
            } catch (err) {
                showToast(err.message || 'Failed to delete user', 'error');
            }
            dialog.remove();
            document.body.style.overflow = '';
            fetchUsers();
        });
    }

    // ─── Footer info ───
    function renderFooterInfo() {
        if (!footerInfo) return;
        const start = totalUsers === 0 ? 0 : (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalUsers);
        footerInfo.innerHTML = `Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${totalUsers.toLocaleString()}</strong> results`;
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
                fetchUsers();
            });
        });
    }

    // ─── Add/Edit User Modal ───
    function createModal() {
        if (document.getElementById('userModal')) return;
        const modal = document.createElement('div');
        modal.id = 'userModal';
        modal.innerHTML = `
        <div class="modal-overlay" id="userModalOverlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="userModalTitle">Add New User</h2>
                    <button class="modal-close" id="userModalClose"><span class="material-icons-outlined">close</span></button>
                </div>
                <form id="userForm" autocomplete="off">
                    <div class="modal-body">
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>First Name *</label>
                                <input type="text" id="userFirstName" required placeholder="John">
                            </div>
                            <div class="form-group">
                                <label>Last Name *</label>
                                <input type="text" id="userLastName" required placeholder="Doe">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Email Address *</label>
                                <input type="email" id="userEmail" required placeholder="user@university.edu">
                            </div>
                        </div>
                        <div class="form-row" id="passwordRow">
                            <div class="form-group">
                                <label>Password *</label>
                                <input type="password" id="userPassword" minlength="6" placeholder="Minimum 6 characters">
                            </div>
                        </div>
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Role</label>
                                <select id="userRole">
                                    <option value="student">Student</option>
                                    <option value="admin">Admin</option>
                                    <option value="librarian">Librarian</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="userStatus">
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Max Books Allowed</label>
                                <input type="number" id="userMaxBooks" value="5" min="1" max="20">
                            </div>
                            <div class="form-group">
                                <label>Phone (Optional)</label>
                                <input type="tel" id="userPhone" placeholder="+1 (555) 123-4567">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-modal-cancel" id="userModalCancel">Cancel</button>
                        <button type="submit" class="btn-modal-submit" id="userModalSubmit">
                            <span class="material-icons-outlined">person_add</span> Add User
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
        document.body.appendChild(modal);
        injectModalStyles();

        // Close handlers
        document.getElementById('userModalClose').addEventListener('click', closeModal);
        document.getElementById('userModalCancel').addEventListener('click', closeModal);
        document.getElementById('userModalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Submit handler
        document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
    }

    let editingUserId = null;

    function openAddModal() {
        createModal();
        editingUserId = null;
        document.getElementById('userModalTitle').textContent = 'Add New User';
        document.getElementById('userModalSubmit').innerHTML = '<span class="material-icons-outlined">person_add</span> Add User';
        document.getElementById('userForm').reset();
        document.getElementById('userMaxBooks').value = '5';
        document.getElementById('userRole').value = 'student';
        document.getElementById('userStatus').value = 'active';
        document.getElementById('passwordRow').style.display = '';
        document.getElementById('userPassword').required = true;
        document.getElementById('userModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    async function openEditModal(id) {
        createModal();
        editingUserId = id;
        document.getElementById('userModalTitle').textContent = 'Edit User';
        document.getElementById('userModalSubmit').innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
        document.getElementById('passwordRow').style.display = 'none';
        document.getElementById('userPassword').required = false;
        document.getElementById('userModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const data = await API.get(`/users/${id}`);
            const user = data.data?.user;
            if (user) {
                document.getElementById('userFirstName').value = user.firstName || '';
                document.getElementById('userLastName').value = user.lastName || '';
                document.getElementById('userEmail').value = user.email || '';
                document.getElementById('userRole').value = user.role || 'student';
                document.getElementById('userStatus').value = user.status || 'active';
                document.getElementById('userMaxBooks').value = user.maxBooksAllowed || 5;
                document.getElementById('userPhone').value = user.phone || '';
            }
        } catch (err) {
            showToast('Failed to load user details', 'error');
        }
    }

    function closeModal() {
        const overlay = document.getElementById('userModalOverlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        editingUserId = null;
    }

    async function handleUserSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('userModalSubmit');
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';

        const body = {
            firstName: document.getElementById('userFirstName').value.trim(),
            lastName: document.getElementById('userLastName').value.trim(),
            email: document.getElementById('userEmail').value.trim(),
            role: document.getElementById('userRole').value,
            status: document.getElementById('userStatus').value,
            maxBooksAllowed: parseInt(document.getElementById('userMaxBooks').value) || 5,
        };

        const phone = document.getElementById('userPhone').value.trim();
        if (phone) body.phone = phone;

        if (!editingUserId) {
            const password = document.getElementById('userPassword').value;
            if (!password || password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                return;
            }
            body.password = password;
        }

        try {
            if (editingUserId) {
                await API.put(`/users/${editingUserId}`, body);
                showToast('User updated successfully', 'success');
            } else {
                await API.post('/users', body);
                showToast('User created successfully!', 'success');
            }
            closeModal();
            currentPage = 1;
            fetchUsers();
        } catch (err) {
            const msg = err.errors ? err.errors.map(e => e.msg || e.message).join(', ') : (err.message || 'Failed to save user');
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

    // ─── Utilities ───
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
    }

    // ─── Filter Panel Toggles ───
    function initFilterPanels() {
        // Role filter toggle
        if (roleFilterBtn && roleFilterPanel) {
            roleFilterBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                roleFilterPanel.style.display = roleFilterPanel.style.display === 'none' ? 'block' : 'none';
                if (statusFilterPanel) statusFilterPanel.style.display = 'none';
            });
        }

        // Status filter toggle
        if (statusFilterBtn && statusFilterPanel) {
            statusFilterBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                statusFilterPanel.style.display = statusFilterPanel.style.display === 'none' ? 'block' : 'none';
                if (roleFilterPanel) roleFilterPanel.style.display = 'none';
            });
        }

        // Close filter panels when clicking outside
        document.addEventListener('click', function (e) {
            if (roleFilterPanel && !e.target.closest('.filter-btn-role') && !e.target.closest('.role-filter-panel')) {
                roleFilterPanel.style.display = 'none';
            }
            if (statusFilterPanel && !e.target.closest('.filter-btn-status') && !e.target.closest('.status-filter-panel')) {
                statusFilterPanel.style.display = 'none';
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
                const deleteBtn = e.target.closest('.delete-user-btn');
                if (deleteBtn) {
                    e.stopPropagation();
                    e.preventDefault();
                    const id = deleteBtn.getAttribute('data-id');
                    if (id) showDeleteConfirm(id, 'user');
                    return;
                }
                const editBtn = e.target.closest('.edit-user-btn');
                if (editBtn) {
                    e.stopPropagation();
                    e.preventDefault();
                    const id = editBtn.getAttribute('data-id');
                    if (id) openEditModal(id);
                    return;
                }
            });
        }

        // Wire up Add User button
        if (addUserBtn) addUserBtn.addEventListener('click', openAddModal);

        // Initialize filter panel toggles
        initFilterPanels();

        // Filters — trigger API reload
        roleCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => { currentPage = 1; fetchUsers(); });
        });
        statusCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => { currentPage = 1; fetchUsers(); });
        });

        const resetRoleFilter = document.querySelector('.reset-role-filter');
        const resetStatusFilter = document.querySelector('.reset-status-filter');
        if (resetRoleFilter) resetRoleFilter.addEventListener('click', () => { roleCheckboxes.forEach(cb => cb.checked = false); currentPage = 1; fetchUsers(); });
        if (resetStatusFilter) resetStatusFilter.addEventListener('click', () => { statusCheckboxes.forEach(cb => cb.checked = false); currentPage = 1; fetchUsers(); });

        // Load users
        fetchUsers();
    });
})();
