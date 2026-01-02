document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // CORE VARIABLES & SERVER DATA
    // =========================================================================
    const serverData = window.SERVER_DATA || {};
    let currentToolType = serverData.toolType || 'basic';
    let selectedPersonaId = localStorage.getItem('activePersonaId') || null;
    let selectedPersonaName = localStorage.getItem('activePersonaName') || null;
    let currentUtterance = null;
    let chatToEdit = null;
    let chatToDelete = null;
    let selectedFiles = [];
    let isSending = false;
    let abortController = null;
    let isChatLoading = false;

    // =========================================================================
    // DOM ELEMENTS
    // =========================================================================
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const fileInput = document.getElementById('file-upload');
    const sendBtn = document.getElementById('send-btn');
    const sendIcon = document.getElementById('send-icon');
    const micBtn = document.getElementById('mic-btn');

    // =========================================================================
    // WARDEN SCRIPT V2: SAFETY & PERFORMANCE MONITORING
    // =========================================================================
    if (messageList) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.classList.contains('message-bubble-container')) {
                            // Enforce width constraints on new nodes
                            const contentBox = node.querySelector('.chat-content-box');
                            if (contentBox) {
                                contentBox.style.minWidth = '0';
                                contentBox.style.maxWidth = '100%';
                                contentBox.style.overflow = 'hidden';
                            }
                            const mdBody = node.querySelector('.markdown-body');
                            if (mdBody) {
                                mdBody.style.width = '100%';
                                mdBody.style.maxWidth = '100%';
                                mdBody.style.minWidth = '0';
                                mdBody.style.overflowX = 'hidden';
                            }
                        }
                    });
                }
            });
        });
        observer.observe(messageList, { childList: true });
    }

    // =========================================================================
    // UI HELPER FUNCTIONS (SIDEBAR, MODALS, PREVIEW)
    // =========================================================================

    window.toggleMenu = function(event, menuId) {
        if (event) event.stopPropagation();
        document.querySelectorAll('[id^="menu-"]').forEach(el => {
            if (el.id !== menuId) el.classList.add('hidden');
        });
        const menu = document.getElementById(menuId);
        if (menu) menu.classList.toggle('hidden');
    };

    window.toggleSidebar = function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        const isMobile = window.innerWidth < 1024;
        
        if (!sidebar) return;

        if (isMobile) {
            if (sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.remove('-translate-x-full');
                if (overlay) overlay.classList.remove('hidden');
            } else {
                sidebar.classList.add('-translate-x-full');
                if (overlay) overlay.classList.add('hidden');
            }
        } else {
            document.body.classList.toggle('sidebar-closed');
            localStorage.setItem('dardcor_sidebar_state', document.body.classList.contains('sidebar-closed') ? 'closed' : 'open');
        }
    };

    window.closeSidebarIfMobile = function() {
        if (window.innerWidth < 1024) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('mobile-overlay');
            if (sidebar) sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
    };

    window.closePreview = function() {
        const overlay = document.getElementById('diagram-overlay');
        const frame = document.getElementById('diagram-frame');
        if (overlay) overlay.classList.add('hidden');
        setTimeout(() => { 
            if (frame) frame.src = 'about:blank'; 
        }, 300);
    };

    // =========================================================================
    // MODAL MANAGEMENT (RENAME, DELETE)
    // =========================================================================

    window.openRenameModal = function(id) {
        chatToEdit = id;
        const currentTitleEl = document.getElementById(`raw-title-${id}`);
        const currentTitle = currentTitleEl ? currentTitleEl.value : '';
        const input = document.getElementById('rename-input');
        const modal = document.getElementById('rename-modal');
        
        if (input) input.value = currentTitle;
        if (modal) modal.classList.add('active');
        document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden'));
    };

    window.openDeleteModal = function(id) {
        chatToDelete = id;
        const modal = document.getElementById('delete-modal');
        if (modal) modal.classList.add('active');
        document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden'));
    };

    window.closeModal = function(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    };

    window.closeModals = function() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    };

    window.submitRename = async function() {
        const input = document.getElementById('rename-input');
        const newTitle = input ? input.value : '';
        if (!newTitle || !chatToEdit) return;
        try {
            const res = await fetch('/dardcorchat/ai/rename-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: chatToEdit, newTitle })
            });
            if (res.ok) {
                const titleEl = document.getElementById(`title-${chatToEdit}`);
                const rawInput = document.getElementById(`raw-title-${chatToEdit}`);
                if (titleEl) titleEl.innerText = newTitle.length > 25 ? newTitle.substring(0, 25) + '...' : newTitle;
                if (rawInput) rawInput.value = newTitle;
                window.showNavbarAlert('Nama percakapan diperbarui', 'success');
                closeModal('rename-modal');
            } else {
                window.showNavbarAlert('Gagal mengubah nama', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Terjadi kesalahan sistem', 'error');
        }
    };

    window.submitDelete = async function() {
        if (!chatToDelete) return;
        try {
            const res = await fetch('/dardcorchat/ai/delete-chat-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: chatToDelete })
            });
            if (res.ok) {
                if (serverData.currentConversationId === chatToDelete) {
                    window.location.href = '/dardcorchat/dardcor-ai';
                } else {
                    const item = document.getElementById(`chat-item-${chatToDelete}`);
                    if (item) item.remove();
                    window.showNavbarAlert('Percakapan dihapus', 'success');
                    closeModal('delete-modal');
                }
            } else {
                window.showNavbarAlert('Gagal menghapus percakapan', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Terjadi kesalahan sistem', 'error');
        }
    };

    // =========================================================================
    // CHAT NAVIGATION & LOADING
    // =========================================================================

    window.updateActiveChatUI = function(id) {
        const historyItems = document.querySelectorAll('[id^="chat-item-"], #new-chat-highlight-target');
        historyItems.forEach(el => {
            el.classList.remove('bg-[#202336]', 'text-white', 'border-purple-500', 'border-l-2');
            el.classList.add('text-gray-400', 'border-l-2', 'border-transparent', 'hover:bg-white/5');
            const btn = el.querySelector('.options-btn');
            if (btn) {
                btn.classList.remove('opacity-100');
                btn.classList.add('opacity-0', 'group-hover:opacity-100');
            }
        });

        let activeEl = document.getElementById(`chat-item-${id}`);
        if (!activeEl) activeEl = document.getElementById('new-chat-highlight-target');

        if (activeEl) {
            activeEl.classList.remove('text-gray-400', 'border-transparent', 'hover:bg-white/5');
            activeEl.classList.add('bg-[#202336]', 'text-white', 'border-purple-500');
            const btn = activeEl.querySelector('.options-btn');
            if (btn) {
                btn.classList.remove('opacity-0', 'group-hover:opacity-100');
                btn.classList.add('opacity-100');
            }
        }
        document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden'));
    };

    window.createNewChat = async function() {
        try {
            const res = await fetch('/dardcorchat/ai/new-chat', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const newId = data.redirectUrl.split('/').pop();
                loadChat(newId);
                serverData.currentConversationId = newId;
                window.showNavbarAlert('Percakapan baru dibuat', 'success');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Gagal membuat chat baru', 'error');
        }
    };

    window.loadChat = async function(id) {
        if (isChatLoading) return;
        isChatLoading = true;
        window.closeSidebarIfMobile();
        window.updateActiveChatUI(id);

        try {
            const res = await fetch(`/api/chat/${id}`);
            const data = await res.json();
            if (data.success && messageList) {
                serverData.currentConversationId = id;
                messageList.innerHTML = '';
                
                if (!data.history || data.history.length === 0) {
                    renderEmptyState();
                } else {
                    messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 mt-auto pb-4 justify-start";
                    
                    data.history.forEach(msg => appendMessage(msg.role, msg.message, msg.file_metadata));
                    setTimeout(() => {
                        initHighlight();
                        scrollToBottom(true);
                    }, 100);
                }
                window.history.pushState({ id: id }, '', `/dardcorchat/dardcor-ai/${id}`);
            } else {
                window.showNavbarAlert('Gagal memuat riwayat chat', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Koneksi terputus', 'error');
            if (messageList && messageList.children.length === 0) renderEmptyState();
        } finally {
            isChatLoading = false;
        }
    };

    // =========================================================================
    // INTERACTION: COPY & SPEECH
    // =========================================================================

    window.copyMessageBubble = function(btn) {
        const bubbleContainer = btn.closest('.message-bubble-container');
        if (!bubbleContainer) return;
        const contentBox = bubbleContainer.querySelector('.chat-content-box');
        let textToCopy = '';
        const rawTextarea = contentBox.querySelector('.raw-message-content');
        if (rawTextarea) textToCopy = rawTextarea.value;
        else textToCopy = contentBox.innerText;
        
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                const span = btn.querySelector('span');
                const icon = btn.querySelector('i');
                const originalText = span ? span.innerText : '';
                const originalIconClass = icon ? icon.className : '';
                if (span) span.innerText = "Disalin";
                if (icon) icon.className = 'fas fa-check text-green-400 text-xs';
                setTimeout(() => {
                    if (span) span.innerText = originalText;
                    if (icon) icon.className = originalIconClass;
                }, 2000);
            });
        }
    };

    function loadVoices() {
        return new Promise((resolve) => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) resolve(voices);
            else window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
        });
    }

    window.speakMessage = async function(btn) {
        const bubbleContainer = btn.closest('.message-bubble-container');
        if (!bubbleContainer) return;
        const contentBox = bubbleContainer.querySelector('.chat-content-box');
        const textToRead = contentBox.innerText;

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (currentUtterance === textToRead) {
                currentUtterance = null;
                const icon = btn.querySelector('i');
                const span = btn.querySelector('span');
                if (icon) icon.className = 'fas fa-volume-up text-xs';
                if (span) span.innerText = 'Dengar';
                return;
            }
        }
        
        const voices = await loadVoices();
        const utterance = new SpeechSynthesisUtterance(textToRead);
        const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID'));
        if (idVoice) utterance.voice = idVoice;
        utterance.lang = 'id-ID';
        utterance.rate = 1;
        currentUtterance = textToRead;
        
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        const originalIconClass = 'fas fa-volume-up text-xs';
        
        if (icon) icon.className = 'fas fa-stop text-red-400 text-xs';
        if (span) span.innerText = 'Stop';
        
        utterance.onend = () => {
            if (icon) icon.className = originalIconClass;
            if (span) span.innerText = 'Dengar';
            currentUtterance = null;
        };
        window.speechSynthesis.speak(utterance);
    };

    // =========================================================================
    // TOOLS: PERSONAS, VAULT, MEMORY
    // =========================================================================

    window.openPersonaModal = function() {
        window.closeModals();
        const modal = document.getElementById('persona-modal');
        if (modal) {
            modal.classList.add('active');
            fetchPersonas();
        }
    };

    async function fetchPersonas() {
        try {
            const res = await fetch('/api/personas');
            const data = await res.json();
            const list = document.getElementById('persona-list');
            if (list) {
                list.innerHTML = '';
                if (data.success && data.data) {
                    data.data.forEach(p => {
                        const isActive = selectedPersonaId === p.id;
                        const div = document.createElement('div');
                        div.className = `flex justify-between items-center p-2 rounded bg-[#151520] border ${isActive ? 'border-purple-500 ring-1 ring-purple-500' : 'border-white/10'} hover:border-purple-500/50 transition`;
                        div.innerHTML = `
                            <div class="cursor-pointer flex-1" onclick="selectPersona('${p.id}', '${p.name}', this)">
                                <div class="font-bold text-xs text-white flex items-center gap-2">
                                    ${p.name}
                                    ${isActive ? '<i class="fas fa-check-circle text-purple-500"></i>' : ''}
                                </div>
                                <div class="text-[10px] text-gray-400 truncate w-48">${p.instruction}</div>
                            </div>
                            <button onclick="deletePersona('${p.id}')" class="text-red-400 hover:text-red-300 ml-2 p-1"><i class="fas fa-trash"></i></button>
                        `;
                        list.appendChild(div);
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.addPersona = async function() {
        const nameInput = document.getElementById('new-persona-name');
        const instInput = document.getElementById('new-persona-inst');
        if (!nameInput || !instInput) return;
        
        const name = nameInput.value;
        const instruction = instInput.value;
        if (!name || !instruction) return;
        
        try {
            const res = await fetch('/api/personas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, instruction })
            });
            const result = await res.json();
            if (result.success && result.data) {
                selectPersona(result.data.id, result.data.name);
                window.showNavbarAlert('Persona berhasil dibuat', 'success');
            }
            nameInput.value = '';
            instInput.value = '';
            fetchPersonas();
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Gagal membuat persona', 'error');
        }
    };

    window.deletePersona = async function(id) {
        if (!confirm('Hapus persona ini?')) return;
        try {
            await fetch(`/api/personas/${id}`, { method: 'DELETE' });
            if (selectedPersonaId === id) deselectPersona();
            window.showNavbarAlert('Persona dihapus', 'success');
            fetchPersonas();
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Gagal menghapus persona', 'error');
        }
    };

    window.selectPersona = function(id, name, el) {
        selectedPersonaId = id;
        selectedPersonaName = name;
        localStorage.setItem('activePersonaId', id);
        localStorage.setItem('activePersonaName', name);
        updatePersonaUI();
        window.showNavbarAlert(`Persona diaktifkan: ${name}`, 'info');
        const modal = document.getElementById('persona-modal');
        if (modal && modal.classList.contains('active')) fetchPersonas();
    };

    window.deselectPersona = function() {
        selectedPersonaId = null;
        selectedPersonaName = null;
        localStorage.removeItem('activePersonaId');
        localStorage.removeItem('activePersonaName');
        updatePersonaUI();
        window.showNavbarAlert('Persona dinonaktifkan', 'info');
        const modal = document.getElementById('persona-modal');
        if (modal && modal.classList.contains('active')) fetchPersonas();
    };

    function updatePersonaUI() {
        const indicator = document.getElementById('active-persona-container');
        const label = document.getElementById('active-persona-label');
        if (selectedPersonaId && selectedPersonaName) {
            if (indicator) { indicator.classList.remove('hidden'); indicator.classList.add('flex'); }
            if (label) label.innerText = selectedPersonaName;
        } else {
            if (indicator) { indicator.classList.add('hidden'); indicator.classList.remove('flex'); }
        }
    }

    window.openVaultModal = function() {
        window.closeModals();
        const modal = document.getElementById('vault-modal');
        if (modal) {
            modal.classList.add('active');
            fetchVault();
        }
    };

    async function fetchVault() {
        try {
            const res = await fetch('/api/vault');
            const data = await res.json();
            const list = document.getElementById('vault-list');
            if (list) {
                list.innerHTML = '';
                if (data.success && data.data) {
                    data.data.forEach(v => {
                        list.innerHTML += `<div class="flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 mb-1"><div class="text-xs text-white font-bold truncate w-64">${v.title}</div><button onclick="deleteVault('${v.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></div>`;
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.addVault = async function() {
        const titleInput = document.getElementById('new-vault-title');
        const contentInput = document.getElementById('new-vault-content');
        if (!titleInput || !contentInput) return;

        const title = titleInput.value;
        const content = contentInput.value;
        if (!title || !content) return;

        try {
            await fetch('/api/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            titleInput.value = '';
            contentInput.value = '';
            window.showNavbarAlert('Dokumen disimpan ke Vault', 'success');
            fetchVault();
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Gagal menyimpan dokumen', 'error');
        }
    };

    window.deleteVault = async function(id) {
        if (!confirm('Hapus dokumen ini?')) return;
        try { 
            await fetch(`/api/vault/${id}`, { method: 'DELETE' }); 
            window.showNavbarAlert('Dokumen dihapus', 'success');
            fetchVault(); 
        } catch (e) { 
            console.error(e); 
            window.showNavbarAlert('Gagal menghapus dokumen', 'error');
        }
    };

    window.openMemoryModal = function() {
        window.closeModals();
        const modal = document.getElementById('memory-modal');
        if (modal) {
            modal.classList.add('active');
            fetchMemories();
        }
    };

    async function fetchMemories() {
        try {
            const res = await fetch('/api/memories');
            const data = await res.json();
            const list = document.getElementById('memory-list');
            if (list) {
                list.innerHTML = '';
                if (data.success && data.data) {
                    data.data.forEach(m => {
                        list.innerHTML += `<div class="flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 mb-1"><div class="text-xs text-white truncate w-64">${m.fact}</div><button onclick="deleteMemory('${m.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></div>`;
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.addMemory = async function() {
        const input = document.getElementById('new-memory');
        if (!input) return;
        const fact = input.value;
        if (!fact) return;
        try {
            await fetch('/api/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fact })
            });
            input.value = '';
            window.showNavbarAlert('Memori baru ditambahkan', 'success');
            fetchMemories();
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Gagal menambah memori', 'error');
        }
    };

    window.deleteMemory = async function(id) {
        if (!confirm('Hapus memori ini?')) return;
        try { 
            await fetch(`/api/memories/${id}`, { method: 'DELETE' }); 
            window.showNavbarAlert('Memori dihapus', 'success');
            fetchMemories(); 
        } catch (e) { 
            console.error(e); 
            window.showNavbarAlert('Gagal menghapus memori', 'error');
        }
    };

    // =========================================================================
    // CODE & TERMINAL PREVIEW HANDLING
    // =========================================================================

    window.previewCode = async function(btn) {
        const container = btn.closest('.terminal-container');
        if (!container) return;
        const rawCodeEl = container.querySelector('.raw-code');
        if (!rawCodeEl) return;

        const rawCode = rawCodeEl.value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
        try {
            const res = await fetch('/dardcorchat/ai/store-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: rawCode })
            });
            const data = await res.json();
            if (data.success) {
                const overlay = document.getElementById('diagram-overlay');
                const frame = document.getElementById('diagram-frame');
                if (frame) frame.src = `/dardcorchat/dardcor-ai/preview/${data.previewId}`;
                if (overlay) overlay.classList.remove('hidden');
            } else {
                window.showNavbarAlert('Gagal memuat preview', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Error sistem preview', 'error');
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    };

    window.previewDiagram = async function(btn) {
        const container = btn.closest('.terminal-container');
        if (!container) return;
        const rawCodeEl = container.querySelector('.raw-code');
        if (!rawCodeEl) return;

        let rawCode = rawCodeEl.value.replace(/```mermaid/g, '').replace(/```/g, '').trim().replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
        try {
            const res = await fetch('/dardcorchat/ai/store-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: rawCode, type: 'diagram' })
            });
            const data = await res.json();
            if (data.success) {
                const overlay = document.getElementById('diagram-overlay');
                const frame = document.getElementById('diagram-frame');
                if (frame) frame.src = `/dardcorchat/dardcor-ai/diagram/${data.previewId}`;
                if (overlay) overlay.classList.remove('hidden');
            } else {
                window.showNavbarAlert('Gagal memuat diagram', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Error sistem diagram', 'error');
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    };

    window.copyCode = function(btn) {
        const container = btn.closest('.terminal-container');
        if (!container) return;
        const rawCodeEl = container.querySelector('.raw-code');
        if (!rawCodeEl) return;

        const code = rawCodeEl.value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        navigator.clipboard.writeText(code).then(() => {
            const origin = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = origin, 2000);
            window.showNavbarAlert('Kode disalin', 'success');
        });
    };

    // =========================================================================
    // MODEL SELECTION & MARKDOWN RENDERING
    // =========================================================================

    window.setModel = function(type) {
        currentToolType = type;
        const label = document.getElementById('tool-label');
        if (label) label.innerText = type === 'dark' ? 'Dark Model' : (type === 'pro' ? 'Pro Model' : 'Basic Model');
        const menu = document.getElementById('tools-menu');
        if (menu) menu.classList.add('hidden');
        const chevron = document.getElementById('tools-chevron');
        if (chevron) chevron.classList.remove('rotate-180');
        const input = document.getElementById('message-input');
        if (input) input.placeholder = type === 'pro' ? "Ask Dardcor Pro..." : "Ask To Dardcor...";
        
        window.showNavbarAlert(`Model diubah ke ${type === 'dark' ? 'Dark' : (type === 'pro' ? 'Pro' : 'Basic')}`, 'info');
    };

    function escapeHtml(u) {
        return u.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    try {
        if (typeof marked !== 'undefined') {
            const markedRenderer = new marked.Renderer();

            const renderTerminal = (codeContent, languageName, rawValue) => {
                let btnHtml = '';
                if (languageName === 'mermaid') {
                    btnHtml = `<button onclick="previewDiagram(this)" class="cmd-btn btn-diagram"><i class="fas fa-project-diagram"></i>Preview</button>`;
                } else if (['html', 'xml', 'ejs', 'php', 'svg'].includes(languageName)) {
                    btnHtml = `<button onclick="previewCode(this)" class="cmd-btn btn-preview"><i class="fas fa-play"></i>Preview</button>`;
                }
                
                return `<div class="terminal-container"><div class="terminal-head"><div class="text-xs font-bold text-gray-400 uppercase flex items-center"><i class="fas fa-code mr-2"></i> ${languageName || 'CODE'}</div><div class="terminal-actions flex gap-2">${btnHtml}<button onclick="copyCode(this)" class="cmd-btn btn-copy" title="Salin Kode"><i class="fas fa-copy"></i></button></div></div><div class="terminal-code"><pre><code class="hljs ${languageName}">${codeContent}</code></pre><textarea class="hidden raw-code">${rawValue}</textarea></div></div>`;
            };

            markedRenderer.code = function(code, language) {
                let validCode = (typeof code === 'string' ? code : code.text);
                let lang = (language || '').toLowerCase().trim().split(/\s+/)[0];
                const trimmedCode = validCode.trim();

                if (!lang || ['text', 'txt', 'code', 'plaintext'].includes(lang)) {
                    if (trimmedCode.match(/^<!DOCTYPE html/i) || trimmedCode.match(/^<html/i)) lang = 'html';
                    else if (trimmedCode.match(/^<\?php/i)) lang = 'php';
                    else if (trimmedCode.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|mindmap|timeline)/)) lang = 'mermaid';
                    else if (trimmedCode.match(/^<svg/i)) lang = 'svg';
                }
                if (lang === 'mermaid' || trimmedCode.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|mindmap|timeline)/)) lang = 'mermaid';

                let highlighted = '';
                let escapedCode = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

                if (lang && lang !== 'mermaid' && typeof hljs !== 'undefined') {
                    try {
                        if (hljs.getLanguage(lang)) {
                            highlighted = hljs.highlight(validCode, { language: lang }).value;
                        } else {
                            highlighted = escapedCode;
                        }
                    } catch (e) {
                        highlighted = escapedCode;
                    }
                } else if (lang === 'mermaid') {
                    highlighted = escapedCode;
                } else {
                    try {
                        if (typeof hljs !== 'undefined') {
                            highlighted = hljs.highlightAuto(validCode).value;
                        } else {
                            highlighted = escapedCode;
                        }
                    } catch (e) {
                        highlighted = escapedCode;
                    }
                }
                return renderTerminal(highlighted, lang, escapedCode);
            };

            markedRenderer.html = function(html) {
                const aggressiveHtmlCheck = /<\/?(doctype|html|head|body|div|section|article|nav|aside|header|footer|main|script|style|svg|table|thead|tbody|tr|td|th|ul|ol|li|form|label|input|button|textarea|select|option|iframe|embed|object|picture|source|video|audio|progress|meter|details|summary|dialog)[^>]*>/i;
                
                if (aggressiveHtmlCheck.test(html)) {
                    const escapedHtml = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    let highlighted = escapedHtml;
                    
                    if (typeof hljs !== 'undefined') {
                        try {
                            highlighted = hljs.highlight(html, { language: 'xml' }).value;
                        } catch(e) {}
                    }
                    
                    return renderTerminal(highlighted, 'html', escapedHtml);
                }
                
                return html; 
            };

            marked.setOptions({
                renderer: markedRenderer,
                gfm: true,
                breaks: true,
                sanitize: false 
            });
        }
    } catch (e) {
        console.error(e);
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    document.addEventListener('click', function(event) {
        if (!event.target.closest('.options-btn')) {
            document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden'));
        }
    });

    updatePersonaUI();

    if (serverData.currentConversationId) {
        updateActiveChatUI(serverData.currentConversationId);
    }

    const modelBtn = document.getElementById('model-dropdown-btn');
    if (modelBtn) {
        modelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('tools-menu');
            const chevron = document.getElementById('tools-chevron');
            if (menu) menu.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
    }

    document.querySelectorAll('.model-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setModel(btn.dataset.model);
        });
    });

    const refreshBtn = document.getElementById('refresh-chat-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => window.location.reload());

    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (fileInput) {
        fileInput.addEventListener('change', function() {
        });
    }

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            micBtn.classList.toggle('text-purple-500');
            micBtn.classList.toggle('bg-white/10');
            if (messageInput) messageInput.placeholder = micBtn.classList.contains('text-purple-500') ? "Mendengarkan..." : "Ask To Dardcor...";
        });
    }

    // =========================================================================
    // CORE CHAT FUNCTIONS: RENDER & SEND
    // =========================================================================

    function renderEmptyState() {
        if (!messageList) return;
        messageList.innerHTML = ` <div id="empty-state" class="flex flex-col items-center justify-center text-gray-500 opacity-50 select-none"> <div class="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 overflow-hidden border border-gray-700 shadow-2xl bg-black"> <img src="/logo.png" class="w-full h-full object-cover"> </div> <p class="text-lg font-medium text-gray-400 text-center">Apa yang bisa saya bantu?</p> </div>`;
        
        // === STATE KOSONG: PAKSA LAYOUT TENGAH (FIXED) ===
        // Reset classes completely to ensure centering
        messageList.className = "";
        messageList.classList.add("w-full", "max-w-3xl", "mx-auto", "flex", "flex-col", "h-full", "items-center", "justify-center", "pb-4");
    }

    function appendMessage(role, text, files = []) {
        if (!messageList) return null;
        
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.remove();

        // === STATE CHAT: PAKSA LAYOUT LIST (FIXED) ===
        // Ensure we are in list mode, not centered mode
        if (messageList.classList.contains('items-center') || messageList.classList.contains('justify-center')) {
             messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 mt-auto pb-4 justify-start";
        }

        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} message-bubble-container group min-w-0`;

        let fileHtml = '';
        if (files && files.length > 0) {
            const justify = role === 'user' ? 'justify-end' : 'justify-start';
            fileHtml = `<div class="flex flex-wrap gap-2 mb-2 ${justify} w-full">`;
            files.forEach(f => {
                fileHtml += `<div class="text-[10px] flex items-center gap-2 bg-transparent px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 max-w-full shadow-sm"><i class="fas fa-file text-purple-400"></i> <span class="truncate">${f.filename}</span></div>`;
            });
            fileHtml += `</div>`;
        }

        // TRANSPARENT BUBBLE STYLES (GLASS EFFECT)
        const bubbleClass = role === 'user' 
            ? 'bg-transparent border border-purple-500/50 text-white shadow-[0_0_15px_rgba(147,51,234,0.15)] rounded-br-sm' 
            : 'bg-transparent border border-white/10 text-gray-200 rounded-bl-sm';
        
        let contentHtml = '';
        if (role === 'user') {
            contentHtml = `<div class="whitespace-pre-wrap break-words user-text">${escapeHtml(text)}</div>`;
        } else {
            if (text !== '...loading_placeholder...' && typeof marked !== 'undefined') {
                contentHtml = `<textarea class="hidden raw-message-content">${text}</textarea><div class="overflow-guard w-full min-w-0 max-w-full"><div class="markdown-body w-full max-w-full overflow-hidden break-words">${marked.parse(text)}</div></div>`;
            } else {
                contentHtml = `<textarea class="hidden raw-message-content">${text}</textarea><div class="overflow-guard w-full min-w-0 max-w-full"><div class="markdown-body w-full max-w-full overflow-hidden break-words"></div></div>`;
            }
        }

        let contentLoading = `
            <div class="flex items-center gap-3 bg-transparent border border-white/10 px-4 py-3.5 rounded-2xl rounded-bl-sm shadow-md">
                <div class="loader"></div>
                <span class="text-xs text-purple-400 font-medium animate-pulse">Sedang berpikir...</span>
            </div>`;

        let actionButtons = `
            <div class="flex items-center gap-2 mt-2 px-1 select-none">
                <button onclick="copyMessageBubble(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-transparent border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm active:scale-95" title="Salin"><i class="fas fa-copy text-xs"></i> <span class="text-[10px] font-medium">Salin</span></button>
                ${role !== 'user' ? `<button onclick="speakMessage(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-transparent border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm active:scale-95" title="Dengarkan"><i class="fas fa-volume-up text-xs"></i> <span class="text-[10px] font-medium">Dengar</span></button>` : ''}
            </div>
        `;

        if (text === '...loading_placeholder...') {
            div.innerHTML = `
            <div class="flex flex-col items-start max-w-[85%] min-w-0">
                ${contentLoading}
            </div>`;
        } else {
            div.innerHTML = `
            <div class="flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] min-w-0">
                ${fileHtml}
                <div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm ${bubbleClass} w-fit min-w-0 max-w-full overflow-hidden leading-7">
                    ${contentHtml}
                </div>
                ${actionButtons}
            </div>`;
        }

        messageList.appendChild(div);
        
        if (role === 'bot' && text !== '...loading_placeholder...') {
            const body = div.querySelector('.markdown-body');
            if (body && window.renderMathInElement) {
                renderMathInElement(body, {
                    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
                    throwOnError: false
                });
            }
            if (body && typeof hljs !== 'undefined') {
                body.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            }
        }

        return div;
    }

    async function sendMessage() {
        if (isSending) {
            if (abortController) {
                abortController.abort();
                abortController = null;
                isSending = false;
                if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
                const indicator = document.getElementById('loading-indicator');
                if (indicator) indicator.remove();
            }
            return;
        }

        const msg = messageInput ? messageInput.value.trim() : '';
        if (!msg && selectedFiles.length === 0) return;
        
        isSending = true;
        abortController = new AbortController();
        if (sendIcon) sendIcon.classList.replace('fa-paper-plane', 'fa-stop');
        
        if (messageInput) {
            messageInput.blur();
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        appendMessage('user', msg, selectedFiles);

        const loaderDiv = appendMessage('bot', '...loading_placeholder...', []);
        if (loaderDiv) loaderDiv.id = 'loading-indicator';
        scrollToBottom(true);

        const fd = new FormData();
        fd.append('message', msg);
        fd.append('conversationId', serverData.currentConversationId || '');
        fd.append('toolType', currentToolType);
        
        const activeId = selectedPersonaId || localStorage.getItem('activePersonaId');
        if (activeId && activeId !== 'null') {
            fd.append('personaId', activeId);
        }
        
        selectedFiles.forEach(f => fd.append('file_attachment', f));
        selectedFiles = [];
        
        if (fileInput) fileInput.value = '';
        
        try {
            const response = await fetch('/dardcorchat/ai/chat-stream', {
                method: 'POST',
                body: fd,
                signal: abortController.signal
            });
            
            if (!response.ok) throw new Error("Server Error");

            if (loaderDiv) loaderDiv.remove();
            
            const botDiv = document.createElement('div');
            botDiv.className = "flex w-full justify-start message-bubble-container group min-w-0";
            botDiv.innerHTML = `
            <div class="flex flex-col items-start max-w-[85%] min-w-0">
                <div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm bg-transparent border border-white/10 text-gray-200 rounded-bl-sm w-fit min-w-0 max-w-full overflow-hidden leading-7">
                    <div class="overflow-guard w-full min-w-0 max-w-full">
                        <div class="markdown-body w-full max-w-full overflow-hidden break-words"></div>
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-2 px-1 select-none">
                    <button onclick="copyMessageBubble(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-transparent border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm group active:scale-95" title="Salin"><i class="fas fa-copy text-xs"></i> <span class="text-[10px] font-medium">Salin</span></button>
                    <button onclick="speakMessage(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-transparent border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm group active:scale-95" title="Dengarkan"><i class="fas fa-volume-up text-xs"></i> <span class="text-[10px] font-medium">Dengar</span></button>
                </div>
            </div>`;
            
            if (messageList) messageList.appendChild(botDiv);
            
            const botContent = botDiv.querySelector('.markdown-body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = "";
            let isStreaming = true;
            let lastUpdate = 0;
            
            const render = (timestamp) => {
                if (!isStreaming) return;
                
                if (timestamp - lastUpdate < 16) {
                    requestAnimationFrame(render);
                    return;
                }
                lastUpdate = timestamp;

                let formatted = fullText;
                const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/);
                if (thinkMatch) {
                    const clean = thinkMatch[1].trim().replace(/\n/g, '<br>');
                    formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-transparent border border-white/10 rounded-lg overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-white/10 bg-black/20 leading-relaxed italic">${clean}</div></details>`);
                }
                
                if (botContent) {
                    if (typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted);
                    else botContent.innerText = formatted;
                    
                    if (window.renderMathInElement) renderMathInElement(botContent, {
                        delimiters: [{
                            left: '$$',
                            right: '$$',
                            display: true
                        }, {
                            left: '$',
                            right: '$',
                            display: false
                        }],
                        throwOnError: false
                    });
                    
                    if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
                }
                scrollToBottom();
                requestAnimationFrame(render);
            };
            
            requestAnimationFrame(render);
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); 
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.replace('data: ', ''));
                            if (json.chunk) fullText += json.chunk;
                        } catch (e) {}
                    }
                }
            }
            
            isStreaming = false;
            let formatted = fullText;
            const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-transparent border border-white/10 rounded-lg overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-white/10 bg-black/20 leading-relaxed italic">${thinkMatch[1].trim().replace(/\n/g, '<br>')}</div></details>`);
            
            if (botContent) {
                if (typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted);
                else botContent.innerText = formatted;
                
                if (window.renderMathInElement) renderMathInElement(botContent, {
                    delimiters: [{
                        left: '$$',
                        right: '$$',
                        display: true
                    }, {
                        left: '$',
                        right: '$',
                        display: false
                    }],
                    throwOnError: false
                });
                
                if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            }
            scrollToBottom(true);
            
        } catch (e) {
            const indicator = document.getElementById('loading-indicator');
            if (indicator) indicator.remove();
            
            window.showNavbarAlert('Gagal mengirim pesan', 'error');
            const errorDiv = document.createElement('div');
            errorDiv.className = "flex w-full justify-center message-bubble-container my-4";
            errorDiv.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-xs flex items-center gap-2"><i class="fas fa-exclamation-triangle"></i> Gagal terhubung ke server. Cek koneksi Anda.</div>`;
            if (messageList) messageList.appendChild(errorDiv);
            scrollToBottom(true);
            
        } finally {
            isSending = false;
            abortController = null;
            if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
        }
    }

    function scrollToBottom(force = false) {
        if (!chatContainer) return;
        const threshold = 150;
        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold;
        if (force || isNearBottom) {
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'auto' });
        }
    }

    function initHighlight() {
        document.querySelectorAll('.message-bubble-container pre code').forEach(el => {
            if (typeof hljs !== 'undefined') hljs.highlightElement(el);
        });
        document.querySelectorAll('.message-bubble-container .raw-message-content').forEach(raw => {
            const target = raw.nextElementSibling;
            if (target && target.classList.contains('markdown-body')) {
                if (typeof marked !== 'undefined') target.innerHTML = marked.parse(raw.value);
                if (window.renderMathInElement) renderMathInElement(target, {
                    delimiters: [{
                        left: '$$',
                        right: '$$',
                        display: true
                    }, {
                        left: '$',
                        right: '$',
                        display: false
                    }],
                    throwOnError: false
                });
            }
        });
    }

    // =========================================================================
    // INITIALIZATION LOGIC (CRAZY ROBUST FIX FOR EMPTY STATE)
    // =========================================================================
    if (messageList) {
        // PERBAIKAN LOGIKA GILA:
        // Cek secara strict apakah ada element "bubble chat" yang valid.
        // Jangan hanya cek children.length karena kadang ada whitespace/text node bandel.
        const hasMessages = messageList.querySelectorAll('.message-bubble-container').length > 0;
        
        // Jika tidak ada pesan SAMA SEKALI, atau ID percakapan tidak ada/kosong
        const isActuallyEmpty = !hasMessages || !serverData.currentConversationId;

        if (isActuallyEmpty) {
            console.log("DardcorAI: Empty State Detected on Init - Rendering...");
            messageList.innerHTML = ''; // Bersihkan sisa-sisa kotoran DOM
            renderEmptyState();
        } else {
            console.log("DardcorAI: History Detected - Initializing Highlight...");
            initHighlight();
            scrollToBottom(true);
        }
    }
});