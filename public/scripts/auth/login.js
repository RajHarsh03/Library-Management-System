// ===== LOGIN PAGE LOGIC =====
document.addEventListener('DOMContentLoaded', () => {
    const roleToggle = document.getElementById('roleToggle');
    const studentBtn = document.getElementById('studentRoleBtn');
    const adminBtn = document.getElementById('adminRoleBtn');
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordToggleIcon = document.getElementById('passwordToggleIcon');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    let currentRole = 'student';
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
            toast.classList.add('removing');
            toast.addEventListener('animationend', () => toast.remove());
        }, 4000);
    }

    // ===== Password Visibility Toggle =====
    passwordToggle.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon.textContent = isPassword ? 'visibility' : 'visibility_off';
        passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });

    // ===== Form Validation =====
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showError(input, errorEl, message) {
        const group = input.closest('.form-group');
        group.classList.add('has-error');
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

    // Clear errors on input
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    passwordInput.addEventListener('input', () => clearError(passwordInput, passwordError));

    // ===== Role Toggle =====
    studentBtn.addEventListener('click', () => {
        currentRole = 'student';
        studentBtn.classList.add('active');
        studentBtn.setAttribute('aria-selected', 'true');
        adminBtn.classList.remove('active');
        adminBtn.setAttribute('aria-selected', 'false');
        roleToggle.removeAttribute('data-active');
        emailInput.placeholder = 'name@university.edu';
    });

    adminBtn.addEventListener('click', () => {
        currentRole = 'admin';
        adminBtn.classList.add('active');
        adminBtn.setAttribute('aria-selected', 'true');
        studentBtn.classList.remove('active');
        studentBtn.setAttribute('aria-selected', 'false');
        roleToggle.setAttribute('data-active', 'admin');
        emailInput.placeholder = 'admin@archivist.sys';
    });

    // ===== Form Submission =====
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let valid = true;

        // Validate email
        if (!emailInput.value.trim()) {
            showError(emailInput, emailError, 'Email address is required.');
            valid = false;
        } else if (!validateEmail(emailInput.value)) {
            showError(emailInput, emailError, 'Please enter a valid email address.');
            valid = false;
        }

        // Validate password
        if (!passwordInput.value) {
            showError(passwordInput, passwordError, 'Security code is required.');
            valid = false;
        } else if (passwordInput.value.length < 4) {
            showError(passwordInput, passwordError, 'Security code must be at least 4 characters.');
            valid = false;
        }

        if (!valid) {
            showToast('Please fill the details', 'error');
            return;
        }

        loginBtn.classList.add('loading');

        try {
            // Call the real backend API
            const data = await API.login(emailInput.value.trim(), passwordInput.value);

            if (data.success) {
                const user = data.data.user;
                showToast('Authentication successful. Redirecting...', 'success');

                setTimeout(() => {
                    if (user.role === 'admin' || user.role === 'librarian') {
                        window.location.href = '/admin/dashboard';
                    } else {
                        window.location.href = '/student/dashboard';
                    }
                }, 600);
            } else {
                showToast(data.message || 'Login failed', 'error');
                loginBtn.classList.remove('loading');
            }
        } catch (err) {
            const message = err.message || 'Login failed. Please check your credentials.';
            showToast(message, 'error');
            loginBtn.classList.remove('loading');
        }
    });

    // ===== Input Focus Animations =====
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            const icon = input.closest('.input-wrapper').querySelector('.input-icon');
            if (icon) icon.style.color = '#2563eb';
        });
        input.addEventListener('blur', () => {
            const icon = input.closest('.input-wrapper').querySelector('.input-icon');
            if (icon) icon.style.color = '';
        });
    });

    // ===== Animated Counter for Hero Stats =====
    function animateCounters() {
        const counters = document.querySelectorAll('.hero-stat-value[data-count]');
        counters.forEach(counter => {
            const target = parseInt(counter.dataset.count, 10);
            const duration = 1800;
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease-out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(eased * target);

                counter.textContent = current.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }

            requestAnimationFrame(update);
        });
    }

    // Start counters after a short delay for visual effect
    setTimeout(animateCounters, 500);

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
            // Page was restored from bfcache — reset everything
            loginBtn.classList.remove('loading');
            loginForm.reset();
            clearError(emailInput, emailError);
            clearError(passwordInput, passwordError);
            passwordInput.type = 'password';
            passwordToggleIcon.textContent = 'visibility_off';
        }
    });

    // ===== Enhanced Input Interactions =====
    // Add ripple effect on focus
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            const wrapper = input.closest('.input-wrapper');
            if (wrapper) {
                wrapper.style.transform = 'scale(1.01)';
            }
        });
        
        input.addEventListener('blur', () => {
            const wrapper = input.closest('.input-wrapper');
            if (wrapper) {
                wrapper.style.transform = 'scale(1)';
            }
        });
    });

    // ===== Hero Stats Animation Enhancement =====
    function animateHeroStats() {
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.style.opacity = '0';
            heroContent.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                heroContent.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
                heroContent.style.opacity = '1';
                heroContent.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    // Run hero animation on load
    animateHeroStats();

    // ===== Enhanced Toast Positioning =====
    // Position toast based on screen size
    function updateToastPosition() {
        const container = document.getElementById('toastContainer');
        if (window.innerWidth <= 768) {
            container.style.left = '12px';
            container.style.right = '12px';
        } else {
            container.style.left = 'auto';
            container.style.right = '24px';
        }
    }

    window.addEventListener('resize', updateToastPosition);
    updateToastPosition();

    // ===== Keyboard Navigation Enhancement =====
    // Allow Enter key to toggle role
    roleToggle.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (currentRole === 'student') {
                adminBtn.click();
            } else {
                studentBtn.click();
            }
        }
    });

    // ===== Form Submit with Enhanced Feedback =====
    loginForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            // Allow default form submission which is handled by submit event
        }
    });
});
