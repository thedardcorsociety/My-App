/* global marked, hljs, SERVER_DATA, mermaid, renderMathInElement */
document.addEventListener('DOMContentLoaded', () => {
    let currentToolType = SERVER_DATA.toolType;
    let selectedPersonaId = null;

    window.toggleSidebar = function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        const isMobile = window.innerWidth < 1024;
        
        if (isMobile) {
            const isClosed = sidebar.classList.contains('-translate-x-full');
            if (isClosed) { 
                sidebar.classList.remove('-translate-x-full'); 
                if(overlay) overlay.classList.remove('hidden'); 
            } else { 
                sidebar.classList.add('-translate-x-full'); 
                if(overlay) overlay.classList.add('hidden'); 
            }
        } else {
            document.body.classList.toggle('sidebar-closed');
            localStorage.setItem('dardcor_sidebar_state', document.body.classList.contains('sidebar-closed') ? 'closed' : 'open');
        }
    };

    window.closeSidebarIfMobile = function() {
        if(window.innerWidth < 1024) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('mobile-overlay');
            if(sidebar && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
                if(overlay) overlay.classList.add('hidden');
            }
        }
    };

    window.updateActiveChatUI = function(id) {
        document.querySelectorAll('[id^="chat-item-"]').forEach(el => { 
            el.classList.remove('bg-[#202336]', 'border-purple-500'); 
            el.classList.add('border-transparent'); 
        });
        
        const newItem = document.getElementById('current-new-chat-item');
        if(newItem) { 
            newItem.classList.remove('bg-[#202336]', 'border-purple-500'); 
            newItem.classList.add('border-transparent'); 
        }

        const activeItem = document.getElementById(`chat-item-${id}`);
        if (activeItem) {
            activeItem.classList.add('bg-[#202336]', 'border-purple-500'); 
            activeItem.classList.remove('border-transparent'); 
        } else {
            if(newItem) {
                newItem.classList.add('bg-[#202336]', 'border-purple-500'); 
                newItem.classList.remove('border-transparent');
            }
        }
    };

    window.createNewChat = async function() {
        try { 
            const res = await fetch('/dardcorchat/ai/new-chat', { method: 'POST' }); 
            const data = await res.json(); 
            if(data.success) { 
                const newId = data.redirectUrl.split('/').pop(); 
                loadChat(newId); 
            } 
        } catch(e) {}
    };

    window.loadChat = async function(id) {
        if(isChatLoading) return;
        isChatLoading = true;
        window.closeSidebarIfMobile();
        window.updateActiveChatUI(id);

        try {
            const res = await fetch(`/api/chat/${id}`);
            const data = await res.json();
            
            if (data.success) {
                SERVER_DATA.currentConversationId = id;
                messageList.innerHTML = '';
                
                if (data.history.length === 0) {
                    messageList.innerHTML = `<div id="empty-state" class="flex flex-col items-center justify-center text-gray-500 opacity-60 min-h-[50vh]"><div class="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 overflow-hidden border border-gray-700 shadow-xl bg-black"><img src="/logo.png" class="w-full h-full object-cover"></div><p class="text-lg font-medium text-gray-400 text-center">Apa yang bisa saya bantu?</p></div>`;
                } else {
                    data.history.forEach(msg => {
                        const div = document.createElement('div');
                        div.className = `flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-bubble-container`;
                        let fileHtml = '';
                        if(msg.file_metadata) msg.file_metadata.forEach(f => fileHtml += `<div class="mb-2 text-xs flex gap-2 bg-black/20 p-2 rounded border border-white/10"><i class="fas fa-file"></i> <span>${f.filename}</span></div>`);
                        if (msg.role === 'user') {
                            div.innerHTML = `<div class="flex flex-col items-end message-bubble w-full max-w-[95%]"><div class="rounded-2xl p-4 shadow-lg text-sm bg-violet-600 text-white rounded-br-none rounded-bl-2xl border-none w-fit">${fileHtml}<div class="whitespace-pre-wrap">${escapeHtml(msg.message)}</div></div></div>`;
                        } else {
                            div.innerHTML = `<div class="flex flex-col items-start message-bubble w-full max-w-[95%]"><div class="rounded-2xl p-4 shadow-lg text-sm bg-[#13131f] text-gray-200 rounded-bl-none border border-gray-800 w-full overflow-hidden">${fileHtml}<textarea class="hidden raw-message-content">${msg.message}</textarea><div class="markdown-body"></div></div></div>`;
                        }
                        messageList.appendChild(div);
                    });
                    initHighlight();
                }
                window.history.pushState({id: id}, '', `/dardcorchat/dardcor-ai/${id}`);
                scrollToBottom(true);
            }
        } catch (e) { console.error(e); } 
        finally { isChatLoading = false; }
    };

    window.setModel = function(type) {
        currentToolType = type;
        const label = document.getElementById('tool-label');
        if(label) label.innerText = type === 'dark' ? 'Dark Model' : (type === 'pro' ? 'Pro Model' : (type === 'sahabat' ? 'Mode Sahabat' : 'Basic Model'));
        const menu = document.getElementById('tools-menu');
        const chevron = document.getElementById('tools-chevron');
        if(menu) menu.classList.add('hidden');
        if(chevron) chevron.classList.remove('rotate-180');
        const msgInput = document.getElementById('message-input');
        if(msgInput) msgInput.placeholder = type === 'sahabat' ? "Ask To Dardcor..." : (type === 'pro' ? "Ask To Dardcor..." : "Ask To Dardcor...");
    };

    window.openPersonaModal = async function() {
        window.closeSidebarIfMobile();
        document.getElementById('persona-modal').classList.add('active');
        const res = await fetch('/api/personas');
        const { data } = await res.json();
        document.getElementById('persona-list').innerHTML = data.map(p => `
            <div class="flex justify-between items-center bg-black/30 p-2 rounded border border-gray-700 ${selectedPersonaId === p.id ? 'border-purple-500' : ''}">
                <div onclick="selectPersona('${p.id}')" class="cursor-pointer flex-1">
                    <div class="font-bold text-sm text-white">${p.name}</div>
                    <div class="text-xs text-gray-500 truncate">${p.instruction}</div>
                </div>
                <button onclick="deleteItem('personas', '${p.id}')" class="text-red-500 px-2"><i class="fas fa-trash"></i></button>
            </div>`).join('');
    };

    window.selectPersona = function(id) { selectedPersonaId = id; window.closeModals(); alert("Persona Aktif."); };
    window.addPersona = async function() { const name = document.getElementById('new-persona-name').value; const instruction = document.getElementById('new-persona-inst').value; await fetch('/api/personas', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, instruction }) }); window.openPersonaModal(); };
    window.openVaultModal = async function() { window.closeSidebarIfMobile(); document.getElementById('vault-modal').classList.add('active'); const res = await fetch('/api/vault'); const { data } = await res.json(); document.getElementById('vault-list').innerHTML = data.map(d => `<div class="flex justify-between items-center bg-black/30 p-2 rounded border border-gray-700"><div class="text-sm font-bold text-white">${d.title}</div><button onclick="deleteItem('vault', '${d.id}')" class="text-red-500"><i class="fas fa-trash"></i></button></div>`).join(''); };
    window.addVault = async function() { const title = document.getElementById('new-vault-title').value; const content = document.getElementById('new-vault-content').value; await fetch('/api/vault', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content }) }); window.openVaultModal(); };
    window.openMemoryModal = async function() { window.closeSidebarIfMobile(); document.getElementById('memory-modal').classList.add('active'); const res = await fetch('/api/memories'); const { data } = await res.json(); document.getElementById('memory-list').innerHTML = data.map(m => `<div class="flex justify-between items-center bg-black/30 p-2 rounded border border-gray-700"><div class="text-xs text-white">${m.fact}</div><button onclick="deleteItem('memories', '${m.id}')" class="text-red-500"><i class="fas fa-trash"></i></button></div>`).join(''); };
    window.addMemory = async function() { const fact = document.getElementById('new-memory').value; await fetch('/api/memories', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ fact }) }); window.openMemoryModal(); };
    window.deleteItem = async function(type, id) { await fetch(`/api/${type}/${id}`, { method: 'DELETE' }); if(type === 'personas') window.openPersonaModal(); if(type === 'vault') window.openVaultModal(); if(type === 'memories') window.openMemoryModal(); };
    window.closeModals = function() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); };
    
    window.toggleMenu = function(e, id) { if(e) e.stopPropagation(); document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden')); const menu = document.getElementById(id); if(menu) menu.classList.toggle('hidden'); };
    window.openDeleteModal = function(id) { document.getElementById('delete-modal').classList.add('flex'); document.getElementById('delete-modal').classList.remove('hidden'); window.targetChatId = id; window.closeSidebarIfMobile(); };
    window.closeModal = function(id) { document.getElementById(id).classList.remove('flex'); document.getElementById(id).classList.add('hidden'); };
    window.submitDelete = async function() { window.closeModal('delete-modal'); await fetch('/dardcorchat/ai/delete-chat-history', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({conversationId:window.targetChatId})}); const elem = document.getElementById(`chat-item-${window.targetChatId}`); if(elem) elem.remove(); if(window.targetChatId === SERVER_DATA.currentConversationId) window.createNewChat(); };
    window.openRenameModal = function(id) { window.targetChatId = id; document.getElementById('rename-input').value = document.getElementById(`raw-title-${id}`).value; document.getElementById('rename-modal').classList.remove('hidden'); document.getElementById('rename-modal').classList.add('flex'); window.closeSidebarIfMobile(); };
    window.submitRename = async function() { const newName = document.getElementById('rename-input').value; window.closeModal('rename-modal'); if(!newName.trim()) return; await fetch('/dardcorchat/ai/rename-chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ conversationId: window.targetChatId, newTitle: newName }) }); document.getElementById(`title-${window.targetChatId}`).innerText = newName.substring(0, 22) + '...'; document.getElementById(`raw-title-${window.targetChatId}`).value = newName; };
    window.editMessage = function(text) { const input = document.getElementById('message-input'); if(input){ input.value = text; input.focus(); } };
    window.copyUserText = function(btn, text) { navigator.clipboard.writeText(text); const orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => btn.innerHTML = orig, 2000); };
    window.copyMessageText = function(btn) { const txt = btn.closest('.message-bubble-container').querySelector('.markdown-body').innerText; navigator.clipboard.writeText(txt); const i = btn.querySelector('i'); i.className = 'fas fa-check text-green-400'; setTimeout(() => i.className = 'fas fa-copy', 2000); };
    window.speakText = function(btn) { const txt = btn.closest('.message-bubble-container').querySelector('.markdown-body').innerText; if ('speechSynthesis' in window) { if (window.speechSynthesis.speaking) window.speechSynthesis.cancel(); else { const u = new SpeechSynthesisUtterance(txt); u.lang = 'id-ID'; window.speechSynthesis.speak(u); } } };
    
    window.previewCode = async function(btn) {
        const rawCode = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { 
            const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode }) }); 
            const data = await res.json(); 
            if(data.success) {
                const overlay = document.getElementById('diagram-overlay');
                const frame = document.getElementById('diagram-frame');
                frame.src = `/dardcorchat/dardcor-ai/preview/${data.previewId}`;
                overlay.classList.remove('hidden');
            }
        } catch(e) {} finally { btn.innerHTML = original; btn.disabled = false; }
    };

    window.previewDiagram = async function(btn) {
        let rawCode = btn.closest('.terminal-container').querySelector('.raw-code').value;
        rawCode = rawCode.replace(/```mermaid/g, '').replace(/```/g, '').trim();
        rawCode = rawCode.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
        
        const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { 
            const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode, type: 'diagram' }) }); 
            const data = await res.json(); 
            if(data.success) {
                const overlay = document.getElementById('diagram-overlay');
                const frame = document.getElementById('diagram-frame');
                frame.src = `/dardcorchat/dardcor-ai/diagram/${data.previewId}`;
                overlay.classList.remove('hidden');
            } 
        } catch(e) {} finally { btn.innerHTML = original; btn.disabled = false; }
    };

    window.copyCode = function(btn) { const code = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); navigator.clipboard.writeText(code).then(() => { const origin = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => btn.innerHTML = origin, 2000); }); };
    function escapeHtml(u) { return u.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const fileInput = document.getElementById('file-upload');
    const sendBtn = document.getElementById('send-btn');
    const sendIcon = document.getElementById('send-icon');
    const previewContainer = document.getElementById('file-preview-container');
    let selectedFiles = [];
    let isSending = false;
    let abortController = null;
    let isChatLoading = false;

    try {
        if(typeof marked !== 'undefined') {
            const markedRenderer = new marked.Renderer();
            markedRenderer.code = function(code, language) {
                let validCode = (typeof code === 'string' ? code : code.text) || "";
                let lang = (language || '').toLowerCase().trim();
                
                if (!lang) {
                    const firstLine = validCode.split('\n')[0].trim();
                    if (firstLine.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/)) {
                        lang = 'mermaid';
                    }
                }
                
                if (!lang && (validCode.includes('<!DOCTYPE html>') || validCode.includes('<html'))) lang = 'html';
                
                let highlighted = validCode;
                if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang) && lang !== 'mermaid') { 
                    try { highlighted = hljs.highlight(validCode, { language: lang }).value; } catch (e) {} 
                } else { 
                    highlighted = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
                }
                
                let btnHtml = '';
                if(lang === 'mermaid') {
                    btnHtml = `<button onclick="previewDiagram(this)" class="cmd-btn btn-diagram" style="background-color: #7c3aed; color: white;"><i class="fas fa-project-diagram text-[9px]"></i> Preview</button>`;
                } else if(['html','xml','ejs','php'].includes(lang)) {
                    btnHtml = `<button onclick="previewCode(this)" class="cmd-btn btn-preview"><i class="fas fa-play text-[9px]"></i> Preview</button>`;
                }
                
                return `<div class="terminal-container"><div class="terminal-head"><div class="terminal-label"><i class="fas fa-code mr-1"></i> ${lang.toUpperCase() || 'TEXT'}</div><div class="terminal-opts">${btnHtml}<button onclick="copyCode(this)" class="cmd-btn btn-cp"><i class="fas fa-copy"></i> Copy</button></div></div><div class="terminal-code"><pre><code class="hljs ${lang}">${highlighted}</code></pre><textarea class="hidden raw-code">${validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea></div></div>`;
            };
            marked.setOptions({ renderer: markedRenderer });
        }
    } catch(e){}
    try { if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false }); } catch(e){}

    initHighlight();
    scrollToBottom(true);
    window.updateActiveChatUI(SERVER_DATA.currentConversationId);

    if(document.getElementById('model-dropdown-btn')) {
        document.getElementById('model-dropdown-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('tools-menu');
            const chevron = document.getElementById('tools-chevron');
            menu.classList.toggle('hidden');
            if(chevron) chevron.classList.toggle('rotate-180');
        });
    }

    document.querySelectorAll('.model-select-btn').forEach(btn => {
        btn.addEventListener('click', () => setModel(btn.dataset.model));
    });

    if(document.getElementById('refresh-chat-btn')) document.getElementById('refresh-chat-btn').addEventListener('click', refreshChat);
    
    if(messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
            }
        });
        messageInput.addEventListener('input', function() {
            this.style.height='auto';
            this.style.height=Math.min(this.scrollHeight,120)+'px';
        });
    }

    if(sendBtn) sendBtn.addEventListener('click', sendMessage);
    if(fileInput) fileInput.addEventListener('change', function() { handleFiles(this.files); });
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    
    if(document.getElementById('drop-zone')) {
        const dropZone = document.getElementById('drop-zone');
        ['dragenter', 'dragover'].forEach(evt => document.body.addEventListener(evt, () => { dropZone.classList.remove('hidden'); dropZone.classList.add('flex'); }));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => { dropZone.classList.add('hidden'); dropZone.classList.remove('flex'); }));
        document.body.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
    }

    async function sendMessage() {
        if(isSending) {
            if(abortController) { abortController.abort(); abortController = null; isSending = false; if(sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); if(document.getElementById('loading-indicator')) document.getElementById('loading-indicator').remove(); }
            return;
        }
        const msg = messageInput.value.trim();
        if(!msg && selectedFiles.length === 0) return;
        
        isSending = true;
        abortController = new AbortController();
        if(sendIcon) sendIcon.classList.replace('fa-paper-plane', 'fa-stop');
        messageInput.blur(); messageInput.value = ''; messageInput.style.height = 'auto';
        if(document.getElementById('empty-state')) document.getElementById('empty-state').remove();
        
        const userDiv = document.createElement('div');
        userDiv.className = "flex w-full justify-end mb-6 message-bubble-container";
        let fileHtml = '';
        if(selectedFiles.length > 0) fileHtml = `<div class="mb-2 text-xs flex gap-2 bg-black/20 p-2 rounded border border-white/10"><i class="fas fa-file"></i> ${selectedFiles.length} File</div>`;
        userDiv.innerHTML = `<div class="flex flex-col items-end message-bubble w-full max-w-[95%]"><div class="rounded-2xl p-4 shadow-lg text-sm bg-violet-600 text-white rounded-br-none rounded-bl-2xl border-none w-fit">${fileHtml}<div class="whitespace-pre-wrap">${escapeHtml(msg)}</div></div></div>`;
        messageList.appendChild(userDiv);
        
        const loader = document.createElement('div');
        loader.id = 'loading-indicator';
        loader.className = 'flex w-full justify-start mb-6';
        loader.innerHTML = `<div class="flex items-center gap-3 bg-[#13131f] px-4 py-3 rounded-2xl rounded-bl-none border border-gray-800 shadow-md"><div class="loader"></div><span class="text-xs text-gray-400 font-medium animate-pulse">Sedang berpikir...</span></div>`;
        messageList.appendChild(loader);
        scrollToBottom(true);

        const fd = new FormData();
        fd.append('message', msg);
        fd.append('conversationId', SERVER_DATA.currentConversationId); 
        fd.append('toolType', currentToolType);
        if(selectedPersonaId) fd.append('personaId', selectedPersonaId);
        selectedFiles.forEach(f => fd.append('file_attachment', f));
        clearFiles(); 

        try {
            const response = await fetch('/dardcorchat/ai/chat-stream', { method: 'POST', body: fd, signal: abortController.signal });
            loader.remove();
            
            const botDiv = document.createElement('div');
            botDiv.className = "flex w-full justify-start mb-6 message-bubble-container";
            botDiv.innerHTML = `<div class="flex flex-col items-start message-bubble w-full max-w-[95%]"><div class="rounded-2xl p-4 shadow-lg text-sm bg-[#13131f] text-gray-200 rounded-bl-none border border-gray-800 w-full overflow-hidden"><div class="markdown-body"></div></div></div>`;
            messageList.appendChild(botDiv);

            const botContent = botDiv.querySelector('.markdown-body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let isStreaming = true;

            const render = () => { 
                if(!isStreaming) return; 
                let formatted = fullText;
                const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/);
                if (thinkMatch) {
                    const clean = thinkMatch[1].trim().replace(/\n/g, '<br>');
                    formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-gray-800/50 hover:bg-gray-800 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-gray-700/50 bg-black/20 leading-relaxed italic">${clean}</div></details>`);
                }
                if(typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted);
                else botContent.innerText = formatted;

                if(window.renderMathInElement) renderMathInElement(botContent, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
                if(typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
                scrollToBottom(); 
                requestAnimationFrame(render); 
            };
            requestAnimationFrame(render);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value).split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try { const json = JSON.parse(line.replace('data: ', '')); if (json.chunk) fullText += json.chunk; } catch (e) {}
                    }
                }
            }
            isStreaming = false;
            
            let formatted = fullText;
            const thinkMatch = fullText.match(/<think>([\s\S]*?)<\/think>/);
            if(thinkMatch) formatted = fullText.replace(/<think>[\s\S]*?<\/think>/, `<details class="mb-4 bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden group"><summary class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-gray-800/50 hover:bg-gray-800 text-xs font-mono text-gray-400 select-none"><i class="fas fa-brain text-purple-500"></i><span>Thinking</span><i class="fas fa-chevron-down ml-auto transition-transform group-open:rotate-180"></i></summary><div class="p-3 text-xs text-gray-400 font-mono border-t border-gray-700/50 bg-black/20 leading-relaxed italic">${thinkMatch[1].trim().replace(/\n/g, '<br>')}</div></details>`);
            
            if(typeof marked !== 'undefined') botContent.innerHTML = marked.parse(formatted);
            else botContent.innerText = formatted;

            if(window.renderMathInElement) renderMathInElement(botContent, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
            if(typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            
            botDiv.querySelector('.rounded-2xl').innerHTML += `<div class="mt-2 flex items-center gap-3 pt-2 border-t border-gray-800/50"><button onclick="speakText(this)" class="text-gray-500 hover:text-purple-400 transition-colors"><i class="fas fa-volume-up text-xs"></i></button><button onclick="copyMessageText(this)" class="text-gray-500 hover:text-purple-400 transition-colors"><i class="fas fa-copy text-xs"></i></button></div>`;
            scrollToBottom(true);

        } catch(e) {
            if(document.getElementById('loading-indicator')) document.getElementById('loading-indicator').remove();
            if (e.name !== 'AbortError') alert("Gagal terhubung.");
        } finally {
            isSending = false;
            abortController = null;
            if(sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
        }
    }

    function handleFiles(files) { if ([...selectedFiles, ...files].length > 10) { alert("Maksimal 10 file."); return; } selectedFiles = [...selectedFiles, ...files]; renderPreviews(); }
    function renderPreviews() { if(!previewContainer) return; previewContainer.innerHTML = ''; if (selectedFiles.length > 0) { previewContainer.classList.remove('hidden'); previewContainer.classList.add('flex'); } else { previewContainer.classList.add('hidden'); previewContainer.classList.remove('flex'); } selectedFiles.forEach((file, index) => { const div = document.createElement('div'); div.className = "flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 rounded px-2 py-1 border border-purple-500/20"; div.innerHTML = `<i class="fas fa-file text-xs"></i><span class="truncate max-w-[100px]">${file.name}</span><button type="button" class="hover:text-red-400 ml-1 remove-file-btn" data-index="${index}"><i class="fas fa-times"></i></button>`; previewContainer.appendChild(div); }); document.querySelectorAll('.remove-file-btn').forEach(btn => { btn.addEventListener('click', function() { removeFile(parseInt(this.dataset.index)); }); }); }
    function removeFile(index) { selectedFiles.splice(index, 1); renderPreviews(); if(fileInput) fileInput.value = ''; }
    function clearFiles() { selectedFiles = []; renderPreviews(); if(fileInput) fileInput.value = ''; }
    function scrollToBottom(force = false) { if(!chatContainer) return; const t = 150; if (force || chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= t) chatContainer.scrollTop = chatContainer.scrollHeight; }
    function initHighlight() { document.querySelectorAll('.message-bubble-container pre code').forEach(el => { if(typeof hljs !== 'undefined') hljs.highlightElement(el); }); document.querySelectorAll('.message-bubble-container .raw-message-content').forEach(raw => { const target = raw.nextElementSibling; if(target && target.classList.contains('markdown-body')) { if(typeof marked !== 'undefined') target.innerHTML = marked.parse(raw.value); if(window.renderMathInElement) renderMathInElement(target, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false }); } }); }
    async function refreshChat() { if(isChatLoading) return; const icon = document.getElementById('refresh-icon'); if(icon) icon.classList.add('animate-spin'); if(SERVER_DATA.currentConversationId.length > 20) await loadChat(SERVER_DATA.currentConversationId); else window.location.reload(); if(icon) setTimeout(() => icon.classList.remove('animate-spin'), 800); }
});