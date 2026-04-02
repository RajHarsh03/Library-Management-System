// ===== FORGOT PASSWORD PAGE LOGIC =====
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const resetForm = document.getElementById('resetForm');
    const emailInput = document.getElementById('emailInput');
    const emailError = document.getElementById('emailError');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    
    const codeInput = document.getElementById('codeInput');
    const codeError = document.getElementById('codeError');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const backStep1Btn = document.getElementById('backStep1Btn');
    
    const newPasswordInput = document.getElementById('newPasswordInput');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    
    const passwordToggle1 = document.getElementById('passwordToggle1');
    const passwordToggleIcon1 = document.getElementById('passwordToggleIcon1');
    const passwordToggle2 = document.getElementById('passwordToggle2');
    const passwordToggleIcon2 = document.getElementById('passwordToggleIcon2');
    
    // Requirements
    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqLower = document.getElementById('req-lower');
    const reqNumber = document.getElementById('req-number');
    
    // Step elements
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');
    
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');
    
    let currentStep = 1;
    const errorTimeouts = new WeakMap();
    let verificationEmail = '';

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
        // Hide all steps
        [step1, step2, step3, step4].forEach(el => el.classList.remove('active'));
        
        // Show target step
        switch(step) {
            case 1:
                step1.classList.add('active');
                formTitle.textContent = 'Find Your Account';
                formSubtitle.textContent = 'Enter your email address below, and we\'ll send you a verification code.';
                currentStep = 1;
                break;
            case 2:
                step2.classList.add('active');
                formTitle.textContent = 'Verify Your Email';
                formSubtitle.textContent = `We've sent a verification code to ${verificationEmail}`;
                currentStep = 2;
                break;
            case 3:
                step3.classList.add('active');
                formTitle.textContent = 'Set New Password';
                formSubtitle.textContent = 'Create a strong password to secure your account.';
                currentStep = 3;
                break;
            case 4:
                step4.classList.add('active');
                currentStep = 4;
                break;
        }
    }

    // ===== Form Validation Helpers =====
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePasswordRequirements(password) {
        const requirements = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password)
        };

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

    // ===== Error Handling =====
    function showError(input, errorEl, message) {
        const group = input.closest('.form-group');
        if (group) {
            group.classList.add('has-error');
        }
        errorEl.textContent = message;
        errorEl.classList.add('visible');
        
        const existingTimeout = errorTimeouts.get(errorEl);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        const timeout = setTimeout(() => {
            clearError(input, errorEl);
        }, 4000);
        
        errorTimeouts.set(errorEl, timeout);
    }

    function clearError(input, errorEl) {
        const group = input.closest('.form-group');
        if (errorEl.classList.contains('visible')) {
            errorEl.classList.remove('visible');
            setTimeout(() => {
                if (group) {
                    group.classList.remove('has-error');
                }
                errorEl.textContent = '';
            }, 250);
        } else {
            if (group) {
                group.classList.remove('has-error');
            }
            errorEl.textContent = '';
        }
        
        const existingTimeout = errorTimeouts.get(errorEl);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            errorTimeouts.delete(errorEl);
        }
    }

    // ===== Password Visibility Toggle =====
    passwordToggle1.addEventListener('click', () => {
        const isPassword = newPasswordInput.type === 'password';
        newPasswordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon1.textContent = isPassword ? 'visibility' : 'visibility_off';
    });

    passwordToggle2.addEventListener('click', () => {
        const isPassword = confirmPasswordInput.type === 'password';
        confirmPasswordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon2.textContent = isPassword ? 'visibility' : 'visibility_off';
    });

    // ===== Input Listeners - Clear Errors =====
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    codeInput.addEventListener('input', () => clearError(codeInput, codeError));
    newPasswordInput.addEventListener('input', () => {
        clearError(newPasswordInput, newPasswordError);
        if (newPasswordInput.value) {
            validatePasswordRequirements(newPasswordInput.value);
        }
    });
    confirmPasswordInput.addEventListener('input', () => clearError(confirmPasswordInput, confirmPasswordError));

    // ===== Step 1: Send Code =====
    sendCodeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearError(emailInput, emailError);

        if (!emailInput.value.trim()) {
            showError(emailInput, emailError, 'Email address is required');
            showToast('Please fill the details', 'error');
            return;
        }

        if (!validateEmail(emailInput.value)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            showToast('Please fill the details', 'error');
            return;
        }

        // Simulate sending code
        sendCodeBtn.classList.add('loading');
        sendCodeBtn.disabled = true;

        setTimeout(() => {
            sendCodeBtn.classList.remove('loading');
            sendCodeBtn.disabled = false;

            verificationEmail = emailInput.value;
            goToStep(2);
            showToast('Verification code sent to your email', 'success');
        }, 1500);
    });

    // ===== Step 2: Resend Code =====
    resendCodeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        resendCodeBtn.disabled = true;
        resendCodeBtn.textContent = 'Sending...';

        setTimeout(() => {
            resendCodeBtn.disabled = false;
            resendCodeBtn.textContent = 'Resend Code';
            showToast('Verification code sent', 'success');
        }, 1500);
    });

    // ===== Step 2: Go Back =====
    if (backStep1Btn) {
        backStep1Btn.addEventListener('click', (e) => {
            e.preventDefault();
            goToStep(1);
            emailInput.value = '';
            codeInput.value = '';
        });
    }

    // ===== Step 2: Verify Code =====
    verifyCodeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearError(codeInput, codeError);

        if (!codeInput.value.trim()) {
            showError(codeInput, codeError, 'Verification code is required');
            showToast('Please fill the details', 'error');
            return;
        }

        if (codeInput.value.length !== 6 || !/^\d+$/.test(codeInput.value)) {
            showError(codeInput, codeError, 'Please enter a valid 6-digit code');
            showToast('Please fill the details', 'error');
            return;
        }

        // Simulate verification
        verifyCodeBtn.classList.add('loading');
        verifyCodeBtn.disabled = true;

        setTimeout(() => {
            verifyCodeBtn.classList.remove('loading');
            verifyCodeBtn.disabled = false;

            goToStep(3);
            showToast('Code verified successfully', 'success');
        }, 1500);
    });

    // ===== Step 3: Reset Password =====
    resetPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();

        clearError(newPasswordInput, newPasswordError);
        clearError(confirmPasswordInput, confirmPasswordError);

        let isValid = true;

        // Validate new password
        if (!newPasswordInput.value) {
            showError(newPasswordInput, newPasswordError, 'Password is required');
            isValid = false;
        } else if (!validatePasswordRequirements(newPasswordInput.value)) {
            showError(newPasswordInput, newPasswordError, 'Password does not meet requirements');
            isValid = false;
        }

        // Validate confirm password
        if (!confirmPasswordInput.value) {
            showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password');
            isValid = false;
        } else if (newPasswordInput.value !== confirmPasswordInput.value) {
            showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match');
            isValid = false;
        }

        if (!isValid) {
            showToast('Please fill the details', 'error');
            return;
        }

        // Simulate password reset
        resetPasswordBtn.classList.add('loading');
        resetPasswordBtn.disabled = true;

        setTimeout(() => {
            resetPasswordBtn.classList.remove('loading');
            resetPasswordBtn.disabled = false;

            goToStep(4);
            showToast('Password reset successfully, redirecting to login', 'success');

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }, 1500);
    });

    // ===== Hero Canvas Animation =====
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

    // Initialize hero canvas
    initHeroCanvas();

    // ===== Initialize =====
    goToStep(1);

    // ===== Reset on browser back (bfcache) =====
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            // Reset all loading buttons
            [sendCodeBtn, verifyCodeBtn, resetPasswordBtn].forEach(btn => {
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            });
            // Reset form and go back to step 1
            const form = document.getElementById('forgotForm');
            if (form) form.reset();
            goToStep(1);
        }
    });
});
