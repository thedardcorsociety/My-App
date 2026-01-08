document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passwordInput');
    const loginForm = document.getElementById('loginForm');

    if (toggleBtn && passwordInput) {
        const icon = toggleBtn.querySelector('i');
        toggleBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text'; 
                icon.classList.remove('fa-eye'); 
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password'; 
                icon.classList.remove('fa-eye-slash'); 
                icon.classList.add('fa-eye');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const btnText = submitBtn.querySelector('span');
            const btnLoader = document.getElementById('btnLoader');
            const errorMessage = document.getElementById('errorMessage');
            
            submitBtn.disabled = true; 
            btnText.textContent = 'Signing In...'; 
            btnLoader.classList.remove('hidden'); 
            errorMessage.classList.add('hidden');
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const response = await fetch('/dardcor-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                
                if (result.success) {
                    setTimeout(() => {
                         const targetUrl = result.redirectUrl || '/dardcorchat/dardcor-ai';
                         window.location.replace(targetUrl);
                    }, 500);
                } else {
                    throw new Error(result.message || 'Login failed');
                }
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.remove('hidden'); 
                submitBtn.disabled = false; 
                btnText.textContent = 'Sign In'; 
                btnLoader.classList.add('hidden');
            }
        });
    }
});