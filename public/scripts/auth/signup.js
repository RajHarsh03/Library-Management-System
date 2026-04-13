// ===== SIGNUP PAGE LOGIC - TWO STEP FORM =====
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const nextBtn = document.getElementById('nextBtn');
    const backBtn = document.getElementById('backBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    // Form steps
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step1Indicator = document.getElementById('step1Indicator');
    const step2Indicator = document.getElementById('step2Indicator');
    
    // Step 1 inputs
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const mobileVerificationInput = document.getElementById('mobileVerification');
    
    // Step 2 inputs
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordToggleIcon = document.getElementById('passwordToggleIcon');
    const agreeTermsInput = document.getElementById('agreeTerms');
    
    // Error elements - Step 1
    const firstNameError = document.getElementById('firstNameError');
    const lastNameError = document.getElementById('lastNameError');
    const emailError = document.getElementById('emailError');
    const phoneError = document.getElementById('phoneError');
    
    // Error elements - Step 2
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const termsError = document.getElementById('termsError');
    
    // Password requirement indicators
    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqLower = document.getElementById('req-lower');
    const reqNumber = document.getElementById('req-number');

    let currentStep = 1;
    const errorTimeouts = new WeakMap(); // Store timeout IDs for auto-dismiss

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
        }, 5000);
    }

    // ===== Step Navigation =====
    function goToStep(step) {
        if (step === 1) {
            step1.classList.add('active');
            step2.classList.remove('active');
            step1Indicator.classList.add('active');
            step2Indicator.classList.remove('active');
            currentStep = 1;
        } else if (step === 2) {
            step1.classList.remove('active');
            step2.classList.add('active');
            step1Indicator.classList.remove('active');
            step2Indicator.classList.add('active');
            currentStep = 2;
        }
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
        if (!phone) return true; // Phone is optional on Step 1
        return /^[\d\s\-\+\(\)]+$/.test(phone.replace(/\s/g, '')) && phone.replace(/\D/g, '').length >= 10;
    }

    function showError(input, errorEl, message) {
        const group = input.closest('.form-group');
        if (group) {
            group.classList.add('has-error');
        }
        errorEl.textContent = message;
        errorEl.classList.add('visible');
        
        // Clear any existing timeout
        const existingTimeout = errorTimeouts.get(errorEl);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Auto-dismiss after 4 seconds
        const timeout = setTimeout(() => {
            clearError(input, errorEl);
        }, 4000);
        
        errorTimeouts.set(errorEl, timeout);
    }

    function clearError(input, errorEl) {
        const group = input.closest('.form-group');
        // Start fade-out animation
        if (errorEl.classList.contains('visible')) {
            errorEl.classList.remove('visible');
            // Remove outline and clear text after fade animation completes (250ms)
            setTimeout(() => {
                if (group) {
                    group.classList.remove('has-error');
                }
                errorEl.textContent = '';
            }, 250);
        } else {
            // If not visible, remove immediately
            if (group) {
                group.classList.remove('has-error');
            }
            errorEl.textContent = '';
        }
        
        // Cancel auto-dismiss timeout
        const timeout = errorTimeouts.get(errorEl);
        if (timeout) {
            clearTimeout(timeout);
            errorTimeouts.delete(errorEl);
        }
    }

    // Clear errors on input - Step 1
    firstNameInput.addEventListener('input', () => clearError(firstNameInput, firstNameError));
    lastNameInput.addEventListener('input', () => clearError(lastNameInput, lastNameError));
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    phoneInput.addEventListener('input', () => clearError(phoneInput, phoneError));
    
    // Clear errors on input - Step 2
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

    // ===== Next Button - Validate Step 1 =====
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Clear previous errors
        [firstNameError, lastNameError, emailError, phoneError].forEach(el => {
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

        // Validate Phone (optional, but if provided must be valid)
        if (phoneInput.value && !validatePhone(phoneInput.value)) {
            showError(phoneInput, phoneError, 'Please enter a valid phone number');
            isValid = false;
        }

        if (!isValid) {
            showToast('Please fill the details', 'error');
            return;
        }

        // Move to Step 2
        goToStep(2);
        showToast('Great! Now set up your password', 'success');
    });

    // ===== Back Button =====
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        goToStep(1);
    });

    // ===== Form Submission - Step 2 =====
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous errors
        [passwordError, confirmPasswordError, termsError].forEach(el => {
            el.classList.remove('visible');
            el.textContent = '';
        });

        let isValid = true;

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
            showToast('Please fill the details', 'error');
            return;
        }

        // Show loading state
        signupBtn.classList.add('loading');
        signupBtn.disabled = true;

        try {
            // Call the real backend API
            const userData = {
                firstName: firstNameInput.value.trim(),
                lastName: lastNameInput.value.trim(),
                email: emailInput.value.trim(),
                password: passwordInput.value,
                role: 'student',
            };

            // Add optional phone
            if (phoneInput.value.trim()) {
                userData.phone = phoneInput.value.trim();
            }

            const data = await API.register(userData);

            if (data.success) {
                showToast('Account created successfully! Redirecting...', 'success');

                // Redirect to student dashboard (user is already authenticated)
                setTimeout(() => {
                    window.location.href = '/student/dashboard';
                }, 1500);
            } else {
                showToast(data.message || 'Registration failed', 'error');
                signupBtn.classList.remove('loading');
                signupBtn.disabled = false;
            }
        } catch (err) {
            const message = err.message || 'Registration failed. Please try again.';
            showToast(message, 'error');
            signupBtn.classList.remove('loading');
            signupBtn.disabled = false;
        }
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

    // ===== Hero Canvas Particle Animation =====
    function initHeroCanvas() {
        const canvas = document.getElementById('heroCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        const PARTICLE_COUNT = 50;
        const CONNECTION_DISTANCE = 120;

        function resize() {
            const hero = canvas.parentElement;
            width = canvas.width = hero.offsetWidth;
            height = canvas.height = hero.offsetHeight;
        }

        function createParticles() {
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    radius: Math.random() * 1.5 + 0.5,
                    opacity: Math.random() * 0.3 + 0.1
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CONNECTION_DISTANCE) {
                        const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.12;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(100, 160, 255, ${opacity})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Draw particles
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(140, 190, 255, ${p.opacity})`;
                ctx.fill();

                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Bounce off edges
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;
            });

            requestAnimationFrame(draw);
        }

        resize();
        createParticles();
        draw();

        window.addEventListener('resize', () => {
            resize();
            createParticles();
        });
    }

    initHeroCanvas();

    // ===== Reset on browser back (bfcache) =====
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            signupBtn.classList.remove('loading');
            signupBtn.disabled = false;
            signupForm.reset();
            goToStep(1);
        }
    });
});
