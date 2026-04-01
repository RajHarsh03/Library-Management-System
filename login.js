// ===== LOGIN PAGE LOGIC =====
document.addEventListener('DOMContentLoaded', () => {
    const roleToggle = document.getElementById('roleToggle');
    const studentBtn = document.getElementById('studentRoleBtn');
    const adminBtn = document.getElementById('adminRoleBtn');
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const emailInput = document.getElementById('emailInput');

    let currentRole = 'student';

    // Role Toggle
    studentBtn.addEventListener('click', () => {
        currentRole = 'student';
        studentBtn.classList.add('active');
        adminBtn.classList.remove('active');
        roleToggle.removeAttribute('data-active');
        emailInput.placeholder = 'name@university.edu';
    });

    adminBtn.addEventListener('click', () => {
        currentRole = 'admin';
        adminBtn.classList.add('active');
        studentBtn.classList.remove('active');
        roleToggle.setAttribute('data-active', 'admin');
        emailInput.placeholder = 'admin@archivist.sys';
    });

    // Form Submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginBtn.classList.add('loading');

        // Simulate authentication
        setTimeout(() => {
            if (currentRole === 'admin') {
                window.location.href = 'admin/dashboard.html';
            } else {
                window.location.href = 'student/dashboard.html';
            }
        }, 1200);
    });

    // Input focus animations
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.closest('.input-wrapper').querySelector('.input-icon').style.color = '#2563eb';
        });
        input.addEventListener('blur', () => {
            input.closest('.input-wrapper').querySelector('.input-icon').style.color = '';
        });
    });
});
