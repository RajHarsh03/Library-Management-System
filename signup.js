// ===== SIGNUP PAGE LOGIC =====
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const signupBtn = document.getElementById('signupBtn');
    
    // Form inputs
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const studentIdInput = document.getElementById('studentId');
    const phoneInput = document.getElementById('phone');
    const majorInput = document.getElementById('major');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordToggleIcon = document.getElementById('passwordToggleIcon');
    const agreeTermsInput = document.getElementById('agreeTerms');
    
    // Error elements
    const firstNameError = document.getElementById('firstNameError');
    const lastNameError = document.getElementById('lastNameError');
    const emailError = document.getElementById('emailError');
    const studentIdError = document.getElementById('studentIdError');
    const phoneError = document.getElementById('phoneError');
    const majorError = document.getElementById('majorError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const termsError = document.getElementById('termsError');
    
    // Password requirement indicators
    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqLower = document.getElementById('req-lower');
    const reqNumber = document.getElementById('req-number');

    // ===== Toast Notification System =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            error: 'error_outline',
            success: 'check_circle_outline',
            info: 'info_outline'
        };

        toast.innerHTML = `
            <span class="material-icons-outlined">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.animate([
                { opacity: 1, transform: 'translateX(0)' },
                { opacity: 0, transform: 'translateX(400px)' }
            ], {
                duration: 300,
                fill: 'forwards'
            });
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== Password Visibility Toggle =====
    passwordToggle.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon.textContent = isPassword ? 'visibility' : 'visibility_off';
        passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });

    // ===== Password Requirements Validator =====
    function validatePasswordRequirements(password) {
        const requirements = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password)
        };

        // Update visual indicators
        updateRequirementIndicator(reqLength, requirements.length);
        updateRequirementIndicator(reqUpper, requirements.upper);
        updateRequirementIndicator(reqLower, requirements.lower);
        updateRequirementIndicator(reqNumber, requirements.number);

        return Object.values(requirements).every(req => req === true);
    }

    function updateRequirementIndicator(element, isMet) {
        if (isMet) {
            element.classList.add('met');
        } else {
            element.classList.remove('met');
        }
    }

    // ===== Form Validation =====
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
        return /^[\d\s\-\+\(\)]+$/.test(phone.replace(/\s/g, '')) && phone.replace(/\D/g, '').length >= 10;
    }

    function showError(input, errorEl, message) {
        const group = input.closest('.form-group');
        if (group) {
            group.classList.add('has-error');
        }
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }

    function clearError(input, errorEl) {
        const group = input.closest('.form-group');
        if (group) {
            group.classList.remove('has-error');
        }
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
    }

    // Clear errors on input
    firstNameInput.addEventListener('input', () => clearError(firstNameInput, firstNameError));
    lastNameInput.addEventListener('input', () => clearError(lastNameInput, lastNameError));
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    studentIdInput.addEventListener('input', () => clearError(studentIdInput, studentIdError));
    phoneInput.addEventListener('input', () => clearError(phoneInput, phoneError));
    majorInput.addEventListener('change', () => clearError(majorInput, majorError));
    passwordInput.addEventListener('input', () => {
        clearError(passwordInput, passwordError);
        if (passwordInput.value) {
            validatePasswordRequirements(passwordInput.value);
        }
    });
    confirmPasswordInput.addEventListener('input', () => clearError(confirmPasswordInput, confirmPasswordError));
    agreeTermsInput.addEventListener('change', () => {
        if (agreeTermsInput.checked) {
            termsError.classList.remove('visible');
            termsError.textContent = '';
        }
    });

    // ===== Form Submission =====
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Reset all errors
        document.querySelectorAll('.form-error').forEach(el => {
            el.classList.remove('visible');
            el.textContent = '';
        });

        let isValid = true;

        // Validate First Name
        if (!firstNameInput.value.trim()) {
            showError(firstNameInput, firstNameError, 'First name is required');
            isValid = false;
        }

        // Validate Last Name
        if (!lastNameInput.value.trim()) {
            showError(lastNameInput, lastNameError, 'Last name is required');
            isValid = false;
        }

        // Validate Email
        if (!emailInput.value.trim()) {
            showError(emailInput, emailError, 'Email is required');
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            isValid = false;
        }

        // Validate Student ID
        if (!studentIdInput.value.trim()) {
            showError(studentIdInput, studentIdError, 'Student ID is required');
            isValid = false;
        }

        // Validate Phone
        if (!phoneInput.value.trim()) {
            showError(phoneInput, phoneError, 'Phone number is required');
            isValid = false;
        } else if (!validatePhone(phoneInput.value)) {
            showError(phoneInput, phoneError, 'Please enter a valid phone number');
            isValid = false;
        }

        // Validate Major
        if (!majorInput.value) {
            showError(majorInput, majorError, 'Please select your major/field');
            isValid = false;
        }

        // Validate Password
        if (!passwordInput.value) {
            showError(passwordInput, passwordError, 'Password is required');
            isValid = false;
        } else if (!validatePasswordRequirements(passwordInput.value)) {
            showError(passwordInput, passwordError, 'Password does not meet requirements');
            isValid = false;
        }

        // Validate Confirm Password
        if (!confirmPasswordInput.value) {
            showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password');
            isValid = false;
        } else if (passwordInput.value !== confirmPasswordInput.value) {
            showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match');
            isValid = false;
        }

        // Validate Terms Agreement
        if (!agreeTermsInput.checked) {
            termsError.textContent = 'You must agree to the terms and conditions';
            termsError.classList.add('visible');
            isValid = false;
        }

        if (!isValid) {
            showToast('Please fix the errors above', 'error');
            return;
        }

        // Show loading state
        signupBtn.classList.add('loading');
        signupBtn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            signupBtn.classList.remove('loading');
            signupBtn.disabled = false;

            // Success
            showToast('Account created successfully! Redirecting to login...', 'success');

            // Simulate form data submission
            const formData = {
                firstName: firstNameInput.value,
                lastName: lastNameInput.value,
                email: emailInput.value,
                studentId: studentIdInput.value,
                phone: phoneInput.value,
                major: majorInput.value,
                newsletter: document.getElementById('agreeNewsletter').checked
            };

            console.log('Form Data:', formData);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }, 1500);
    });

    // ===== Counter Animation =====
    function animateCounter(element, target, duration = 2000) {
        let current = 0;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, 16);
    }

    // Start counter animation when page loads
    const counters = document.querySelectorAll('[data-count]');
    setTimeout(() => {
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-count'));
            animateCounter(counter, target);
        });
    }, 300);
});
