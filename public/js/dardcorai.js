document.addEventListener('DOMContentLoaded', () => {
    let currentToolType = SERVER_DATA.toolType;
    let selectedPersonaId = null;
    let currentUtterance = null;
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const fileInput = document.getElementById('file-upload');
    const sendBtn = document.getElementById('send-btn');
    const sendIcon = document.getElementById('send-icon');
    const micBtn = document.getElementById('mic-btn');
    const previewContainer = document.getElementById('file-preview-container');
    let selectedFiles = [];
    let isSending = false;
    let abortController = null;
    let isChatLoading = false;

    try {
        if(typeof marked !== 'undefined') {
            const markedRenderer = new marked.Renderer();
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

                let highlighted = validCode;
                if (lang && lang !== 'mermaid' && typeof hljs !== 'undefined') { 
                    try { if (hljs.getLanguage(lang)) highlighted = hljs.highlight(validCode, { language: lang }).value; } catch (e) {} 
                } 
                if (highlighted === validCode && lang !== 'mermaid' && typeof hljs !== 'undefined') {
                    try { highlighted = hljs.highlightAuto(validCode).value; } catch (e) { highlighted = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
                } else if (lang === 'mermaid') {
                     highlighted = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }

                let btnHtml = '';
                if(lang === 'mermaid') btnHtml = `<button onclick="previewDiagram(this)" class="cmd-btn btn-diagram"><i class="fas fa-project-diagram"></i> Preview Diagram</button>`;
                else if(['html','xml','ejs','php', 'svg'].includes(lang)) btnHtml = `<button onclick="previewCode(this)" class="cmd-btn btn-preview"><i class="fas fa-play"></i> Preview</button>`;

                return `<div class="terminal-container"><div class="terminal-head"><div class="text-xs font-bold text-gray-400 uppercase flex items-center"><i class="fas fa-code mr-2"></i> ${lang || 'CODE'}</div><div class="terminal-actions flex gap-2">${btnHtml}<button onclick="copyCode(this)" class="cmd-btn btn-copy" title="Salin Kode"><i class="fas fa-copy"></i></button></div></div><div class="terminal-code"><pre><code class="hljs ${lang}">${highlighted}</code></pre><textarea class="hidden raw-code">${validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea></div></div>`;
            };
            marked.setOptions({ 
                renderer: markedRenderer,
                gfm: true,
                breaks: true 
            });
        }
    } catch(e){}

    window.copyMessageBubble = function(btn) {
        const bubbleContainer = btn.closest('.message-bubble-container');
        const contentBox = bubbleContainer.querySelector('.chat-content-box');
        let textToCopy = '';
        const rawTextarea = contentBox.querySelector('.raw-message-content');
        if (rawTextarea) textToCopy = rawTextarea.value; else textToCopy = contentBox.innerText;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                const span = btn.querySelector('span');
                const originalText = span.innerText;
                const icon = btn.querySelector('i');
                const originalIconClass = icon.className;
                
                span.innerText = "Disalin";
                icon.className = 'fas fa-check text-green-400 text-xs';
                
                setTimeout(() => {
                    span.innerText = originalText;
                    icon.className = originalIconClass;
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
        const contentBox = bubbleContainer.querySelector('.chat-content-box');
        const textToRead = contentBox.innerText;

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (currentUtterance === textToRead) {
                currentUtterance = null;
                const icon = btn.querySelector('i');
                const span = btn.querySelector('span');
                if(icon) icon.className = 'fas fa-volume-up text-xs';
                if(span) span.innerText = 'Dengar';
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
        
        if(icon) icon.className = 'fas fa-stop text-red-400 text-xs';
        if(span) span.innerText = 'Stop';

        utterance.onend = () => { 
            if(icon) icon.className = originalIconClass; 
            if(span) span.innerText = 'Dengar';
            currentUtterance = null; 
        };
        
        window.speechSynthesis.speak(utterance);
    };

    window.closeModals = function() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); };
    window.openPersonaModal = function() { window.closeModals(); document.getElementById('persona-modal').classList.add('active'); fetchPersonas(); };
    async function fetchPersonas() { try { const res = await fetch('/api/personas'); const data = await res.json(); const list = document.getElementById('persona-list'); list.innerHTML = ''; if(data.success && data.data) { data.data.forEach(p => { const div = document.createElement('div'); div.className = `flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 ${selectedPersonaId === p.id ? 'border-purple-500' : ''}`; div.innerHTML = `<div class="cursor-pointer flex-1" onclick="selectPersona('${p.id}', this)"><div class="font-bold text-xs text-white">${p.name}</div><div class="text-[10px] text-gray-400 truncate w-48">${p.instruction}</div></div><button onclick="deletePersona('${p.id}')" class="text-red-400 hover:text-red-300 ml-2"><i class="fas fa-trash"></i></button>`; list.appendChild(div); }); } } catch(e) {} }
    window.addPersona = async function() { const name = document.getElementById('new-persona-name').value; const instruction = document.getElementById('new-persona-inst').value; if(!name || !instruction) return; try { await fetch('/api/personas', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, instruction}) }); document.getElementById('new-persona-name').value = ''; document.getElementById('new-persona-inst').value = ''; fetchPersonas(); } catch(e) {} };
    window.deletePersona = async function(id) { if(!confirm('Hapus persona ini?')) return; try { await fetch(`/api/personas/${id}`, { method: 'DELETE' }); if(selectedPersonaId === id) selectedPersonaId = null; fetchPersonas(); } catch(e) {} };
    window.selectPersona = function(id, el) { if(selectedPersonaId === id) { selectedPersonaId = null; el.parentElement.classList.remove('border-purple-500'); } else { selectedPersonaId = id; document.querySelectorAll('#persona-list > div').forEach(d => d.classList.remove('border-purple-500')); el.parentElement.classList.add('border-purple-500'); } };
    window.openVaultModal = function() { window.closeModals(); document.getElementById('vault-modal').classList.add('active'); fetchVault(); };
    async function fetchVault() { try { const res = await fetch('/api/vault'); const data = await res.json(); const list = document.getElementById('vault-list'); list.innerHTML = ''; if(data.success && data.data) { data.data.forEach(v => { list.innerHTML += `<div class="flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 mb-1"><div class="text-xs text-white font-bold truncate w-64">${v.title}</div><button onclick="deleteVault('${v.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></div>`; }); } } catch(e) {} }
    window.addVault = async function() { const title = document.getElementById('new-vault-title').value; const content = document.getElementById('new-vault-content').value; if(!title || !content) return; try { await fetch('/api/vault', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title, content}) }); document.getElementById('new-vault-title').value = ''; document.getElementById('new-vault-content').value = ''; fetchVault(); } catch(e) {} };
    window.deleteVault = async function(id) { if(!confirm('Hapus dokumen ini?')) return; try { await fetch(`/api/vault/${id}`, { method: 'DELETE' }); fetchVault(); } catch(e) {} };
    window.openMemoryModal = function() { window.closeModals(); document.getElementById('memory-modal').classList.add('active'); fetchMemories(); };
    async function fetchMemories() { try { const res = await fetch('/api/memories'); const data = await res.json(); const list = document.getElementById('memory-list'); list.innerHTML = ''; if(data.success && data.data) { data.data.forEach(m => { list.innerHTML += `<div class="flex justify-between items-center p-2 rounded bg-[#151520] border border-white/10 mb-1"><div class="text-xs text-white truncate w-64">${m.fact}</div><button onclick="deleteMemory('${m.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></div>`; }); } } catch(e) {} }
    window.addMemory = async function() { const fact = document.getElementById('new-memory').value; if(!fact) return; try { await fetch('/api/memories', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({fact}) }); document.getElementById('new-memory').value = ''; fetchMemories(); } catch(e) {} };
    window.deleteMemory = async function(id) { if(!confirm('Hapus memori ini?')) return; try { await fetch(`/api/memories/${id}`, { method: 'DELETE' }); fetchMemories(); } catch(e) {} };

    window.toggleSidebar = function() { const sidebar = document.getElementById('sidebar'); const overlay = document.getElementById('mobile-overlay'); const isMobile = window.innerWidth < 1024; if (isMobile) { if (sidebar.classList.contains('-translate-x-full')) { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); } else { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden'); } } else { document.body.classList.toggle('sidebar-closed'); localStorage.setItem('dardcor_sidebar_state', document.body.classList.contains('sidebar-closed') ? 'closed' : 'open'); } };
    window.closeSidebarIfMobile = function() { if (window.innerWidth < 1024) { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('mobile-overlay').classList.add('hidden'); } };
    window.updateActiveChatUI = function(id) { const activeClasses = ['bg-[#202336]', 'text-white', 'border-purple-500']; const inactiveClasses = ['text-gray-400', 'border-transparent', 'hover:bg-white/5']; document.querySelectorAll('[id^="chat-item-"]').forEach(el => { el.classList.remove(...activeClasses); el.classList.add(...inactiveClasses); }); const newItem = document.getElementById('current-new-chat-item'); if (newItem) { newItem.classList.remove(...activeClasses); newItem.classList.add(...inactiveClasses); } if (id) { const activeItem = document.getElementById(`chat-item-${id}`); if (activeItem) { activeItem.classList.remove(...inactiveClasses); activeItem.classList.add(...activeClasses); } } else { if (newItem) { newItem.classList.remove(...inactiveClasses); newItem.classList.add(...activeClasses); } } };
    
    window.createNewChat = async function() { try { const res = await fetch('/dardcorchat/ai/new-chat', { method: 'POST' }); const data = await res.json(); if (data.success) { const newId = data.redirectUrl.split('/').pop(); loadChat(newId); SERVER_DATA.currentConversationId = newId; window.updateActiveChatUI(null); } } catch (e) {} };
    
    window.loadChat = async function(id) { 
        if (isChatLoading) return; isChatLoading = true; window.closeSidebarIfMobile(); window.updateActiveChatUI(id); 
        try { 
            const res = await fetch(`/api/chat/${id}`); const data = await res.json(); 
            if (data.success) { 
                SERVER_DATA.currentConversationId = id; 
                messageList.innerHTML = ''; 
                if (!data.history || data.history.length === 0) { renderEmptyState(); } 
                else { 
                    messageList.className = "w-full flex flex-col gap-6 mt-auto pb-4"; 
                    data.history.forEach(msg => appendMessage(msg.role, msg.message, msg.file_metadata)); 
                    setTimeout(initHighlight, 50);
                } 
                window.history.pushState({ id: id }, '', `/dardcorchat/dardcor-ai/${id}`); 
                scrollToBottom(true); 
            } 
        } catch (e) {} finally { isChatLoading = false; } 
    };

    function renderEmptyState() { messageList.className = "w-full h-full absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4"; messageList.innerHTML = ` <div id="empty-state" class="flex flex-col items-center justify-center text-gray-500 opacity-50 select-none"> <div class="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 overflow-hidden border border-gray-700 shadow-2xl bg-black"> <img src="/logo.png" class="w-full h-full object-cover"> </div> <p class="text-lg font-medium text-gray-400 text-center">Apa yang bisa saya bantu?</p> </div>`; }

    function appendMessage(role, text, files = []) {
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.remove(); 
        
        messageList.className = "w-full flex flex-col gap-6 mt-auto pb-4"; 

        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} message-bubble-container group min-w-0`;

        let fileHtml = '';
        if (files && files.length > 0) {
            const justify = role === 'user' ? 'justify-end' : 'justify-start';
            fileHtml = `<div class="flex flex-wrap gap-2 mb-2 ${justify} w-full">`;
            files.forEach(f => { fileHtml += `<div class="text-[10px] flex items-center gap-2 bg-[#1c1c2e] px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 max-w-full shadow-sm"><i class="fas fa-file text-purple-400"></i> <span class="truncate">${f.filename}</span></div>`; });
            fileHtml += `</div>`;
        }

        const bubbleClass = role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-[#1e1e2e] text-gray-200 rounded-bl-sm border border-white/5';
        const contentHtml = role === 'user' ? 
            `<div class="whitespace-pre-wrap break-words user-text">${escapeHtml(text)}</div>` : 
            `<textarea class="hidden raw-message-content">${text}</textarea><div class="markdown-body w-full max-w-full overflow-x-auto break-words"></div>`;

        let contentLoading = `
            <div class="flex items-center gap-3 bg-[#1e1e2e] px-4 py-3.5 rounded-2xl rounded-bl-sm border border-white/5 shadow-md">
                <div class="loader"></div>
                <span class="text-xs text-purple-400 font-medium animate-pulse">Sedang berpikir...</span>
            </div>`;

        let actionButtons = `
            <div class="flex items-center gap-2 mt-2 px-1 select-none">
                <button onclick="copyMessageBubble(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-[#1c1c2e] border border-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm active:scale-95" title="Salin">
                    <i class="fas fa-copy text-xs"></i> <span class="text-[10px] font-medium">Salin</span>
                </button>
                ${role !== 'user' ? `<button onclick="speakMessage(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-[#1c1c2e] border border-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm active:scale-95" title="Dengarkan"><i class="fas fa-volume-up text-xs"></i> <span class="text-[10px] font-medium">Dengar</span></button>` : ''}
            </div>
        `;

        if (text === '...loading_placeholder...') {
             div.innerHTML = `
            <div class="flex flex-col items-start max-w-[92%] md:max-w-[82%] min-w-0">
                ${contentLoading}
            </div>`;
        } else {
             div.innerHTML = `
            <div class="flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} max-w-[92%] md:max-w-[82%] min-w-0">
                ${fileHtml}
                <div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm ${bubbleClass} w-fit min-w-0 max-w-full overflow-hidden leading-7">
                    ${contentHtml}
                </div>
                ${actionButtons}
            </div>`;
        }

        messageList.appendChild(div);
        return div;
    }

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            micBtn.classList.toggle('text-purple-500');
            micBtn.classList.toggle('bg-white/10');
            if(messageInput) messageInput.placeholder = micBtn.classList.contains('text-purple-500') ? "Mendengarkan..." : "Ask To Dardcor...";
        });
    }

    window.previewCode = async function(btn) { const rawCode = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; try { const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode }) }); const data = await res.json(); if(data.success) { const overlay = document.getElementById('diagram-overlay'); const frame = document.getElementById('diagram-frame'); frame.src = `/dardcorchat/dardcor-ai/preview/${data.previewId}`; overlay.classList.remove('hidden'); } } catch(e) {} finally { btn.innerHTML = original; btn.disabled = false; } };
    window.previewDiagram = async function(btn) { let rawCode = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/```mermaid/g, '').replace(/```/g, '').trim().replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"'); const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; try { const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode, type: 'diagram' }) }); const data = await res.json(); if(data.success) { const overlay = document.getElementById('diagram-overlay'); const frame = document.getElementById('diagram-frame'); frame.src = `/dardcorchat/dardcor-ai/diagram/${data.previewId}`; overlay.classList.remove('hidden'); } } catch(e) {} finally { btn.innerHTML = original; btn.disabled = false; } };
    window.copyCode = function(btn) { const code = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); navigator.clipboard.writeText(code).then(() => { const origin = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => btn.innerHTML = origin, 2000); }); };
    window.setModel = function(type) { currentToolType = type; const label = document.getElementById('tool-label'); if (label) label.innerText = type === 'dark' ? 'Dark Model' : (type === 'pro' ? 'Pro Model' : 'Basic Model'); document.getElementById('tools-menu').classList.add('hidden'); document.getElementById('tools-chevron').classList.remove('rotate-180'); const input = document.getElementById('message-input'); if(input) input.placeholder = type === 'pro' ? "Ask Dardcor Pro..." : "Ask To Dardcor..."; };
    function escapeHtml(u) { return u.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
    
    if (messageList.children.length === 0) { renderEmptyState(); } else { initHighlight(); scrollToBottom(true); }
    if (document.getElementById('model-dropdown-btn')) { document.getElementById('model-dropdown-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('tools-menu').classList.toggle('hidden'); document.getElementById('tools-chevron').classList.toggle('rotate-180'); }); }
    document.querySelectorAll('.model-select-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setModel(btn.dataset.model); }); });
    if (document.getElementById('refresh-chat-btn')) document.getElementById('refresh-chat-btn').addEventListener('click', refreshChat);
    if (messageInput) { messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }); messageInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; }); }
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (fileInput) fileInput.addEventListener('change', function() { handleFiles(this.files); });
    
    async function sendMessage() { 
        if (isSending) { if (abortController) { abortController.abort(); abortController = null; isSending = false; if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); if (document.getElementById('loading-indicator')) document.getElementById('loading-indicator').remove(); } return; } 
        const msg = messageInput.value.trim(); if (!msg && selectedFiles.length === 0) return; 
        isSending = true; abortController = new AbortController(); if (sendIcon) sendIcon.classList.replace('fa-paper-plane', 'fa-stop'); messageInput.blur(); messageInput.value = ''; messageInput.style.height = 'auto'; 
        
        appendMessage('user', msg, selectedFiles); 
        
        const loaderDiv = appendMessage('bot', '...loading_placeholder...', []); 
        loaderDiv.id = 'loading-indicator'; 
        scrollToBottom(true); 
        
        const fd = new FormData(); fd.append('message', msg); fd.append('conversationId', SERVER_DATA.currentConversationId); fd.append('toolType', currentToolType); if (selectedPersonaId) fd.append('personaId', selectedPersonaId); selectedFiles.forEach(f => fd.append('file_attachment', f)); selectedFiles = []; renderPreviews(); if (fileInput) fileInput.value = ''; 
        try { 
            const response = await fetch('/dardcorchat/ai/chat-stream', { method: 'POST', body: fd, signal: abortController.signal }); 
            loaderDiv.remove(); 
            const botDiv = document.createElement('div'); botDiv.className = "flex w-full justify-start message-bubble-container group min-w-0"; 
            botDiv.innerHTML = `
            <div class="flex flex-col items-start max-w-[92%] md:max-w-[82%] min-w-0">
                <div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm bg-[#1e1e2e] text-gray-200 rounded-bl-sm border border-white/5 w-fit min-w-0 max-w-full overflow-hidden leading-7">
                    <div class="markdown-body w-full max-w-full overflow-x-auto break-words"></div>
                </div>
                <div class="flex items-center gap-2 mt-2 px-1 select-none">
                    <button onclick="copyMessageBubble(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-[#1c1c2e] border border-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm group active:scale-95" title="Salin"><i class="fas fa-copy text-xs"></i> <span class="text-[10px] font-medium">Salin</span></button>
                    <button onclick="speakMessage(this)" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-[#1c1c2e] border border-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 shadow-sm group active:scale-95" title="Dengarkan"><i class="fas fa-volume-up text-xs"></i> <span class="text-[10px] font-medium">Dengar</span></button>
                </div>
            </div>`; 
            messageList.appendChild(botDiv); 
            const botContent = botDiv.querySelector('.markdown-body'); 
            const reader = response.body.getReader(); const decoder = new TextDecoder(); let fullText = ""; let isStreaming = true; 
            const render = () => { if (!isStreaming) return; let formatted = fullText; const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/); if (thinkMatch) { const clean = thinkMatch[1].trim().replace(/\n/g, '<br>'); formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-gray-800/50 hover:bg-gray-800 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-gray-700/50 bg-black/20 leading-relaxed italic">${clean}</div></details>`); } if (typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted); else botContent.innerText = formatted; if (window.renderMathInElement) renderMathInElement(botContent, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el)); scrollToBottom(); requestAnimationFrame(render); }; requestAnimationFrame(render); 
            while (true) { const { done, value } = await reader.read(); if (done) break; const lines = decoder.decode(value).split('\n\n'); for (const line of lines) { if (line.startsWith('data: ')) { try { const json = JSON.parse(line.replace('data: ', '')); if (json.chunk) fullText += json.chunk; } catch (e) {} } } } 
            isStreaming = false; let formatted = fullText; const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/); if (thinkMatch) formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-gray-800/50 hover:bg-gray-800 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-gray-700/50 bg-black/20 leading-relaxed italic">${thinkMatch[1].trim().replace(/\n/g, '<br>')}</div></details>`); if (typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted); else botContent.innerText = formatted; if (window.renderMathInElement) renderMathInElement(botContent, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el)); scrollToBottom(true); 
        } catch (e) { if (document.getElementById('loading-indicator')) document.getElementById('loading-indicator').remove(); } finally { isSending = false; abortController = null; if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); } 
    }
    
    function handleFiles(files) { if ([...selectedFiles, ...files].length > 10) { alert("Maksimal 10 file."); return; } selectedFiles = [...selectedFiles, ...files]; renderPreviews(); }
    function renderPreviews() { if (!previewContainer) return; previewContainer.innerHTML = ''; if (selectedFiles.length > 0) { previewContainer.classList.remove('hidden'); previewContainer.classList.add('flex'); } else { previewContainer.classList.add('hidden'); previewContainer.classList.remove('flex'); } selectedFiles.forEach((file, index) => { const div = document.createElement('div'); div.className = "flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 rounded px-2 py-1 border border-purple-500/20"; div.innerHTML = `<i class="fas fa-file text-xs"></i><span class="truncate max-w-[100px]">${file.name}</span><button type="button" class="hover:text-red-400 ml-1 remove-file-btn" data-index="${index}"><i class="fas fa-times"></i></button>`; previewContainer.appendChild(div); }); document.querySelectorAll('.remove-file-btn').forEach(btn => { btn.addEventListener('click', function() { removeFile(parseInt(this.dataset.index)); }); }); }
    function removeFile(index) { selectedFiles.splice(index, 1); renderPreviews(); if (fileInput) fileInput.value = ''; }
    function clearFiles() { selectedFiles = []; renderPreviews(); if (fileInput) fileInput.value = ''; }
    function scrollToBottom(force = false) { if (!chatContainer) return; const t = 150; if (force || chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= t) chatContainer.scrollTop = chatContainer.scrollHeight; }
    function initHighlight() { document.querySelectorAll('.message-bubble-container pre code').forEach(el => { if (typeof hljs !== 'undefined') hljs.highlightElement(el); }); document.querySelectorAll('.message-bubble-container .raw-message-content').forEach(raw => { const target = raw.nextElementSibling; if (target && target.classList.contains('markdown-body')) { if (typeof marked !== 'undefined') target.innerHTML = marked.parse(raw.value); if (window.renderMathInElement) renderMathInElement(target, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } }); }
    async function refreshChat() { if (isChatLoading) return; const icon = document.getElementById('refresh-icon'); if (icon) icon.classList.add('animate-spin'); if (SERVER_DATA.currentConversationId.length > 20) await loadChat(SERVER_DATA.currentConversationId); else window.location.reload(); if (icon) setTimeout(() => icon.classList.remove('animate-spin'), 800); }
});