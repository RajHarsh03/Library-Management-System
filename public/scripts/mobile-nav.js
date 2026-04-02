/* ===== Mobile Navigation Handler ===== */

document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const appLayout = document.querySelector('.app-layout');

    if (!mobileMenuBtn || !sidebar) return;

    // Function to close sidebar
    function closeSidebar() {
        sidebar.classList.remove('open');
        appLayout.classList.remove('sidebar-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }

    // Function to open sidebar
    function openSidebar() {
        sidebar.classList.add('open');
        appLayout.classList.add('sidebar-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'true');
    }

    // Handle mobile menu toggle
    mobileMenuBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        appLayout.classList.toggle('sidebar-open', isOpen);
        mobileMenuBtn.setAttribute('aria-expanded', isOpen);
    });

    // Handle mobile close button
    if (mobileCloseBtn) {
        mobileCloseBtn.addEventListener('click', () => {
            closeSidebar();
        });
    }

    // Close mobile menu when clicking on a nav item
    const navItems = sidebar.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    // Close menus on window resize (when switching from mobile to desktop)
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
});
