/**
 * Settings Manager — Admin Settings Page
 * Handles loading, saving, and resetting library settings
 */
(function () {
    'use strict';

    // ─── Auth Guard ───
    if (!API.requireAuth(['admin'])) return;

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

    // ─── DOM References ───
    const form = document.getElementById('settingsForm');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const resetBtn = document.getElementById('resetSettingsBtn');
    const dangerResetBtn = document.getElementById('dangerResetBtn');
    const resetModalOverlay = document.getElementById('resetModalOverlay');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    const confirmResetBtn = document.getElementById('confirmResetBtn');
    const maintenanceModeCheckbox = document.getElementById('maintenanceMode');
    const maintenanceMsgGroup = document.getElementById('maintenanceMsgGroup');

    // Text & number fields
    const textFields = [
        'libraryName', 'libraryTagline', 'contactEmail', 'contactPhone', 'address',
        'maintenanceMessage',
    ];
    const numberFields = [
        'maxBooksPerStudent', 'defaultLoanDays', 'maxRenewals',
        'finePerDay', 'maxFineAmount', 'gracePeriodDays', 'dueDateReminderDays',
    ];
    const booleanFields = [
        'enableEmailNotifications', 'enableOverdueAlerts',
        'allowStudentRegistration', 'maintenanceMode',
    ];

    // Track unsaved changes
    let hasChanges = false;
    let originalData = {};

    // ─── Load Settings ───
    async function loadSettings() {
        const sections = document.querySelectorAll('.settings-section');
        sections.forEach(s => s.classList.add('loading'));

        try {
            const data = await API.get('/settings');
            if (data.success && data.data) {
                populateForm(data.data);
                originalData = { ...data.data };
            }
        } catch (err) {
            showToast('Failed to load settings', 'error');
            console.error('loadSettings error:', err);
        } finally {
            sections.forEach(s => s.classList.remove('loading'));
        }
    }

    // ─── Populate Form ───
    function populateForm(settings) {
        // Text & number fields
        [...textFields, ...numberFields].forEach(field => {
            const el = document.getElementById(field);
            if (el && settings[field] !== undefined) {
                el.value = settings[field];
            }
        });

        // Boolean (checkbox) fields
        booleanFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && settings[field] !== undefined) {
                el.checked = settings[field];
            }
        });

        // Show/hide maintenance message
        toggleMaintenanceMsg();
        hasChanges = false;
        updateSaveBtn();
    }

    // ─── Collect Form Data ───
    function collectFormData() {
        const data = {};

        textFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) data[field] = el.value.trim();
        });

        numberFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) data[field] = parseFloat(el.value) || 0;
        });

        booleanFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) data[field] = el.checked;
        });

        return data;
    }

    // ─── Save Settings ───
    async function saveSettings() {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-icons-outlined" style="animation:spin 1s linear infinite;">sync</span> SAVING...';

        try {
            const formData = collectFormData();
            const result = await API.put('/settings', formData);
            if (result.success) {
                showToast('Settings saved successfully!', 'success');
                originalData = { ...formData };
                hasChanges = false;
                updateSaveBtn();
            } else {
                showToast(result.message || 'Failed to save settings', 'error');
            }
        } catch (err) {
            const msg = err.message || 'Failed to save settings';
            showToast(msg, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> SAVE CHANGES';
        }
    }

    // ─── Reset Settings ───
    async function resetSettings() {
        confirmResetBtn.disabled = true;
        confirmResetBtn.textContent = 'Resetting...';

        try {
            const result = await API.post('/settings/reset', {});
            if (result.success) {
                populateForm(result.data);
                showToast('Settings reset to defaults', 'success');
                closeResetModal();
            } else {
                showToast(result.message || 'Failed to reset', 'error');
            }
        } catch (err) {
            showToast('Failed to reset settings', 'error');
        } finally {
            confirmResetBtn.disabled = false;
            confirmResetBtn.textContent = 'Reset Everything';
        }
    }

    // ─── Maintenance Toggle ───
    function toggleMaintenanceMsg() {
        if (maintenanceModeCheckbox && maintenanceMsgGroup) {
            maintenanceMsgGroup.style.display = maintenanceModeCheckbox.checked ? 'flex' : 'none';
        }
    }

    // ─── Unsaved Changes UI ───
    function updateSaveBtn() {
        if (hasChanges) {
            saveBtn.style.boxShadow = '0 2px 12px rgba(37, 99, 235, 0.4)';
        } else {
            saveBtn.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.25)';
        }
    }

    // ─── Modal Controls ───
    function openResetModal() {
        resetModalOverlay.classList.add('active');
    }

    function closeResetModal() {
        resetModalOverlay.classList.remove('active');
    }

    // ─── Event Listeners ───

    // Save button
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveSettings();
    });

    // Reset buttons
    resetBtn.addEventListener('click', openResetModal);
    dangerResetBtn.addEventListener('click', openResetModal);
    cancelResetBtn.addEventListener('click', closeResetModal);
    confirmResetBtn.addEventListener('click', resetSettings);

    // Close modal on overlay click
    resetModalOverlay.addEventListener('click', (e) => {
        if (e.target === resetModalOverlay) closeResetModal();
    });

    // Maintenance mode toggle
    if (maintenanceModeCheckbox) {
        maintenanceModeCheckbox.addEventListener('change', toggleMaintenanceMsg);
    }

    // Track changes on all inputs
    form.addEventListener('input', () => {
        hasChanges = true;
        updateSaveBtn();
    });

    form.addEventListener('change', () => {
        hasChanges = true;
        updateSaveBtn();
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Prevent form default submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
    });

    // ─── Init ───
    loadSettings();

})();
