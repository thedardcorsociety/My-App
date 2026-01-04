document.addEventListener('DOMContentLoaded', () => {
    const serverData = window.SERVER_DATA || {};
    let storedModel = localStorage.getItem('dardcor_selected_model');
    let currentToolType = storedModel || serverData.toolType || 'basic';
    let selectedPersonaId = localStorage.getItem('activePersonaId') || null;
    let selectedPersonaName = localStorage.getItem('activePersonaName') || null;
    let currentUtterance = null;
    let chatToEdit = null;
    let chatToDelete = null;
    let selectedFiles = [];
    let isSending = false;
    let abortController = null;
    let isChatLoading = false;
    let userIsScrolling = false;
    let pendingToolDelete = null;

    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const fileInput = document.getElementById('file-upload');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const dropZone = document.getElementById('drop-zone');
    const sendBtn = document.getElementById('send-btn');
    const sendIcon = document.getElementById('send-icon');
    const micBtn = document.getElementById('mic-btn');
    const modelBtn = document.getElementById('model-dropdown-btn');
    const toolsMenu = document.getElementById('tools-menu');
    const toolsChevron = document.getElementById('tools-chevron');
    const toolLabel = document.getElementById('tool-label');

    // --- KONFIGURASI MARKED (BAGIAN KRUSIAL) ---
    if (typeof marked !== 'undefined') {
        const renderer = new marked.Renderer();
        
        // 1. Code Block Renderer
        renderer.code = function(code, language) {
            let validCode = (typeof code === 'string' ? code : code.text);
            let lang = (language || '').toLowerCase().trim().split(/\s+/)[0] || 'text';
            const trimmedCode = validCode.trim();

            if (['text', 'txt', 'code'].includes(lang)) {
                if (trimmedCode.match(/^<!DOCTYPE html/i)) lang = 'html';
                else if (trimmedCode.match(/^<\?php/i)) lang = 'php';
                else if (trimmedCode.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i)) lang = 'mermaid';
            }

            let btnHtml = '';
            if (['html', 'xml', 'ejs', 'php', 'svg'].includes(lang)) {
                btnHtml = `<button onclick="previewCode(this)" class="cmd-btn btn-preview"><i class="fas fa-play"></i> Preview</button>`;
            } else if (lang === 'mermaid') {
                btnHtml = `<button onclick="previewDiagram(this)" class="cmd-btn btn-diagram"><i class="fas fa-project-diagram"></i> Preview Diagram</button>`;
            }

            const escapedCode = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            return `<div class="terminal-container">
                        <div class="terminal-head">
                            <div class="text-xs font-bold text-gray-400 uppercase flex items-center"><i class="fas fa-code mr-2"></i> ${lang}</div>
                            <div class="terminal-actions flex gap-2">
                                ${btnHtml}
                                <button onclick="copyCode(this)" class="cmd-btn btn-copy" title="Salin Kode"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>
                        <div class="terminal-code">
                            <pre><code class="hljs ${lang}">${escapedCode}</code></pre>
                            <textarea class="hidden raw-code">${escapedCode}</textarea>
                        </div>
                    </div>`;
        };
        
        // 2. LINK RENDERER (PERBAIKAN UTAMA [object Object] & undefined)
        renderer.link = function(href, title, text) {
            let cleanHref = href;
            let cleanTitle = title;
            let cleanText = text;

            // DETEKSI: Apakah Marked mengirim Object (Token) alih-alih String?
            if (typeof href === 'object' && href !== null) {
                // Bongkar object tersebut
                const token = href;
                cleanHref = token.href || token.original || '';
                cleanTitle = token.title || '';
                cleanText = token.text || token.raw || '';
            }

            // FALLBACK 1: Jika href masih null/undefined
            if (!cleanHref) cleanHref = cleanText;

            // FALLBACK 2: Jika text masih null/undefined/kosong
            if (!cleanText || cleanText === 'undefined' || cleanText.trim() === '') {
                cleanText = cleanHref;
            }

            // Pastikan URL valid string untuk ditampilkan
            if (typeof cleanHref !== 'string') cleanHref = '';
            if (typeof cleanText !== 'string') cleanText = String(cleanHref);

            return `<a href="${cleanHref}" target="_blank" class="text-purple-500 hover:text-purple-300 hover:underline font-bold transition-colors break-all" title="${cleanTitle || ''}">${cleanText}</a>`;
        };

        marked.setOptions({ 
            renderer: renderer, 
            gfm: true, // Github Flavored Markdown (Auto-link URL aktif)
            breaks: true, 
            sanitize: false 
        });
    }
    // --- END KONFIGURASI MARKED ---

    const refreshBtn = document.getElementById('refresh-chat-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const icon = document.getElementById('refresh-icon');
            if (icon) icon.classList.add('fa-spin');
            setTimeout(() => window.location.reload(), 300);
        });
    }

    function updateModelUI(type) {
        const nameMap = { 'basic': 'Basic Model', 'dark': 'Dark Model', 'pro': 'Pro Model' };
        if (toolLabel) toolLabel.innerText = nameMap[type] || 'Basic Model';
        if (messageInput) messageInput.placeholder = `Ask To Dardcor ${type === 'basic' ? '' : (type === 'dark' ? 'Dark' : 'Pro')}...`;
        currentToolType = type;
    }
    updateModelUI(currentToolType);

    function applyMinimalistStyle() {
        if (!messageList) return;
    }
    
    function getFileIconClass(mimetype, filename) {
        if (!mimetype) mimetype = "";
        if (!filename) filename = "";
        mimetype = mimetype.toLowerCase();
        filename = filename.toLowerCase();
        
        if (mimetype.includes('pdf')) return 'fa-file-pdf text-red-400';
        if (mimetype.includes('word') || mimetype.includes('document')) return 'fa-file-word text-blue-400';
        if (mimetype.includes('excel') || mimetype.includes('sheet') || mimetype.includes('csv')) return 'fa-file-excel text-green-400';
        if (mimetype.includes('zip') || mimetype.includes('compressed') || mimetype.includes('tar')) return 'fa-file-archive text-yellow-500';
        if (mimetype.includes('code') || filename.match(/\.(js|html|css|py|php|java|cpp|json|ejs|ts|sql)$/i)) return 'fa-file-code text-purple-400';
        if (mimetype.includes('video')) return 'fa-file-video text-pink-400';
        if (mimetype.includes('audio')) return 'fa-file-audio text-purple-400';
        if (mimetype.includes('text')) return 'fa-file-alt text-gray-300';
        return 'fa-file text-gray-400';
    }

    function updateFilePreviews() {
        if (!filePreviewContainer) return;
        filePreviewContainer.innerHTML = '';
        if (selectedFiles.length === 0) {
            filePreviewContainer.classList.add('hidden');
            return;
        }
        filePreviewContainer.classList.remove('hidden');
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = "relative group w-16 h-16 rounded-lg overflow-hidden border border-white/20 bg-black/50";
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.className = "w-full h-full object-cover";
                div.appendChild(img);
            } else {
                const iconClass = getFileIconClass(file.type, file.name);
                div.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center p-1 text-center"><i class="fas ${iconClass} text-xl mb-1"></i><span class="text-[8px] text-gray-300 truncate w-full">${file.name.slice(-6)}</span></div>`;
            }
            const removeBtn = document.createElement('button');
            removeBtn.className = "absolute top-0 right-0 bg-red-600/90 text-white w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md z-10";
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.onclick = (e) => { e.stopPropagation(); selectedFiles.splice(index, 1); updateFilePreviews(); };
            div.appendChild(removeBtn);
            filePreviewContainer.appendChild(div);
        });
    }

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        const remaining = 10 - selectedFiles.length;
        if (remaining <= 0) { window.showNavbarAlert('Maksimal 10 file', 'error'); return; }
        const toAdd = Array.from(files).slice(0, remaining);
        toAdd.forEach(file => {
            if (file.size > 50 * 1024 * 1024) { window.showNavbarAlert(`File ${file.name} terlalu besar`, 'error'); } 
            else { selectedFiles.push(file); }
        });
        updateFilePreviews();
    }

    if (fileUploadBtn && fileInput) {
        fileUploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); fileInput.value = ''; });
    } else if (fileInput) { 
        fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); fileInput.value = ''; });
        document.addEventListener('click', (e) => {
            if (e.target.closest('button') && e.target.closest('button').querySelector('.fa-paperclip')) {
                fileInput.click();
            }
        });
    }

    if (messageInput) {
        messageInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            const files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') files.push(items[i].getAsFile());
            }
            if (files.length > 0) { e.preventDefault(); handleFiles(files); }
        });
    }

    window.addEventListener('dragover', (e) => { e.preventDefault(); if (dropZone) { dropZone.classList.remove('hidden'); dropZone.classList.add('flex'); } });
    window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null || e.relatedTarget === document.documentElement) { if (dropZone) { dropZone.classList.add('hidden'); dropZone.classList.remove('flex'); } } });
    window.addEventListener('drop', (e) => { e.preventDefault(); if (dropZone) { dropZone.classList.add('hidden'); dropZone.classList.remove('flex'); } handleFiles(e.dataTransfer.files); });

    window.showNavbarAlert = function(message, type = 'info') {
        const alertBox = document.getElementById('navbar-alert');
        const alertText = document.getElementById('navbar-alert-text');
        const alertIcon = document.getElementById('navbar-alert-icon');
        
        if (alertBox && alertText && alertIcon) {
            alertText.innerText = message;
            alertBox.classList.remove('opacity-0', 'pointer-events-none', 'scale-90');
            alertBox.classList.add('opacity-100', 'scale-100');
            
            if (type === 'success') {
                alertBox.className = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-green-900/80 border border-green-500/30 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 opacity-100 transform scale-100 z-[9999]";
                alertIcon.className = "fas fa-check-circle text-green-400 text-xs";
            } else if (type === 'error') {
                alertBox.className = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-red-900/80 border border-red-500/30 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 opacity-100 transform scale-100 z-[9999]";
                alertIcon.className = "fas fa-exclamation-circle text-red-400 text-xs";
            } else {
                alertBox.className = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#1c1c2e] border border-purple-900/30 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 opacity-100 transform scale-100 z-[9999]";
                alertIcon.className = "fas fa-info-circle text-purple-400 text-xs";
            }

            setTimeout(() => {
                alertBox.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
                alertBox.classList.remove('opacity-100', 'scale-100');
            }, 3000);
        }
    };

    window.requestToolDelete = function(msg, action) { 
        const modal = document.getElementById('tool-delete-modal'); 
        const text = document.getElementById('tool-delete-text'); 
        if(modal && text) { 
            text.innerText = msg; 
            pendingToolDelete = action; 
            modal.classList.add('active'); 
        } 
    };

    window.confirmToolDelete = async function() { 
        if(pendingToolDelete) await pendingToolDelete(); 
        const modal = document.getElementById('tool-delete-modal'); 
        if(modal) modal.classList.remove('active'); 
        pendingToolDelete = null; 
    };

    window.askDeletePersona = function(id) {
        window.requestToolDelete('Hapus persona ini?', async () => {
            try {
                const res = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
                if(res.ok) {
                    if (selectedPersonaId === id) deselectPersona();
                    window.showNavbarAlert('Persona dihapus', 'success');
                    fetchPersonas();
                } else {
                    window.showNavbarAlert('Gagal menghapus', 'error');
                }
            } catch(e) {
                window.showNavbarAlert('Error sistem', 'error');
            }
        });
    };

    window.askDeleteVault = function(id) {
        window.requestToolDelete('Hapus dokumen ini?', async () => {
            try {
                const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
                if(res.ok) {
                    window.showNavbarAlert('Dokumen dihapus', 'success');
                    fetchVault();
                } else {
                    window.showNavbarAlert('Gagal menghapus', 'error');
                }
            } catch(e) {
                window.showNavbarAlert('Error sistem', 'error');
            }
        });
    };

    window.askDeleteMemory = function(id) {
        window.requestToolDelete('Hapus memori ini?', async () => {
            try {
                const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
                if(res.ok) {
                    window.showNavbarAlert('Memori dihapus', 'success');
                    fetchMemories();
                } else {
                    window.showNavbarAlert('Gagal menghapus', 'error');
                }
            } catch(e) {
                window.showNavbarAlert('Error sistem', 'error');
            }
        });
    };

    if (modelBtn) {
        modelBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (toolsMenu) toolsMenu.classList.toggle('hidden'); if (toolsChevron) toolsChevron.classList.toggle('rotate-180'); });
    }
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); sendMessage(); } });
        messageInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });
    }
    if (sendBtn) sendBtn.addEventListener('click', (e) => { e.preventDefault(); sendMessage(); });
    document.addEventListener('click', (e) => { if (modelBtn && toolsMenu && !modelBtn.contains(e.target) && !toolsMenu.contains(e.target)) { if (!toolsMenu.classList.contains('hidden')) { toolsMenu.classList.add('hidden'); if (toolsChevron) toolsChevron.classList.remove('rotate-180'); } } if (!e.target.closest('.options-btn')) { document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden')); } });
    document.querySelectorAll('.model-select-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const modelType = btn.getAttribute('data-model'); if (modelType) setModel(modelType); }); });
    window.setModel = function(type) { currentToolType = type; localStorage.setItem('dardcor_selected_model', type); updateModelUI(type); if (toolsMenu) toolsMenu.classList.add('hidden'); if (toolsChevron) toolsChevron.classList.remove('rotate-180'); window.showNavbarAlert(`Model diubah ke ${type === 'dark' ? 'Dark' : (type === 'pro' ? 'Pro' : 'Basic')}`, 'info'); };
    if (chatContainer) { chatContainer.addEventListener('scroll', () => { const threshold = 50; const position = chatContainer.scrollTop + chatContainer.clientHeight; const height = chatContainer.scrollHeight; userIsScrolling = (height - position > threshold); }); }
    function renderEmptyState() { if (!messageList) return; messageList.innerHTML = ` <div id="empty-state" class="flex flex-col items-center justify-center text-gray-500 opacity-50 select-none"> <div class="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 overflow-hidden border border-gray-700 shadow-2xl bg-black"> <img src="/logo.png" class="w-full h-full object-cover"> </div> <p class="text-lg font-medium text-gray-400 text-center">Apa yang bisa saya bantu?</p> </div>`; messageList.className = "w-full max-w-3xl mx-auto flex flex-col h-full items-center justify-center pb-4"; }

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function(url) {
            return '<a href="' + url + '" target="_blank" class="text-purple-500 hover:underline break-all">' + url + '</a>';
        });
    }

    function appendMessage(role, text, files = []) {
        if (!messageList) return null;
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.remove();
        messageList.classList.remove('h-full', 'items-center', 'justify-center');
        messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 pt-4 pb-4";
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} message-bubble-container group min-w-0`;
        
        let fileHtml = '';
        if (files && files.length > 0) {
            const justify = role === 'user' ? 'justify-end' : 'justify-start';
            fileHtml = `<div class="flex flex-wrap gap-3 mb-3 ${justify} w-full">`;
            
            files.forEach(f => {
                const mimetype = (f.type || f.mimetype || '').toLowerCase();
                const filename = f.name || f.filename || 'Unknown File';
                const isImageMime = mimetype.startsWith('image/');
                
                let imgUrl = null;
                if (isImageMime) {
                    if (f instanceof File) {
                        imgUrl = URL.createObjectURL(f);
                    } else if (f.url) {
                        imgUrl = f.url;
                    } else if (f.path) {
                        imgUrl = f.path;
                    }
                }

                if (imgUrl) {
                    fileHtml += `<div class="relative rounded-xl overflow-hidden border border-purple-900/40 shadow-lg group transition-transform hover:scale-105 bg-[#0f0f15] min-w-[100px] min-h-[100px]">
                                    <img src="${imgUrl}" alt="${filename}" class="max-w-[240px] max-h-[240px] object-cover block" loading="lazy" 
                                    onerror="this.onerror=null; this.src='https://placehold.co/200x200/1e1e2e/FFF?text=Image+Expired'; this.style.opacity='0.5';">
                                 </div>`;
                } else {
                    const iconClass = getFileIconClass(mimetype, filename);
                    fileHtml += `<div class="flex items-center gap-3 bg-[#1e1e2e]/90 px-4 py-3 rounded-xl border border-white/10 text-gray-200 max-w-[240px] shadow-md hover:bg-[#252535] transition-colors">
                                    <div class="w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-white/5">
                                        <i class="fas ${iconClass} text-lg"></i>
                                    </div>
                                    <div class="flex-1 min-w-0 overflow-hidden">
                                        <div class="text-xs font-bold truncate" title="${filename}">${filename}</div>
                                        <div class="text-[9px] text-gray-400 uppercase tracking-wider">${mimetype.split('/')[1] || 'FILE'}</div>
                                    </div>
                                </div>`;
                }
            });
            fileHtml += `</div>`;
        }

        const bubbleClass = role === 'user' ? 'bg-transparent border border-purple-900/60 text-white shadow-[0_0_15px_rgba(59,7,100,0.2)] rounded-br-sm' : 'bg-transparent border-none text-gray-200 rounded-bl-sm';
        let contentHtml = '';
        
        if (role === 'user') { 
            // User message is plain text
            contentHtml = `<div class="whitespace-pre-wrap break-words user-text">${linkify(escapeHtml(text))}</div>`; 
            
            div.innerHTML = `
                <div class="flex flex-col items-end max-w-[92%] min-w-0">
                    ${fileHtml}
                    <div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm ${bubbleClass} w-fit min-w-0 max-w-full overflow-hidden leading-7">
                        ${contentHtml}
                    </div>
                    <div class="mt-1 flex justify-end">
                        <button onclick="copyMessageBubble(this)" class="text-[10px] font-medium bg-transparent border-none p-0 opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-colors text-gray-500 hover:text-white" title="Salin">
                            <i class="fas fa-copy"></i> Salin
                        </button>
                    </div>
                </div>`;
                
        } else {
            // Bot message: Marked with GFM enabled will auto-link raw URLs safely.
            // We do NOT use custom regex to avoid breaking the markdown structure.
            
            if (text !== '...loading_placeholder...' && typeof marked !== 'undefined') { 
                contentHtml = `<textarea class="hidden raw-message-content">${text}</textarea><div class="overflow-guard w-full min-w-0 max-w-full"><div class="markdown-body w-full max-w-full overflow-hidden break-words">${marked.parse(text)}</div></div>`; 
            } else { 
                contentHtml = `<textarea class="hidden raw-message-content">${text}</textarea><div class="overflow-guard w-full min-w-0 max-w-full"><div class="markdown-body w-full max-w-full overflow-hidden break-words"></div></div>`; 
            }
            
            let contentLoading = `<div class="flex items-center gap-3 bg-transparent border border-white/5 px-4 py-3.5 rounded-2xl rounded-bl-sm shadow-md"><div class="loader"></div><span class="text-xs text-purple-400 font-medium animate-pulse">Sedang berpikir...</span></div>`;
            
            let actionButtons = `
                <div class="flex items-center gap-3 mt-1 ml-2 select-none opacity-50 hover:opacity-100 transition-opacity">
                    <button onclick="copyMessageBubble(this)" class="text-[10px] font-medium bg-transparent border-none p-0 mr-2 opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-colors text-gray-500 hover:text-white" title="Salin">
                        <i class="fas fa-copy"></i> Salin
                    </button>
                    <button onclick="speakMessage(this)" class="text-[10px] font-medium bg-transparent border-none p-0 mr-2 opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-colors text-gray-500 hover:text-white" title="Dengarkan">
                        <i class="fas fa-volume-up"></i> Dengar
                    </button>
                </div>`;

            if (text === '...loading_placeholder...') { 
                div.innerHTML = `<div class="flex flex-col items-start max-w-[92%] min-w-0">${contentLoading}</div>`; 
            } else { 
                div.innerHTML = `
                    <div class="flex flex-col items-start max-w-[92%] min-w-0">
                        ${fileHtml}
                        <div class="chat-content-box relative rounded-2xl rounded-bl-none px-4 py-3 shadow-md text-sm ${bubbleClass} w-fit min-w-0 max-w-full overflow-hidden leading-7">
                            ${contentHtml}
                        </div>
                        ${actionButtons}
                    </div>`; 
            }
        }
        
        messageList.appendChild(div);
        if (role === 'bot' && text !== '...loading_placeholder...') {
            const body = div.querySelector('.markdown-body');
            if (body && window.renderMathInElement) { renderMathInElement(body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); }
            if (body && typeof hljs !== 'undefined') { body.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el)); }
        }
        return div;
    }

    async function sendMessage() {
        if (isSending) { if (abortController) { abortController.abort(); abortController = null; isSending = false; if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); const indicator = document.getElementById('loading-indicator'); if (indicator) indicator.remove(); } return; }
        const msg = messageInput ? messageInput.value.trim() : '';
        if (!msg && selectedFiles.length === 0) return;
        isSending = true; abortController = new AbortController(); if (sendIcon) sendIcon.classList.replace('fa-paper-plane', 'fa-stop');
        if (messageInput) { messageInput.blur(); messageInput.value = ''; messageInput.style.height = 'auto'; }
        if (filePreviewContainer) filePreviewContainer.classList.add('hidden');
        appendMessage('user', msg, selectedFiles);
        const loaderDiv = appendMessage('bot', '...loading_placeholder...', []); if (loaderDiv) loaderDiv.id = 'loading-indicator'; if (!userIsScrolling) scrollToBottom(true);
        const fd = new FormData(); fd.append('message', msg); fd.append('conversationId', serverData.currentConversationId || ''); fd.append('toolType', currentToolType); const activeId = selectedPersonaId || localStorage.getItem('activePersonaId'); if (activeId && activeId !== 'null') fd.append('personaId', activeId); selectedFiles.forEach(f => fd.append('file_attachment', f)); selectedFiles = []; if (fileInput) fileInput.value = '';
        try {
            const response = await fetch('/dardcorchat/ai/chat-stream', { method: 'POST', body: fd, signal: abortController.signal });
            if (!response.ok) throw new Error("Server Error");
            if (loaderDiv) loaderDiv.remove();
            const botDiv = document.createElement('div'); botDiv.className = "flex w-full justify-start message-bubble-container group min-w-0";
            
            const actionButtons = `
                <div class="flex items-center gap-3 mt-1 ml-2 select-none opacity-50 hover:opacity-100 transition-opacity">
                    <button onclick="copyMessageBubble(this)" class="text-[10px] font-medium bg-transparent border-none p-0 mr-2 opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-colors text-gray-500 hover:text-white" title="Salin">
                        <i class="fas fa-copy"></i> Salin
                    </button>
                    <button onclick="speakMessage(this)" class="text-[10px] font-medium bg-transparent border-none p-0 mr-2 opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-colors text-gray-500 hover:text-white" title="Dengarkan">
                        <i class="fas fa-volume-up"></i> Dengar
                    </button>
                </div>`;

            botDiv.innerHTML = `
                <div class="flex flex-col items-start max-w-[92%] min-w-0">
                    <div class="chat-content-box relative rounded-2xl rounded-bl-none px-4 py-3 shadow-md text-sm bg-transparent border-none text-gray-200 rounded-bl-sm w-fit min-w-0 max-w-full overflow-hidden leading-7">
                        <div class="overflow-guard w-full min-w-0 max-w-full">
                            <div class="markdown-body w-full max-w-full overflow-hidden break-words"></div>
                        </div>
                    </div>
                    ${actionButtons}
                </div>`;

            if (messageList) messageList.appendChild(botDiv);
            const botContent = botDiv.querySelector('.markdown-body'); const reader = response.body.getReader(); const decoder = new TextDecoder(); let fullText = ""; let buffer = ""; let isStreaming = true; let lastUpdate = 0;
            const render = (timestamp) => {
                if (!isStreaming) return; if (timestamp - lastUpdate < 50) { requestAnimationFrame(render); return; } lastUpdate = timestamp;
                let formatted = fullText; 
                
                // Handle Thinking Blocks
                const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/); 
                if (thinkMatch) { 
                    const clean = thinkMatch[1].trim().replace(/\n/g, '<br>'); 
                    formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-transparent border border-white/10 rounded-lg overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-white/10 bg-black/20 leading-relaxed italic">${clean}</div></details>`); 
                }
                
                // Pass text directly to Marked. GFM enabled will handle links properly.
                // We removed the ensureMarkdownLinks regex because it causes conflict with [object Object].

                if (botContent) { 
                    if (typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted); 
                    else botContent.innerText = formatted; 
                    
                    if (window.renderMathInElement) renderMathInElement(botContent, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); 
                    if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el)); 
                } 
                if (!userIsScrolling) scrollToBottom(); requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
            while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n\n'); buffer = lines.pop(); for (const line of lines) { if (line.startsWith('data: ')) { try { const json = JSON.parse(line.replace('data: ', '')); if (json.chunk) fullText += json.chunk; } catch (e) {} } } }
            isStreaming = false; 
            
            // Final Render
            let formatted = fullText; 
            const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/); 
            if (thinkMatch) formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-transparent border border-white/10 rounded-lg overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-white/10 bg-black/20 leading-relaxed italic">${thinkMatch[1].trim().replace(/\n/g, '<br>')}</div></details>`);
            
            if (botContent) { if (typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted); else botContent.innerText = formatted; if (window.renderMathInElement) renderMathInElement(botContent, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el)); } if (!userIsScrolling) scrollToBottom(true);
        } catch (e) { const indicator = document.getElementById('loading-indicator'); if (indicator) indicator.remove(); window.showNavbarAlert('Gagal mengirim pesan', 'error'); scrollToBottom(true); } finally { isSending = false; abortController = null; if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); }
    }

    function scrollToBottom(force = false) { if (!chatContainer) return; const threshold = 150; const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold; if (force || isNearBottom) { chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'auto' }); } }
    function initHighlight() { document.querySelectorAll('.message-bubble-container pre code').forEach(el => { if (typeof hljs !== 'undefined') hljs.highlightElement(el); }); document.querySelectorAll('.message-bubble-container .raw-message-content').forEach(raw => { const target = raw.nextElementSibling; if (target && target.classList.contains('markdown-body')) { if (typeof marked !== 'undefined') target.innerHTML = marked.parse(raw.value); if (window.renderMathInElement) renderMathInElement(target, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } }); }
    if (messageList) { const hasMessages = messageList.querySelectorAll('.message-bubble-container').length > 0; const isActuallyEmpty = !hasMessages || !serverData.currentConversationId; if (isActuallyEmpty) { messageList.innerHTML = ''; renderEmptyState(); } else { initHighlight(); scrollToBottom(true); applyMinimalistStyle(); } }

    window.toggleMenu = function(event, menuId) { if (event) event.stopPropagation(); document.querySelectorAll('[id^="menu-"]').forEach(el => { if (el.id !== menuId) el.classList.add('hidden'); }); const menu = document.getElementById(menuId); if (menu) menu.classList.toggle('hidden'); };
    window.toggleSidebar = function() { const sidebar = document.getElementById('sidebar'); const overlay = document.getElementById('mobile-overlay'); if (!sidebar) return; if (window.innerWidth < 1024) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); } else { document.body.classList.toggle('sidebar-closed'); } };
    window.closeSidebarIfMobile = function() { if (window.innerWidth < 1024) { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('mobile-overlay').classList.add('hidden'); } };
    window.closePreview = function() { document.getElementById('diagram-overlay').classList.add('hidden'); setTimeout(() => { document.getElementById('diagram-frame').src = 'about:blank'; }, 300); };
    window.openRenameModal = function(id) { chatToEdit = id; const currentTitleEl = document.getElementById(`raw-title-${id}`); const input = document.getElementById('rename-input'); const modal = document.getElementById('rename-modal'); if (input && currentTitleEl) input.value = currentTitleEl.value; if (modal) modal.classList.add('active'); document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden')); };
    window.openDeleteModal = function(id) { chatToDelete = id; const modal = document.getElementById('delete-modal'); if (modal) modal.classList.add('active'); document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden')); };
    window.closeModal = function(id) { const modal = document.getElementById(id); if (modal) modal.classList.remove('active'); };
    window.closeModals = function() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); };
    window.submitRename = async function() { const input = document.getElementById('rename-input'); const newTitle = input ? input.value : ''; if (!newTitle || !chatToEdit) return; try { const res = await fetch('/dardcorchat/ai/rename-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: chatToEdit, newTitle }) }); if (res.ok) { const titleEl = document.getElementById(`title-${chatToEdit}`); const rawInput = document.getElementById(`raw-title-${chatToEdit}`); if (titleEl) titleEl.innerText = newTitle.length > 25 ? newTitle.substring(0, 25) + '...' : newTitle; if (rawInput) rawInput.value = newTitle; window.showNavbarAlert('Nama percakapan diperbarui', 'success'); closeModal('rename-modal'); } else { window.showNavbarAlert('Gagal mengubah nama', 'error'); } } catch (e) { console.error(e); window.showNavbarAlert('Terjadi kesalahan sistem', 'error'); } };
    
    window.submitDelete = async function() { 
        if (!chatToDelete) return; 
        try { 
            const res = await fetch('/dardcorchat/ai/delete-chat-history', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ conversationId: chatToDelete }) 
            }); 
            if (res.ok) { 
                const item = document.getElementById(`chat-item-${chatToDelete}`); 
                if (item) item.remove(); 
                
                if (serverData.currentConversationId === chatToDelete) {
                    serverData.currentConversationId = '';
                    messageList.innerHTML = '';
                    renderEmptyState();
                    window.history.pushState(null, '', '/dardcorchat/dardcor-ai');
                }
                
                window.showNavbarAlert('Percakapan dihapus', 'success'); 
                closeModal('delete-modal'); 
            } else { 
                window.showNavbarAlert('Gagal menghapus percakapan', 'error'); 
            } 
        } catch (e) { 
            console.error(e); 
            window.showNavbarAlert('Terjadi kesalahan sistem', 'error'); 
        } 
    };

    window.updateActiveChatUI = function(id) { const historyItems = document.querySelectorAll('[id^="chat-item-"], #new-chat-highlight-target'); historyItems.forEach(el => { el.classList.remove('bg-[#202336]', 'text-white', 'border-purple-900', 'border-l-2'); el.classList.add('text-gray-400', 'border-l-2', 'border-transparent', 'hover:bg-white/5'); const btn = el.querySelector('.options-btn'); if (btn) { btn.classList.remove('opacity-100'); btn.classList.add('opacity-0', 'group-hover:opacity-100'); } }); let activeEl = document.getElementById(`chat-item-${id}`); if (!activeEl) activeEl = document.getElementById('new-chat-highlight-target'); if (activeEl) { activeEl.classList.remove('text-gray-400', 'border-transparent', 'hover:bg-white/5'); activeEl.classList.add('bg-[#202336]', 'text-white', 'border-purple-900'); const btn = activeEl.querySelector('.options-btn'); if (btn) { btn.classList.remove('opacity-0', 'group-hover:opacity-100'); btn.classList.add('opacity-100'); } } document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden')); };
    window.createNewChat = async function() { try { const res = await fetch('/dardcorchat/ai/new-chat', { method: 'POST' }); const data = await res.json(); if (data.success) { const newId = data.redirectUrl.split('/').pop(); loadChat(newId); serverData.currentConversationId = newId; window.showNavbarAlert('Percakapan baru dibuat', 'success'); } } catch (e) { console.error(e); window.showNavbarAlert('Gagal membuat chat baru', 'error'); } };
    window.loadChat = async function(id) { if (isChatLoading) return; isChatLoading = true; window.closeSidebarIfMobile(); window.updateActiveChatUI(id); try { const res = await fetch(`/api/chat/${id}`); const data = await res.json(); if (data.success && messageList) { serverData.currentConversationId = id; messageList.innerHTML = ''; if (!data.history || data.history.length === 0) { renderEmptyState(); } else { messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 pt-4 pb-4"; data.history.forEach(msg => appendMessage(msg.role, msg.message, msg.file_metadata)); setTimeout(() => { initHighlight(); scrollToBottom(true); applyMinimalistStyle(); }, 100); } window.history.pushState({ id: id }, '', `/dardcorchat/dardcor-ai/${id}`); } else { window.showNavbarAlert('Gagal memuat riwayat chat', 'error'); } } catch (e) { console.error(e); window.showNavbarAlert('Koneksi terputus', 'error'); } finally { isChatLoading = false; } };
    window.copyMessageBubble = function(btn) { const bubbleContainer = btn.closest('.message-bubble-container'); if (!bubbleContainer) return; const contentBox = bubbleContainer.querySelector('.chat-content-box'); let textToCopy = ''; const rawTextarea = contentBox.querySelector('.raw-message-content'); if (rawTextarea) textToCopy = rawTextarea.value; else textToCopy = contentBox.innerText; if (textToCopy) { navigator.clipboard.writeText(textToCopy).then(() => { const originalText = btn.innerHTML; btn.innerHTML = `<i class="fas fa-check text-green-400"></i> Disalin`; setTimeout(() => { btn.innerHTML = originalText; }, 2000); }); } };
    function loadVoices() { return new Promise((resolve) => { let voices = window.speechSynthesis.getVoices(); if (voices.length > 0) resolve(voices); else window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices()); }); }
    window.speakMessage = async function(btn) { const bubbleContainer = btn.closest('.message-bubble-container'); if (!bubbleContainer) return; const contentBox = bubbleContainer.querySelector('.chat-content-box'); const textToRead = contentBox.innerText; if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); if (currentUtterance === textToRead) { currentUtterance = null; btn.innerHTML = `<i class="fas fa-volume-up"></i> Dengar`; return; } } const voices = await loadVoices(); const utterance = new SpeechSynthesisUtterance(textToRead); const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID')); if (idVoice) utterance.voice = idVoice; utterance.lang = 'id-ID'; utterance.rate = 1; currentUtterance = textToRead; btn.innerHTML = `<i class="fas fa-stop text-red-400"></i> Stop`; utterance.onend = () => { btn.innerHTML = `<i class="fas fa-volume-up"></i> Dengar`; currentUtterance = null; }; window.speechSynthesis.speak(utterance); };
    window.openPersonaModal = function() { window.closeModals(); const modal = document.getElementById('persona-modal'); if (modal) { modal.classList.add('active'); fetchPersonas(); } };
    async function fetchPersonas() { try { const res = await fetch('/api/personas'); const data = await res.json(); const list = document.getElementById('persona-list'); if (list) { list.innerHTML = ''; if (data.success && data.data) { data.data.forEach(p => { const isActive = selectedPersonaId === p.id; const div = document.createElement('div'); div.className = `flex justify-between items-center p-2 rounded bg-[#151520] border ${isActive ? 'border-purple-900 ring-1 ring-purple-900' : 'border-white/10'} hover:border-purple-900/50 transition`; div.innerHTML = `<div class="cursor-pointer flex-1" onclick="selectPersona('${p.id}', '${p.name}', this)"><div class="font-bold text-xs text-white flex items-center gap-2">${p.name}${isActive ? '<i class="fas fa-check-circle text-purple-600"></i>' : ''}</div><div class="text-[10px] text-gray-400 truncate w-48">${p.instruction}</div></div><button onclick="askDeletePersona('${p.id}')" class="text-red-400 hover:text-red-300 ml-2 p-1"><i class="fas fa-trash"></i></button>`; list.appendChild(div); }); } } } catch (e) { console.error(e); } }
    window.addPersona = async function() { const nameInput = document.getElementById('new-persona-name'); const instInput = document.getElementById('new-persona-inst'); if (!nameInput || !instInput) return; const name = nameInput.value; const instruction = instInput.value; if (!name || !instruction) return; try { const res = await fetch('/api/personas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, instruction }) }); const result = await res.json(); if (result.success && result.data) { selectPersona(result.data.id, result.data.name); window.showNavbarAlert('Persona berhasil dibuat', 'success'); window.closeModals(); } nameInput.value = ''; instInput.value = ''; fetchPersonas(); } catch (e) { console.error(e); window.showNavbarAlert('Gagal membuat persona', 'error'); } };
    window.selectPersona = function(id, name, el) { selectedPersonaId = id; selectedPersonaName = name; localStorage.setItem('activePersonaId', id); localStorage.setItem('activePersonaName', name); updatePersonaUI(); window.showNavbarAlert(`Persona diaktifkan: ${name}`, 'info'); const modal = document.getElementById('persona-modal'); if (modal && modal.classList.contains('active')) fetchPersonas(); };
    window.deselectPersona = function() { selectedPersonaId = null; selectedPersonaName = null; localStorage.removeItem('activePersonaId'); localStorage.removeItem('activePersonaName'); updatePersonaUI(); window.showNavbarAlert('Persona dinonaktifkan', 'info'); const modal = document.getElementById('persona-modal'); if (modal && modal.classList.contains('active')) fetchPersonas(); };
    function updatePersonaUI() { const indicator = document.getElementById('active-persona-container'); const label = document.getElementById('active-persona-label'); if (selectedPersonaId && selectedPersonaName) { if (indicator) { indicator.classList.remove('hidden'); indicator.classList.add('flex'); } if (label) label.innerText = selectedPersonaName; } else { if (indicator) { indicator.classList.add('hidden'); indicator.classList.remove('flex'); } } }
    window.openVaultModal = function() { window.closeModals(); const modal = document.getElementById('vault-modal'); if (modal) { modal.classList.add('active'); fetchVault(); } };
    async function fetchVault() { try { const res = await fetch('/api/vault'); const data = await res.json(); const list = document.getElementById('vault-list'); if (list) { list.innerHTML = ''; if (data.success && data.data) { data.data.forEach(v => { list.innerHTML += `<div class="flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 mb-1"><div class="text-xs text-white font-bold truncate w-64">${v.title}</div><button onclick="askDeleteVault('${v.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></div>`; }); } } } catch (e) { console.error(e); } }
    window.addVault = async function() { const titleInput = document.getElementById('new-vault-title'); const contentInput = document.getElementById('new-vault-content'); if (!titleInput || !contentInput) return; const title = titleInput.value; const content = contentInput.value; if (!title || !content) return; try { await fetch('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) }); titleInput.value = ''; contentInput.value = ''; window.showNavbarAlert('Dokumen disimpan ke Vault', 'success'); window.closeModals(); fetchVault(); } catch (e) { console.error(e); window.showNavbarAlert('Gagal menyimpan dokumen', 'error'); } };
    window.openMemoryModal = function() { window.closeModals(); const modal = document.getElementById('memory-modal'); if (modal) { modal.classList.add('active'); fetchMemories(); } };
    async function fetchMemories() { try { const res = await fetch('/api/memories'); const data = await res.json(); const list = document.getElementById('memory-list'); if (list) { list.innerHTML = ''; if (data.success && data.data) { data.data.forEach(m => { list.innerHTML += `<div class="flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 mb-1"><div class="text-xs text-white truncate w-64">${m.fact}</div><button onclick="askDeleteMemory('${m.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></div>`; }); } } } catch (e) { console.error(e); } }
    window.addMemory = async function() { const input = document.getElementById('new-memory'); if (!input) return; const fact = input.value; if (!fact) return; try { await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fact }) }); input.value = ''; window.showNavbarAlert('Memori baru ditambahkan', 'success'); window.closeModals(); fetchMemories(); } catch (e) { console.error(e); window.showNavbarAlert('Gagal menambah memori', 'error'); } };
    window.previewCode = async function(btn) { const container = btn.closest('.terminal-container'); if (!container) return; const rawCodeEl = container.querySelector('.raw-code'); if (!rawCodeEl) return; const rawCode = rawCodeEl.value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; try { const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode }) }); const data = await res.json(); if (data.success) { const overlay = document.getElementById('diagram-overlay'); const frame = document.getElementById('diagram-frame'); if (frame) frame.src = `/dardcorchat/dardcor-ai/preview/${data.previewId}`; if (overlay) overlay.classList.remove('hidden'); } else { window.showNavbarAlert('Gagal memuat preview', 'error'); } } catch (e) { console.error(e); window.showNavbarAlert('Error sistem preview', 'error'); } finally { btn.innerHTML = original; btn.disabled = false; } };
    window.previewDiagram = async function(btn) { const container = btn.closest('.terminal-container'); if (!container) return; const rawCodeEl = container.querySelector('.raw-code'); if (!rawCodeEl) return; let rawCode = rawCodeEl.value.replace(/```mermaid/g, '').replace(/```/g, '').trim().replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"'); const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; try { const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode, type: 'diagram' }) }); const data = await res.json(); if (data.success) { const overlay = document.getElementById('diagram-overlay'); const frame = document.getElementById('diagram-frame'); if (frame) frame.src = `/dardcorchat/dardcor-ai/diagram/${data.previewId}`; if (overlay) overlay.classList.remove('hidden'); } else { window.showNavbarAlert('Gagal memuat diagram', 'error'); } } catch (e) { console.error(e); window.showNavbarAlert('Error sistem diagram', 'error'); } finally { btn.innerHTML = original; btn.disabled = false; } };
    window.copyCode = function(btn) { const container = btn.closest('.terminal-container'); if (!container) return; const rawCodeEl = container.querySelector('.raw-code'); if (!rawCodeEl) return; const code = rawCodeEl.value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); navigator.clipboard.writeText(code).then(() => { const origin = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => btn.innerHTML = origin, 2000); window.showNavbarAlert('Kode disalin', 'success'); }); };
    function escapeHtml(u) { return u.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
});