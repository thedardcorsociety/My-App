document.addEventListener('DOMContentLoaded', () => {
    const otpForm = document.getElementById('otpForm');
    
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpInput = document.getElementById('otp');
            const otp = otpInput.value.trim();
            const email = document.getElementById('userEmail').value;
            const btn = document.getElementById('btnVerify');
            const msg = document.getElementById('msg');
            const originalBtnContent = '<span>Verifikasi</span><i class="fas fa-arrow-right"></i>';

            if(otp.length < 6) {
                msg.textContent = "Masukkan 6 digit kode OTP.";
                msg.classList.remove('hidden');
                return;
            }
            
            btn.disabled = true;
            btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Memproses...</span>';
            msg.classList.add('hidden');

            try {
                const res = await fetch('/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp }) 
                });
                const data = await res.json();

                if(data.success) {
                    btn.innerHTML = '<i class="fas fa-check"></i><span>Berhasil!</span>';
                    btn.classList.remove('bg-[#2e1065]', 'hover:bg-purple-900', 'border-purple-700');
                    btn.classList.add('bg-green-600', 'border-green-500');
                    
                    msg.textContent = "Mengalihkan ke Dardcor AI...";
                    msg.classList.remove('text-red-400', 'hidden');
                    msg.classList.add('text-green-400', 'mt-2', 'block');
                    
                    setTimeout(() => {
                        window.location.href = data.redirectUrl || '/dardcorchat/dardcor-ai';
                    }, 1000);
                } else {
                    throw new Error(data.message);
                }
            } catch (err) {
                msg.textContent = err.message || "Gagal verifikasi.";
                msg.classList.remove('hidden', 'text-green-400');
                msg.classList.add('text-red-400', 'mt-2', 'block');
                
                btn.disabled = false;
                btn.innerHTML = originalBtnContent;
                btn.classList.remove('bg-green-600', 'border-green-500');
                btn.classList.add('bg-[#2e1065]', 'border-purple-700');
            }
        });
    }
});