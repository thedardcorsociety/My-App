document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('content');
    const pwaBtn = document.getElementById('pwa-install-btn');
    let deferredPrompt;

    window.toggleSidebar = function() {
        const isMobile = window.innerWidth < 1024;
        const isClosed = sidebar.classList.contains('-translate-x-full');

        if (isClosed) {
            sidebar.classList.remove('-translate-x-full');
            if (isMobile) {
                overlay.classList.remove('hidden');
            } else {
                content.classList.add('lg:ml-72');
            }
        } else {
            sidebar.classList.add('-translate-x-full');
            if (isMobile) {
                overlay.classList.add('hidden');
            } else {
                content.classList.remove('lg:ml-72');
            }
        }
    };

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            overlay.classList.add('hidden');
        }
    });

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });

    if (pwaBtn) {
        pwaBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
            }
        });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js');
        });
    }
});