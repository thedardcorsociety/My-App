/* global marked, hljs, SERVER_DATA */
document.addEventListener('DOMContentLoaded', () => {

    let currentConversationId = window.SERVER_DATA.currentConversationId;
    let currentToolType = window.SERVER_DATA.toolType;
    let targetChatId = null;
    let isSending = false;
    let abortController = null;
    let isChatLoading = false;
    let selectedFiles = [];

    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const toolsMenu = document.getElementById('tools-menu');
    const toolsChevron = document.getElementById('tools-chevron');
    const fileInput = document.getElementById('file-upload');
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.getElementById('file-preview-container');
    const sendBtn = document.getElementById('send-btn');
    const sendIcon = document.getElementById('send-icon');

    const markedRenderer = new marked.Renderer();
    markedRenderer.code = function(code, language) {
        let validCode = (typeof code === 'string' ? code : code.text);
        let lang = (language || '').toLowerCase().trim();
        
        if (!lang && (validCode.startsWith('graph ') || validCode.startsWith('flowchart ') || validCode.startsWith('sequenceDiagram') || validCode.startsWith('classDiagram') || validCode.startsWith('gantt'))) {
            lang = 'mermaid';
        }
        if (!lang && (validCode.includes('<!DOCTYPE html>') || validCode.includes('<html'))) {
            lang = 'html';
        }

        let highlighted = validCode;
        if (lang && hljs.getLanguage(lang) && lang !== 'mermaid') { 
            try { highlighted = hljs.highlight(validCode, { language: lang }).value; } catch (e) {} 
        } else { 
            highlighted = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
        }
        
        let btnHtml = '';
        if(['html','xml','ejs','php'].includes(lang)) {
            btnHtml = `<button onclick="previewCode(this)" class="cmd-btn btn-preview"><i class="fas fa-play text-[9px]"></i> Preview App</button>`;
        } else if (lang === 'mermaid') {
            btnHtml = `<button onclick="previewDiagram(this)" class="cmd-btn btn-diagram" style="background-color: #7c3aed; color: white;"><i class="fas fa-project-diagram text-[9px]"></i> Preview Diagram</button>`;
        }

        return `
        <div class="terminal-container">
            <div class="terminal-head">
                <div class="terminal-label">
                    <i class="fas fa-code mr-1"></i> ${lang.toUpperCase() || 'TEXT'}
                </div>
                <div class="terminal-opts">
                    ${btnHtml}
                    <button onclick="copyCode(this)" class="cmd-btn btn-cp"><i class="fas fa-copy"></i> Copy</button>
                </div>
            </div>
            <div class="terminal-code">
                <pre><code class="hljs ${lang}">${highlighted}</code></pre>
                <textarea class="hidden raw-code">${validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
            </div>
        </div>`;
    };
    marked.setOptions({ renderer: markedRenderer });

    function initHighlight(scope = document) {
        scope.querySelectorAll('.message-bubble-container pre code').forEach(el => hljs.highlightElement(el));
        scope.querySelectorAll('.message-bubble-container .raw-message-content').forEach(raw => {
            const target = raw.nextElementSibling;
            if(target && target.classList.contains('markdown-body')) {
                target.innerHTML = marked.parse(raw.value);
            }
        });
    }

    initHighlight();
    scrollToBottom();

    if(document.getElementById('sidebar-toggle-btn')) { document.getElementById('sidebar-toggle-btn').addEventListener('click', toggleSidebar); }
    if(document.getElementById('close-sidebar-btn')) { document.getElementById('close-sidebar-btn').addEventListener('click', toggleSidebar); }
    if(document.getElementById('mobile-overlay')) { document.getElementById('mobile-overlay').addEventListener('click', toggleSidebar); }

    if(document.getElementById('model-dropdown-btn')) {
        document.getElementById('model-dropdown-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if(toolsMenu) toolsMenu.classList.toggle('hidden');
            if(toolsChevron) toolsChevron.classList.toggle('rotate-180');
        });
    }

    document.querySelectorAll('.model-select-btn').forEach(btn => {
        btn.addEventListener('click', () => setModel(btn.dataset.model));
    });

    if(document.getElementById('refresh-chat-btn')) { document.getElementById('refresh-chat-btn').addEventListener('click', refreshChat); }
    if(document.getElementById('new-chat-btn')) { document.getElementById('new-chat-btn').addEventListener('click', createNewChat); }
    const newChatIndicator = document.getElementById('current-new-chat-item');
    if(newChatIndicator) newChatIndicator.addEventListener('click', createNewChat);

    document.addEventListener('click', (e) => {
        const btn = document.getElementById('model-dropdown-btn');
        if (toolsMenu && btn && !toolsMenu.contains(e.target) && !btn.contains(e.target)) {
            toolsMenu.classList.add('hidden');
            if(toolsChevron) toolsChevron.classList.remove('rotate-180');
        }
        document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
    });

    if(messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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
    
    if(dropZone) {
        ['dragenter', 'dragover'].forEach(evt => document.body.addEventListener(evt, () => { dropZone.classList.remove('hidden'); dropZone.classList.add('flex'); }));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => { dropZone.classList.add('hidden'); dropZone.classList.remove('flex'); }));
        document.body.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
    }

    function toggleSidebar() {
        document.body.classList.toggle('sidebar-closed');
        const isClosed = document.body.classList.contains('sidebar-closed');
        localStorage.setItem('dardcor_sidebar_state', isClosed ? 'closed' : 'open');
        if (window.innerWidth < 1024) {
            const overlay = document.getElementById('mobile-overlay');
            if(overlay) overlay.classList.toggle('hidden');
            const sidebar = document.getElementById('sidebar');
            if(sidebar) {
                 if(isClosed) sidebar.classList.add('-translate-x-full');
                 else sidebar.classList.remove('-translate-x-full');
            }
        }
    }

    function setModel(type) {
        currentToolType = type;
        const label = document.getElementById('tool-label');
        if(label) label.innerText = type === 'dark' ? 'Dark Model' : 'Basic Model';
        if(toolsMenu) toolsMenu.classList.add('hidden');
        if(toolsChevron) toolsChevron.classList.remove('rotate-180');
        if(type === 'dark') {
            if(messageInput) messageInput.placeholder = "Mode Tanpa Batas...";
        } else {
            if(messageInput) messageInput.placeholder = "Ketik pesan, paste link, atau upload file...";
        }
    }

    async function refreshChat() {
        if(isChatLoading) return;
        const icon = document.getElementById('refresh-icon');
        if(icon) icon.classList.add('animate-spin');
        if(currentConversationId && currentConversationId.length > 20) {
            await loadChat(currentConversationId);
        } else {
            window.location.reload();
        }
        if(icon) setTimeout(() => { icon.classList.remove('animate-spin'); }, 800);
    }

    window.loadChat = async function(id) {
        if(isChatLoading) return;
        isChatLoading = true;
        try {
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
            } else if (newItem && id.length > 20) {
                newItem.classList.add('bg-[#202336]', 'border-purple-500');
                newItem.classList.remove('border-transparent');
            }
            const res = await fetch(`/api/chat/${id}`);
            const data = await res.json();
            if (data.success) {
                currentConversationId = id;
                messageList.innerHTML = '';
                if (data.history.length === 0) {
                    messageList.innerHTML = `<div id="empty-state" class="flex flex-col items-center justify-center text-gray-500 opacity-60 min-h-[50vh]"><div class="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 overflow-hidden border border-gray-700 shadow-xl bg-black"><img src="/logo.png" class="w-full h-full object-cover"></div><p class="text-lg font-medium text-gray-400 text-center">Apa yang bisa saya bantu?</p></div>`;
                } else {
                    data.history.forEach(msg => {
                        const div = document.createElement('div');
                        div.className = `flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-bubble-container`;
                        let fileHtml = '';
                        if(msg.file_metadata) {
                            msg.file_metadata.forEach(f => {
                                fileHtml += `<div class="mb-2 text-xs flex gap-2 bg-black/20 p-2 rounded border border-white/10"><i class="fas fa-file"></i> <span>${f.filename}</span></div>`;
                            });
                        }
                        if (msg.role === 'user') {
                            div.innerHTML = `<div class="flex flex-col items-end message-bubble w-full max-w-[95%]"><div class="flex items-center gap-2 mb-1 px-1"><span class="text-[10px] uppercase tracking-wide text-gray-500 font-bold">You</span></div><div class="rounded-2xl p-4 shadow-lg text-sm bg-violet-600 text-white rounded-br-none rounded-bl-2xl border-none w-fit">${fileHtml}<div class="whitespace-pre-wrap">${escapeHtml(msg.message)}</div></div><div class="flex gap-3 mt-1 self-end pr-1 opacity-60 hover:opacity-100 transition-opacity"><button onclick="copyUserText(this, decodeURIComponent('${encodeURIComponent(msg.message)}'))" class="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1"><i class="fas fa-copy"></i> Salin</button><button onclick="editMessage(decodeURIComponent('${encodeURIComponent(msg.message)}'))" class="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1"><i class="fas fa-pen"></i> Edit</button></div></div>`;
                        } else {
                            div.innerHTML = `<div class="flex flex-col items-start message-bubble w-full max-w-[95%]"><div class="flex items-center gap-2 mb-1 px-1"><span class="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Dardcor AI</span></div><div class="rounded-2xl p-4 shadow-lg text-sm bg-[#13131f] text-gray-200 rounded-bl-none border border-gray-800 w-full overflow-hidden">${fileHtml}<div class="markdown-body">${marked.parse(msg.message)}</div><div class="mt-2 flex items-center gap-3 pt-2 border-t border-gray-800/50"><button onclick="speakText(this)" class="text-gray-500 hover:text-purple-400 transition-colors"><i class="fas fa-volume-up text-xs"></i></button><button onclick="copyMessageText(this)" class="text-gray-500 hover:text-purple-400 transition-colors"><i class="fas fa-copy text-xs"></i></button></div></div></div>`;
                        }
                        messageList.appendChild(div);
                    });
                }
                const loader = document.createElement('div');
                loader.id = 'loading-indicator';
                loader.className = 'hidden flex w-full justify-start mb-6';
                loader.innerHTML = `<div class="flex items-center gap-3 bg-[#13131f] px-4 py-3 rounded-2xl rounded-bl-none border border-gray-800 shadow-md"><div class="loader"></div><span class="text-xs text-gray-400 font-medium animate-pulse">Sedang berpikir...</span></div>`;
                messageList.appendChild(loader);
                window.history.pushState({id: id}, '', `/dardcorchat/dardcor-ai/${id}`);
                scrollToBottom();
            }
        } catch (error) { console.error(error); } 
        finally { isChatLoading = false; }
    };

    async function sendMessage() {
        if(isSending) {
            if(abortController) { abortController.abort(); abortController = null; isSending = false; if(sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); const li = document.getElementById('loading-indicator'); if(li) li.classList.add('hidden'); }
            return;
        }
        const msg = messageInput.value.trim();
        if(!msg && selectedFiles.length === 0) return;
        
        isSending = true;
        abortController = new AbortController();
        if(sendIcon) sendIcon.classList.replace('fa-paper-plane', 'fa-stop');
        messageInput.blur(); messageInput.value = ''; messageInput.style.height = 'auto';
        const emptyState = document.getElementById('empty-state');
        if(emptyState) emptyState.remove();
        
        const userDiv = document.createElement('div');
        userDiv.className = "flex w-full justify-end mb-6 message-bubble-container";
        let fileHtml = '';
        if(selectedFiles.length > 0) fileHtml = `<div class="mb-2 text-xs flex gap-2 bg-black/20 p-2 rounded border border-white/10"><i class="fas fa-file"></i> ${selectedFiles.length} File</div>`;
        userDiv.innerHTML = `<div class="flex flex-col items-end message-bubble w-full max-w-[95%]"><div class="flex items-center gap-2 mb-1 px-1"><span class="text-[10px] uppercase tracking-wide text-gray-500 font-bold">You</span></div><div class="rounded-2xl p-4 shadow-lg text-sm bg-violet-600 text-white rounded-br-none rounded-bl-2xl border-none w-fit">${fileHtml}<div class="whitespace-pre-wrap">${escapeHtml(msg)}</div></div><div class="flex gap-3 mt-1 self-end pr-1 opacity-60 hover:opacity-100 transition-opacity"><button onclick="copyUserText(this, decodeURIComponent('${encodeURIComponent(msg)}'))" class="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1"><i class="fas fa-copy"></i> Salin</button><button onclick="editMessage(decodeURIComponent('${encodeURIComponent(msg)}'))" class="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1"><i class="fas fa-pen"></i> Edit</button></div></div>`;
        
        const loadingIndicator = document.getElementById('loading-indicator');
        if(loadingIndicator) {
            messageList.insertBefore(userDiv, loadingIndicator);
            loadingIndicator.classList.remove('hidden');
        } else {
            messageList.appendChild(userDiv);
        }
        scrollToBottom();

        const fd = new FormData();
        fd.append('message', msg);
        fd.append('conversationId', currentConversationId); 
        fd.append('toolType', currentToolType);
        selectedFiles.forEach(f => fd.append('file_attachment', f));
        clearFiles(); 

        try {
            const response = await fetch('/dardcorchat/ai/chat-stream', { method: 'POST', body: fd, signal: abortController.signal });
            const botDiv = document.createElement('div');
            botDiv.className = "flex w-full justify-start mb-6 message-bubble-container";
            botDiv.innerHTML = `<div class="flex flex-col items-start message-bubble w-full max-w-[95%]"><div class="flex items-center gap-2 mb-1 px-1"><span class="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Dardcor AI</span></div><div class="rounded-2xl p-4 shadow-lg text-sm bg-[#13131f] text-gray-200 rounded-bl-none border border-gray-800 w-full overflow-hidden"><div class="markdown-body"></div></div></div>`;
            
            const currentLoader = document.getElementById('loading-indicator');
            if(currentLoader) {
                messageList.insertBefore(botDiv, currentLoader);
                currentLoader.classList.add('hidden');
            } else {
                messageList.appendChild(botDiv);
            }

            const botContent = botDiv.querySelector('.markdown-body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let isStreaming = true;

            const render = () => { if(!isStreaming) return; botContent.innerHTML = marked.parse(fullText); scrollToBottom(); requestAnimationFrame(render); };
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
            botContent.innerHTML = marked.parse(fullText);
            
            const btnDiv = document.createElement('div');
            btnDiv.className = "mt-2 flex items-center gap-3 pt-2 border-t border-gray-800/50";
            btnDiv.innerHTML = `<button onclick="speakText(this)" class="text-gray-500 hover:text-purple-400 transition-colors"><i class="fas fa-volume-up text-xs"></i></button><button onclick="copyMessageText(this)" class="text-gray-500 hover:text-purple-400 transition-colors"><i class="fas fa-copy text-xs"></i></button>`;
            botDiv.querySelector('.rounded-2xl').appendChild(btnDiv);
            scrollToBottom();

        } catch(e) {
            const currentLoader = document.getElementById('loading-indicator');
            if(currentLoader) currentLoader.classList.add('hidden');
            if (e.name !== 'AbortError') alert("Gagal terhubung.");
        } finally {
            isSending = false;
            abortController = null;
            if(sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
        }
    }

    function handleFiles(files) {
        if ([...selectedFiles, ...files].length > 10) { alert("Maksimal 10 file sekaligus."); return; }
        selectedFiles = [...selectedFiles, ...files];
        renderPreviews();
    }

    function renderPreviews() {
        if(!previewContainer) return;
        previewContainer.innerHTML = '';
        if (selectedFiles.length > 0) { previewContainer.classList.remove('hidden'); previewContainer.classList.add('flex'); } 
        else { previewContainer.classList.add('hidden'); previewContainer.classList.remove('flex'); }

        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = "flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 rounded px-2 py-1 border border-purple-500/20";
            div.innerHTML = `<i class="fas fa-file text-xs"></i><span class="truncate max-w-[100px]">${file.name}</span><button type="button" class="hover:text-red-400 ml-1 remove-file-btn" data-index="${index}"><i class="fas fa-times"></i></button>`;
            previewContainer.appendChild(div);
        });
        
        document.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', function() { removeFile(parseInt(this.dataset.index)); });
        });
    }

    function removeFile(index) { selectedFiles.splice(index, 1); renderPreviews(); if(fileInput) fileInput.value = ''; }
    function clearFiles() { selectedFiles = []; renderPreviews(); if(fileInput) fileInput.value = ''; }

    window.toggleMenu = function(e, id) { e.stopPropagation(); document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden')); document.getElementById(id).classList.toggle('hidden'); };
    window.openDeleteModal = function(id) { targetChatId = id; document.getElementById('delete-modal').classList.remove('hidden'); document.getElementById('delete-modal').classList.add('flex'); };
    window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); };
    
    window.submitDelete = async function() { 
        closeModal('delete-modal');
        await fetch('/dardcorchat/ai/delete-chat-history', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({conversationId:targetChatId})});
        const elem = document.getElementById(`chat-item-${targetChatId}`);
        if(elem) elem.remove();
        if(targetChatId === currentConversationId) createNewChat();
    };

    window.openRenameModal = function(id) { 
        targetChatId = id; 
        document.getElementById('rename-input').value = document.getElementById(`raw-title-${id}`).value;
        document.getElementById('rename-modal').classList.remove('hidden'); 
        document.getElementById('rename-modal').classList.add('flex'); 
    };

    window.submitRename = async function() { 
        const newName = document.getElementById('rename-input').value; closeModal('rename-modal'); if(!newName.trim()) return;
        const res = await fetch('/dardcorchat/ai/rename-chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ conversationId: targetChatId, newTitle: newName }) });
        if(res.ok) { document.getElementById(`title-${targetChatId}`).innerText = newName.substring(0, 22) + '...'; document.getElementById(`raw-title-${targetChatId}`).value = newName; }
    };

    window.editMessage = function(text) { if(messageInput){ messageInput.value = text; messageInput.focus(); } };
    window.copyUserText = function(btn, text) { navigator.clipboard.writeText(text).then(() => { const orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i> Disalin'; setTimeout(() => btn.innerHTML = orig, 2000); }); };
    window.copyMessageText = function(btn) { const txt = btn.closest('.message-bubble').querySelector('.markdown-body').innerText; navigator.clipboard.writeText(txt).then(() => { const icon = btn.querySelector('i'); icon.className = 'fas fa-check text-xs text-green-400'; setTimeout(() => icon.className = 'fas fa-copy text-xs', 2000); }); };
    window.speakText = function(btn) { 
        const txt = btn.closest('.message-bubble').querySelector('.markdown-body').innerText;
        if ('speechSynthesis' in window) {
            if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            else { const u = new SpeechSynthesisUtterance(txt); u.lang = 'id-ID'; window.speechSynthesis.speak(u); }
        } else alert("TTS Error"); 
    };
    
    // --- FUNGSI PREVIEW YANG DIPERBAIKI (SANITASI) ---
    window.previewCode = async function(btn) {
        const rawCode = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode }) }); const data = await res.json(); if(data.success) window.open(`/dardcorchat/dardcor-ai/preview/${data.previewId}`, '_blank'); } catch(e) { alert('Preview Error'); } finally { btn.innerHTML = original; btn.disabled = false; }
    };

    window.previewDiagram = async function(btn) {
        let rawCode = btn.closest('.terminal-container').querySelector('.raw-code').value;
        // Sanitasi: Hapus sisa markdown (backticks) dan unescape HTML entities
        rawCode = rawCode.replace(/```mermaid/g, '').replace(/```/g, '').trim();
        rawCode = rawCode.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

        const original = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { 
            const res = await fetch('/dardcorchat/ai/store-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode, type: 'diagram' }) }); 
            const data = await res.json(); 
            if(data.success) window.open(`/dardcorchat/dardcor-ai/diagram/${data.previewId}`, '_blank'); 
            else alert('Gagal menyimpan diagram.');
        } catch(e) { alert('Diagram Preview Error'); } finally { btn.innerHTML = original; btn.disabled = false; }
    };

    window.copyCode = function(btn) {
        const code = btn.closest('.terminal-container').querySelector('.raw-code').value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        navigator.clipboard.writeText(code).then(() => { const origin = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => btn.innerHTML = origin, 2000); });
    };

    async function createNewChat() {
        try { const res = await fetch('/dardcorchat/ai/new-chat', { method: 'POST' }); const data = await res.json(); if(data.success) { const newId = data.redirectUrl.split('/').pop(); loadChat(newId); } } catch(e) {}
    }

    function scrollToBottom() { if(chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight; }
    function escapeHtml(unsafe) { return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
});