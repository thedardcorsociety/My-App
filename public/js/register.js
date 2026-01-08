document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleRegPassword');
    const passwordInput = document.getElementById('regPassword');
    const registerForm = document.getElementById('registerForm');

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

    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const btnText = submitBtn.querySelector('span');
            const btnLoader = document.getElementById('btnLoader');
            const errorMessage = document.getElementById('errorMessage');
            
            submitBtn.disabled = true;
            btnText.textContent = 'Mengirim OTP...'; 
            btnLoader.classList.remove('hidden');
            errorMessage.classList.add('hidden');

            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    window.location.href = result.redirectUrl || '/verify-otp';
                } else {
                    throw new Error(result.message || 'Registration failed');
                }
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.remove('hidden');
                submitBtn.disabled = false;
                btnText.textContent = 'Register';
                btnLoader.classList.add('hidden');
            }
        });
    }
});