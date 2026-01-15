document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        .terminal-code { overflow-x: auto; scrollbar-width: thin; scrollbar-color: #4b5563 transparent; }
        .terminal-code::-webkit-scrollbar { height: 2px !important; width: 2px !important; background: transparent !important; display: block !important; }
        .terminal-code::-webkit-scrollbar-track { background: transparent !important; }
        .terminal-code::-webkit-scrollbar-thumb { background-color: #4b5563 !important; border-radius: 2px !important; }
        .hljs { color: #e2e8f0 !important; background: transparent !important; }
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag { color: #a855f7 !important; font-weight: bold; text-shadow: 0 0 5px rgba(168, 85, 247, 0.3); }
        .hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal, .hljs-template-tag, .hljs-template-variable, .hljs-type, .hljs-addition { color: #22c55e !important; }
        .hljs-comment, .hljs-quote, .hljs-deletion, .hljs-meta { color: #3b82f6 !important; font-style: italic; }
        .hljs-number, .hljs-regexp, .hljs-symbol, .hljs-bullet, .hljs-link { color: #eab308 !important; }
        .hljs-function, .hljs-title.function_ { color: #3b82f6 !important; }
        .hljs-variable { color: #eab308 !important; }
        
        details.unified-header { width: fit-content; margin-bottom: 6px; display: block; border: none !important; background: transparent !important; outline: none !important; box-shadow: none !important; }
        details.unified-header > summary { list-style: none; display: flex; align-items: center; width: fit-content; outline: none !important; cursor: pointer; border: none !important; background: transparent !important; padding: 0; margin: 0; }
        details.unified-header > summary::-webkit-details-marker { display: none; }

        .header-content-wrapper { display: flex; align-items: center; gap: 10px; padding: 4px 0; opacity: 0.95; transition: opacity 0.2s; user-select: none; white-space: nowrap; background: transparent !important; border: none !important; box-shadow: none !important; }
        .header-content-wrapper:hover { opacity: 1; }
        .header-content-wrapper.static-mode { cursor: default; }
        
        .logo-stack { position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .main-logo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; position: relative; z-index: 2; box-shadow: 0 0 10px rgba(168, 85, 247, 0.4); }
        .spinner-ring { position: absolute; inset: -3px; border: 2px solid transparent; border-top-color: #a855f7; border-right-color: #a855f7; border-radius: 50%; animation: spin 1s linear infinite; z-index: 1; opacity: 0; transition: opacity 0.3s; }
        .spinner-ring.active { opacity: 1; }
        
        .bot-name-display { font-size: 13px; font-weight: 700; color: #e9d5ff; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(168, 85, 247, 0.3); }
        .toggle-chevron { font-size: 10px; color: #a78bfa; transition: transform 0.3s ease; opacity: 0.8; margin-left: 2px; flex-shrink: 0; display: inline-block; }
        details[open] .toggle-chevron { transform: rotate(180deg); }
        
        .think-content-box { margin-top: 6px; margin-bottom: 12px; margin-left: 8px; padding: 10px 14px; background: rgba(15, 15, 20, 0.5); border-left: 2px solid #a855f7; border-radius: 0 6px 6px 0; font-family: 'Consolas', monospace; font-size: 11px; line-height: 1.6; color: #cbd5e1; width: 100%; max-width: 95%; overflow-x: hidden; white-space: pre-wrap; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes orbit-1 { 0% { transform: rotate3d(1, 1, 1, 0deg); } 100% { transform: rotate3d(1, 1, 1, 360deg); } }
        @keyframes orbit-2 { 0% { transform: rotate3d(1, -1, 1, 0deg); } 100% { transform: rotate3d(1, -1, 1, 360deg); } }
        @keyframes orbit-3 { 0% { transform: rotate3d(-1, 1, 1, 0deg); } 100% { transform: rotate3d(-1, 1, 1, 360deg); } }
        @keyframes orbit-4 { 0% { transform: rotate3d(1, 1, -1, 0deg); } 100% { transform: rotate3d(1, 1, -1, 360deg); } }
        @keyframes orbit-5 { 0% { transform: rotate3d(0, 1, 1, 0deg); } 100% { transform: rotate3d(0, 1, 1, 360deg); } }
        @keyframes orbit-6 { 0% { transform: rotate3d(1, 0, 0, 0deg); } 100% { transform: rotate3d(1, 0, 0, 360deg); } }
        
        .animate-orbit-1 { animation: orbit-1 6s linear infinite; }
        .animate-orbit-2 { animation: orbit-2 7s linear infinite; }
        .animate-orbit-3 { animation: orbit-3 8s linear infinite; }
        .animate-orbit-4 { animation: orbit-4 9s linear infinite; }
        .animate-orbit-5 { animation: orbit-5 10s linear infinite; }
        .animate-orbit-6 { animation: orbit-6 11s linear infinite; }
    `;
    document.head.appendChild(style);

    const sidebarItems = document.querySelectorAll('.chat-item *, .static-new-chat-item *');
    sidebarItems.forEach(el => {
        if (window.getComputedStyle(el).pointerEvents === 'none') {
            el.style.pointerEvents = 'auto';
            el.classList.remove('pointer-events-none');
        }
    });

    const serverData = window.SERVER_DATA || {};
    let storedModel = localStorage.getItem('dardcor_selected_model');
    let currentToolType = storedModel || serverData.toolType || 'basic';
    let currentUtterance = null;
    let chatToEdit = null;
    let chatToDelete = null;
    let selectedFiles = [];
    let isSending = false;
    let abortController = null;
    let isChatLoading = false;
    let userIsScrolling = false;
    let loadingTimeout = null;
    let isDeepThinkEnabled = false;
    let isSearchEnabled = false;
    let recognition = null;

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
    const deepThinkBtn = document.getElementById('deep-think-btn');
    const searchBtn = document.getElementById('search-btn');

    function parseMessageContent(text) {
        if (!text) return { think: '', answer: '', hasDeepThink: false };
        const safeText = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
        const match = safeText.match(thinkRegex);
        if (match) {
            return { think: match[1].trim(), answer: safeText.replace(match[0], '').trim(), hasDeepThink: true };
        } else if (safeText.includes('<think>') && !safeText.includes('</think>')) {
            return { think: safeText.replace('<think>', '').trim(), answer: '', hasDeepThink: true };
        }
        return { think: '', answer: safeText, hasDeepThink: false };
    }

    function injectEditButtonsOnLoad() {
        const userBubbles = document.querySelectorAll('.message-bubble-container');
        userBubbles.forEach(container => {
            if (container.classList.contains('justify-end')) {
                let actionDiv = container.querySelector('.flex.items-center.gap-3');
                if (!actionDiv) {
                    actionDiv = document.createElement('div');
                    actionDiv.className = "flex items-center gap-3 mt-1 px-1 select-none opacity-50 group-hover:opacity-100 transition-opacity";
                    const flexCol = container.querySelector('.flex.flex-col');
                    if (flexCol) flexCol.appendChild(actionDiv);
                }
                if (actionDiv) {
                    let editBtn = actionDiv.querySelector('button[title="Edit Pesan"]');
                    let copyBtn = actionDiv.querySelector('button[title="Salin Pesan"]');
                    if (!editBtn) {
                        editBtn = document.createElement('button');
                        editBtn.onclick = function() { window.editMessage(this); };
                        editBtn.className = "text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors";
                        editBtn.title = "Edit Pesan";
                        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                    }
                    if (!copyBtn) {
                        copyBtn = document.createElement('button');
                        copyBtn.onclick = function() { window.copyMessageBubble(this); };
                        copyBtn.className = "text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors";
                        copyBtn.title = "Salin Pesan";
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Salin';
                    }
                    actionDiv.prepend(editBtn);
                    editBtn.after(copyBtn);
                }
            }
        });
    }
    
    setTimeout(injectEditButtonsOnLoad, 100);
    setTimeout(injectEditButtonsOnLoad, 500);
    setTimeout(injectEditButtonsOnLoad, 1000);

    if (typeof marked !== 'undefined') {
        const renderer = new marked.Renderer();
        renderer.code = function(code, language) {
            let validCode = (typeof code === 'string' ? code : (code.text || ''));
            let lang = (language || '').toLowerCase().trim().split(/\s+/)[0] || 'text';
            const trimmedCode = validCode.trim();
            if (['text', 'txt', 'code', ''].includes(lang)) {
                if (trimmedCode.match(/^<!DOCTYPE html/i) || trimmedCode.match(/^<html/i) || trimmedCode.match(/<\/div>/)) lang = 'html';
                else if (trimmedCode.match(/^<\?php/i) || trimmedCode.match(/\$\w+\s*=/)) lang = 'php';
                else if (trimmedCode.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i)) lang = 'mermaid';
                else if (trimmedCode.match(/^(def\s|class\s|from\s|import\s+[\w\s,]+from|print\(|if\s+__name__\s*==|elif\s|try:|except:|with\s+open)/m)) lang = 'python';
                else if (trimmedCode.match(/^(const\s|let\s|var\s|function|console\.log|=>|document\.|window\.|import\s+.*from\s+['"]|export\s)/m)) lang = 'javascript';
                else if (trimmedCode.match(/^#include/) || trimmedCode.match(/std::/)) lang = 'cpp';
                else if (trimmedCode.match(/^package main/) || trimmedCode.match(/^func main/)) lang = 'go';
                else if (trimmedCode.match(/^using System;/) || trimmedCode.match(/Console\.WriteLine/)) lang = 'csharp';
                else if (trimmedCode.match(/^public class/) || trimmedCode.match(/System\.out\.println/)) lang = 'java';
                else if (trimmedCode.match(/^(@import|body|div|span|\.[\w-]+|#[\w-]+)\s*\{/)) lang = 'css';
                else if (trimmedCode.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER).*FROM/i)) lang = 'sql';
                else if (trimmedCode.match(/^\{[\s\S]*"[^"]+":/)) lang = 'json';
                else if (trimmedCode.match(/^#!/)) lang = 'bash';
            }
            let btnHtml = '';
            if (['html', 'xml', 'ejs', 'php', 'svg'].includes(lang)) {
                btnHtml = `<button onclick="window.previewCode(this)" class="cmd-btn btn-preview" style="font-size: 10px; padding: 2px 8px; background-color: #2e1065; color: white;"><i class="fas fa-play"></i> Preview</button>`;
            } else if (lang === 'mermaid') {
                btnHtml = `<button onclick="window.previewDiagram(this)" class="cmd-btn btn-diagram" style="font-size: 10px; padding: 2px 8px; background-color: #2e1065; color: white;"><i class="fas fa-project-diagram"></i> Preview Diagram</button>`;
            }
            const escapedCode = validCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<div class="terminal-container" style="background-color: #000000 !important; border: 1px solid #333; margin: 10px 0; max-width: 100%;">
                        <div class="terminal-head" style="height: 32px; padding: 0 12px; background-color: #000000 !important; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #333;">
                            <div class="text-[10px] font-bold text-gray-400 uppercase flex items-center"><i class="fas fa-code mr-2"></i> ${lang}</div>
                            <div class="terminal-actions flex gap-2">
                                ${btnHtml}
                                <button onclick="window.copyCode(this)" class="cmd-btn btn-copy" style="font-size: 10px; padding: 2px 8px; background-color: #21262d; color: #c9d1d9;" title="Salin Kode"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>
                        <div class="terminal-code" style="background-color: #000000 !important;">
                            <pre style="background: transparent !important; margin: 0;"><code class="hljs ${lang}" style="background: transparent !important; font-family: 'Consolas', monospace; font-size: 12px; color: #e6edf3;">${escapedCode}</code></pre>
                            <textarea class="hidden raw-code">${escapedCode}</textarea>
                        </div>
                    </div>`;
        };
        renderer.link = function(href, title, text) {
            let u, t;
            if (typeof href === 'object' && href !== null) { u = href.href || ''; t = href.text || u; } else { u = href || ''; t = text || u; }
            u = String(u).trim(); t = String(t).trim();
            if (u.includes('[object Object]')) u = '';
            if (t.includes('[object Object]')) t = u;
            if (!u && t.match(/^https?:\/\//)) u = t;
            if (!t && u) t = u;
            if (!u) u = '#';
            return `<a href="${u}" target="_blank" class="text-purple-500 hover:text-purple-300 hover:underline font-bold transition-colors break-all" title="${title || ''}">${t}</a>`;
        };
        marked.setOptions({ renderer: renderer, gfm: true, breaks: true, sanitize: false });
    }

    function resetChatState() {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        isChatLoading = false;
        if (isSending && abortController) {
            abortController.abort();
            isSending = false;
            abortController = null;
            if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
            const indicator = document.getElementById('loading-indicator');
            if (indicator) indicator.remove();
        }
        selectedFiles = [];
        updateFilePreviews();
        if (messageInput) { messageInput.value = ''; messageInput.style.height = 'auto'; }
    }

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
        if (messageInput) messageInput.placeholder = `Ask Dardcor ${type === 'basic' ? 'Basic' : (type === 'dark' ? 'Dark' : 'Pro')}...`;
        currentToolType = type;
    }
    updateModelUI(currentToolType);

    function getFileIconClass(mimetype, filename) {
        if (!mimetype) mimetype = "";
        if (!filename) filename = "";
        mimetype = mimetype.toLowerCase();
        filename = filename.toLowerCase();
        if (mimetype.includes('pdf')) return 'fa-file-pdf text-red-400';
        if (mimetype.includes('word') || mimetype.includes('document') || filename.endsWith('.docx') || filename.endsWith('.doc')) return 'fa-file-word text-blue-400';
        if (mimetype.includes('excel') || mimetype.includes('sheet') || mimetype.includes('csv') || filename.endsWith('.xlsx') || filename.endsWith('.xls')) return 'fa-file-excel text-green-400';
        if (mimetype.includes('presentation') || mimetype.includes('powerpoint') || mimetype.includes('ppt') || filename.endsWith('.pptx') || filename.endsWith('.ppt')) return 'fa-file-powerpoint text-orange-400';
        if (mimetype.includes('zip') || mimetype.includes('compressed') || mimetype.includes('tar') || mimetype.includes('rar') || mimetype.includes('7z')) return 'fa-file-archive text-yellow-500';
        if (mimetype.includes('code') || mimetype.includes('javascript') || mimetype.includes('json') || filename.match(/\.(js|jsx|ts|tsx|html|css|py|php|java|cpp|c|h|json|xml|sql|ejs|rb|go|rs|swift|kt|sh|bat|pl|yml|yaml|ini|env|md)$/i)) return 'fa-file-code text-purple-400';
        if (mimetype.includes('video')) return 'fa-file-video text-pink-400';
        if (mimetype.includes('audio')) return 'fa-file-audio text-purple-400';
        if (mimetype.includes('text') || filename.endsWith('.txt')) return 'fa-file-alt text-gray-300';
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
            div.className = "relative group w-16 h-16 rounded-lg overflow-hidden border border-purple-900/40 bg-[#0e0e14]";
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.className = "w-full h-full object-cover";
                div.appendChild(img);
            } else {
                const iconClass = getFileIconClass(file.type, file.name);
                div.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center p-1 text-center"><i class="fas ${iconClass} text-xl mb-1"></i><span class="text-[8px] text-gray-400 truncate w-full">${file.name.slice(-6)}</span></div>`;
            }
            const removeBtn = document.createElement('button');
            removeBtn.className = "absolute top-0 right-0 bg-red-600/90 text-white w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md z-10 cursor-pointer";
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.onclick = (e) => { e.stopPropagation(); selectedFiles.splice(index, 1); updateFilePreviews(); };
            div.appendChild(removeBtn);
            filePreviewContainer.appendChild(div);
        });
    }

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        const toAdd = Array.from(files).slice(0, 10 - selectedFiles.length);
        toAdd.forEach(file => { if (file.size <= 50 * 1024 * 1024) selectedFiles.push(file); });
        updateFilePreviews();
    }

    if (fileUploadBtn && fileInput) {
        fileUploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); fileInput.value = ''; });
    }
    if (messageInput) {
        messageInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            const files = [];
            for (let i = 0; i < items.length; i++) if (items[i].kind === 'file') files.push(items[i].getAsFile());
            if (files.length > 0) { e.preventDefault(); handleFiles(files); }
        });
    }

    window.addEventListener('dragover', (e) => { e.preventDefault(); if (dropZone) { dropZone.classList.remove('hidden'); dropZone.classList.add('flex'); } });
    window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null || e.relatedTarget === document.documentElement) { if (dropZone) { dropZone.classList.add('hidden'); dropZone.classList.remove('flex'); } } });
    window.addEventListener('drop', (e) => { e.preventDefault(); if (dropZone) { dropZone.classList.add('hidden'); dropZone.classList.remove('flex'); } handleFiles(e.dataTransfer.files); });

    if (deepThinkBtn) {
        deepThinkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isDeepThinkEnabled = !isDeepThinkEnabled;
            if (isDeepThinkEnabled) {
                deepThinkBtn.classList.remove('bg-purple-900/10', 'text-purple-400', 'border-purple-800/30');
                deepThinkBtn.classList.add('bg-purple-600', 'text-white', 'border-purple-400', 'shadow-[0_0_15px_rgba(147,51,234,0.5)]');
                window.showNavbarAlert('Deep Think Diaktifkan', 'success');
            } else {
                deepThinkBtn.classList.add('bg-purple-900/10', 'text-purple-400', 'border-purple-800/30');
                deepThinkBtn.classList.remove('bg-purple-600', 'text-white', 'border-purple-400', 'shadow-[0_0_15px_rgba(147,51,234,0.5)]');
                window.showNavbarAlert('Deep Think Dinonaktifkan', 'info');
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isSearchEnabled = !isSearchEnabled;
            if (isSearchEnabled) {
                searchBtn.classList.remove('bg-purple-900/10', 'text-purple-400', 'border-purple-800/30');
                searchBtn.classList.add('bg-purple-600', 'text-white', 'border-purple-400', 'shadow-[0_0_15px_rgba(147,51,234,0.5)]');
                window.showNavbarAlert('Web Search Diaktifkan', 'success');
            } else {
                searchBtn.classList.add('bg-purple-900/10', 'text-purple-400', 'border-purple-800/30');
                searchBtn.classList.remove('bg-purple-600', 'text-white', 'border-purple-400', 'shadow-[0_0_15px_rgba(147,51,234,0.5)]');
                window.showNavbarAlert('Web Search Dinonaktifkan', 'info');
            }
        });
    }

    if (micBtn) {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'id-ID';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (messageInput) {
                    messageInput.value += (messageInput.value ? ' ' : '') + transcript;
                    messageInput.style.height = 'auto';
                    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
                }
                micBtn.classList.remove('text-red-500', 'animate-pulse');
                micBtn.classList.add('text-purple-500/40');
            };
            recognition.onerror = () => {
                micBtn.classList.remove('text-red-500', 'animate-pulse');
                micBtn.classList.add('text-purple-500/40');
                window.showNavbarAlert('Gagal mengenali suara', 'error');
            };
            recognition.onend = () => {
                micBtn.classList.remove('text-red-500', 'animate-pulse');
                micBtn.classList.add('text-purple-500/40');
            };
            micBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (micBtn.classList.contains('text-red-500')) {
                    recognition.stop();
                } else {
                    recognition.start();
                    micBtn.classList.remove('text-purple-500/40');
                    micBtn.classList.add('text-red-500', 'animate-pulse');
                }
            });
        } else {
            micBtn.style.display = 'none';
        }
    }

    if (modelBtn) {
        modelBtn.addEventListener('click', (e) => { 
            e.preventDefault(); e.stopPropagation(); 
            if (toolsMenu) toolsMenu.classList.toggle('hidden'); 
            if (toolsChevron) toolsChevron.classList.toggle('rotate-180'); 
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => { 
            if (e.isComposing || e.keyCode === 229) return; 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); e.stopPropagation(); sendMessage(); 
            } 
        });
        messageInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });
    }
    
    if (sendBtn) sendBtn.addEventListener('click', (e) => { e.preventDefault(); sendMessage(); });
    
    document.addEventListener('click', (e) => {
        if (modelBtn && toolsMenu && !modelBtn.contains(e.target) && !toolsMenu.contains(e.target)) {
            if (!toolsMenu.classList.contains('hidden')) { toolsMenu.classList.add('hidden'); if (toolsChevron) toolsChevron.classList.remove('rotate-180'); }
        }
        if (!e.target.closest('.options-btn')) { document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden')); }
    });

    document.querySelectorAll('.model-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const modelType = btn.getAttribute('data-model');
            if (modelType) window.setModel(modelType);
        });
    });

    if (chatContainer) {
        chatContainer.addEventListener('scroll', () => {
            const threshold = 150;
            const position = chatContainer.scrollTop + chatContainer.clientHeight;
            const height = chatContainer.scrollHeight;
            userIsScrolling = (height - position > threshold);
        });
    }

    window.showNavbarAlert = function(message, type = 'info') {
        const alertBox = document.getElementById('navbar-alert');
        const alertText = document.getElementById('navbar-alert-text');
        const alertIcon = document.getElementById('navbar-alert-icon');
        if (alertBox && alertText && alertIcon) {
            alertText.innerText = message;
            alertBox.classList.remove('opacity-0', 'pointer-events-none', 'scale-90');
            alertBox.classList.add('opacity-100', 'scale-100');
            if (type === 'success') { alertBox.className = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-green-900/80 border border-green-500/30 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 opacity-100 transform scale-100 z-[10000]"; alertIcon.className = "fas fa-check-circle text-green-400 text-xs"; } 
            else if (type === 'error') { alertBox.className = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-red-900/80 border border-red-500/30 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 opacity-100 transform scale-100 z-[10000]"; alertIcon.className = "fas fa-exclamation-circle text-red-400 text-xs"; } 
            else { alertBox.className = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#1c1c2e] border border-purple-900/30 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 opacity-100 transform scale-100 z-[10000]"; alertIcon.className = "fas fa-info-circle text-purple-400 text-xs"; }
            setTimeout(() => { alertBox.classList.add('opacity-0', 'pointer-events-none', 'scale-90'); alertBox.classList.remove('opacity-100', 'scale-100'); }, 3000);
        }
    };

    window.setModel = function(type) {
        currentToolType = type;
        localStorage.setItem('dardcor_selected_model', type);
        updateModelUI(type);
        if (toolsMenu) toolsMenu.classList.add('hidden');
        if (toolsChevron) toolsChevron.classList.remove('rotate-180');
        window.showNavbarAlert(`Model diubah ke ${type === 'dark' ? 'Dark' : (type === 'pro' ? 'Pro' : 'Basic')}`, 'info');
    };

    window.previewCode = async function(btn) {
        const container = btn.closest('.terminal-container');
        if (!container) return;
        const codeText = container.querySelector('.raw-code')?.value;
        const hljsEl = container.querySelector('.hljs');
        const langClass = hljsEl ? Array.from(hljsEl.classList).find(c => c !== 'hljs') : 'html';
        const type = langClass || 'html';
        if (!codeText) return;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        try {
            const response = await fetch('/dardcorchat/ai/store-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeText, type: type })
            });
            const data = await response.json();
            if (data.success) {
                const overlay = document.getElementById('diagram-overlay');
                const frame = document.getElementById('diagram-frame');
                frame.src = `/dardcorchat/dardcor-ai/preview/${data.previewId}`;
                overlay.classList.remove('hidden');
            } else {
                window.showNavbarAlert('Gagal memproses preview', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Error sistem preview', 'error');
        } finally {
            btn.innerHTML = '<i class="fas fa-play"></i> Preview';
        }
    };

    window.previewDiagram = async function(btn) {
        const container = btn.closest('.terminal-container');
        if (!container) return;
        const codeText = container.querySelector('.raw-code')?.value;
        if (!codeText) return;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        try {
            const response = await fetch('/dardcorchat/ai/store-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeText, type: 'mermaid' })
            });
            const data = await response.json();
            if (data.success) {
                const overlay = document.getElementById('diagram-overlay');
                const frame = document.getElementById('diagram-frame');
                frame.src = `/dardcorchat/dardcor-ai/diagram/${data.previewId}`;
                overlay.classList.remove('hidden');
            } else {
                window.showNavbarAlert('Gagal memproses diagram', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Error sistem diagram', 'error');
        } finally {
            btn.innerHTML = '<i class="fas fa-project-diagram"></i> Preview Diagram';
        }
    };

    window.copyCode = function(btn) {
        const container = btn.closest('.terminal-container');
        if (!container) return;
        const codeText = container.querySelector('.raw-code')?.value;
        if (codeText) {
            navigator.clipboard.writeText(codeText).then(() => {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check text-green-400"></i>';
                setTimeout(() => { btn.innerHTML = original; }, 2000);
            });
        }
    };

    window.copyMessageBubble = function(btn) {
        const container = btn.closest('.message-bubble-container');
        const textDiv = container.querySelector('.markdown-body') || container.querySelector('.user-text');
        if (textDiv) {
            navigator.clipboard.writeText(textDiv.innerText).then(() => {
                const icon = btn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'fas fa-check text-green-400';
                setTimeout(() => { icon.className = originalClass; }, 2000);
            });
        }
    };

    window.editMessage = function(btn) {
        const container = btn.closest('.message-bubble-container');
        const textDiv = container.querySelector('.user-text');
        if (textDiv && messageInput) {
            messageInput.value = textDiv.innerText;
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
            messageInput.focus();
        }
    };

    window.speakMessage = function(btn) {
        const container = btn.closest('.message-bubble-container');
        const textDiv = container.querySelector('.markdown-body') || container.querySelector('.user-text');
        if (textDiv) {
            const text = textDiv.innerText;
            if (currentUtterance) { window.speechSynthesis.cancel(); currentUtterance = null; }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            window.speechSynthesis.speak(utterance);
            currentUtterance = utterance;
        }
    };

    window.updateActiveChatUI = function(id) {
        const historyItems = document.querySelectorAll('.chat-item');
        historyItems.forEach(el => {
            el.classList.remove('bg-[#202336]', 'text-white', 'border-purple-900', 'border-l-2');
            el.classList.add('text-gray-400', 'border-l-2', 'border-transparent', 'hover:bg-white/5');
            const btn = el.querySelector('.options-btn');
            if (btn) {
                btn.classList.remove('opacity-100');
                btn.classList.add('opacity-0', 'group-hover:opacity-100');
            }
        });

        const newChatStatic = document.getElementById('current-new-chat-item');
        const newChatHistory = document.getElementById('new-chat-highlight-target');

        const activeEl = document.getElementById(`chat-item-${id}`);
        const isNew = (!id || id === 'new' || !activeEl);

        if (isNew) {
            if(newChatStatic) {
                newChatStatic.classList.add('bg-[#202336]', 'text-white', 'border-purple-900');
                newChatStatic.classList.remove('text-gray-400', 'hover:bg-white/5', 'border-transparent'); 
            }

            if(newChatHistory) {
                newChatHistory.classList.add('bg-[#202336]', 'text-white', 'border-purple-900', 'border-l-2');
                newChatHistory.classList.remove('text-gray-400', 'border-transparent', 'hover:bg-white/5');
            }
        } else {
            if (newChatStatic) {
                newChatStatic.classList.remove('bg-[#202336]', 'text-white');
                newChatStatic.classList.add('text-gray-400', 'hover:bg-white/5', 'border-purple-900'); 
                newChatStatic.classList.remove('border-transparent');
            }

            if(newChatHistory) {
                newChatHistory.classList.remove('bg-[#202336]', 'text-white', 'border-purple-900');
                newChatHistory.classList.add('text-gray-400', 'border-l-2', 'border-transparent', 'hover:bg-white/5');
            }

            if (activeEl) {
                activeEl.classList.remove('text-gray-400', 'border-transparent', 'hover:bg-white/5');
                activeEl.classList.add('bg-[#202336]', 'text-white', 'border-purple-900', 'border-l-2');
                const btn = activeEl.querySelector('.options-btn');
                if (btn) {
                    btn.classList.remove('opacity-0', 'group-hover:opacity-100');
                    btn.classList.add('opacity-100');
                }
            }
        }
        document.querySelectorAll('[id^="menu-"]').forEach(el => el.classList.add('hidden'));
    };

    window.createNewChat = async function() {
        if (abortController) abortController.abort();
        resetChatState();
        try {
            const res = await fetch('/dardcorchat/ai/new-chat', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const newId = data.redirectUrl.split('/').pop();
                serverData.currentConversationId = newId;
                window.updateActiveChatUI(newId);
                window.loadChat(newId);
                window.showNavbarAlert('Percakapan baru dibuat', 'success');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Gagal membuat chat baru', 'error');
        }
    };

    window.loadChat = async function(id) {
        if (isChatLoading) resetChatState(); 
        isChatLoading = true;
        
        loadingTimeout = setTimeout(() => { isChatLoading = false; }, 5000); 

        window.closeSidebarIfMobile();
        serverData.currentConversationId = id;
        window.updateActiveChatUI(id);
        
        try {
            const res = await fetch(`/api/chat/${id}`);
            const data = await res.json();
            
            if (data.success && messageList) {
                messageList.innerHTML = '';
                
                if (!data.history || data.history.length === 0) {
                    renderEmptyState();
                } else {
                    messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 pt-4 pb-4";
                    const fragment = document.createDocumentFragment();
                    data.history.forEach(msg => {
                        const el = createMessageElementSync(msg.role, msg.message, msg.file_metadata);
                        fragment.appendChild(el);
                    });
                    messageList.appendChild(fragment);
                    
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
        } finally {
            clearTimeout(loadingTimeout);
            isChatLoading = false;
        }
    };

    function createMessageElementSync(role, text, files = []) {
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} message-bubble-container group min-w-0`;
        
        let fileHtml = '';
        if (files && files.length > 0) {
            const justify = role === 'user' ? 'justify-end' : 'justify-start';
            fileHtml = `<div class="flex flex-wrap gap-2 mb-2 ${justify} w-full">`;
            files.forEach(f => {
                const mimetype = (f.type || f.mimetype || '').toLowerCase();
                const filename = f.name || f.filename || 'Unknown File';
                if (mimetype.startsWith('image/')) {
                    const imgUrl = f instanceof File ? URL.createObjectURL(f) : (f.url || f.path);
                    if (imgUrl) fileHtml += `<div class="relative rounded-lg overflow-hidden border border-purple-900/30 shadow-lg group transition-transform hover:scale-105 bg-[#0e0e14] min-w-[100px] min-h-[100px]"><img src="${imgUrl}" class="max-w-[200px] max-h-[200px] object-cover block"></div>`;
                } else {
                    const iconClass = getFileIconClass(mimetype, filename);
                    fileHtml += `<div class="text-[10px] flex items-center gap-2 bg-[#0e0e14] px-3 py-1.5 rounded-lg border border-purple-900/30 text-gray-300 max-w-full shadow-sm cursor-default"><i class="fas ${iconClass}"></i> <span class="truncate">${filename}</span></div>`;
                }
            });
            fileHtml += `</div>`;
        }

        const bubbleClass = role === 'user' ? 'bg-transparent border border-purple-600/50 text-white rounded-br-sm shadow-[0_0_15px_rgba(147,51,234,0.15)]' : 'bg-transparent text-gray-200 rounded-bl-sm border-none';
        
        let contentHtml = '';
        if (role === 'user') {
            contentHtml = `<div class="whitespace-pre-wrap break-words user-text">${text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-purple-500 hover:text-purple-300 hover:underline break-all">$1</a>')}</div>`;
        } else {
            const parsed = parseMessageContent(text);
            let deepThinkHtml = '';
            
            if (parsed.hasDeepThink && parsed.think) {
                deepThinkHtml = `
                    <details class="unified-header group w-full max-w-full">
                        <summary>
                            <div class="header-content-wrapper">
                                <div class="logo-stack">
                                    <img src="/logo.png" class="main-logo">
                                </div>
                                <span class="bot-name-display">Dardcor AI : Show Process</span>
                                <i class="fas fa-chevron-down toggle-chevron"></i>
                            </div>
                        </summary>
                        <div class="think-content-box">
                            <div class="whitespace-pre-wrap">${parsed.think}</div>
                        </div>
                    </details>
                `;
            }

            const identityHtml = `
                <div class="unified-header" style="cursor: default;">
                    <div class="header-content-wrapper static-mode">
                        <div class="logo-stack">
                            <img src="/logo.png" class="main-logo">
                        </div>
                        <span class="bot-name-display">Dardcor AI</span>
                    </div>
                </div>
            `;

            if (deepThinkHtml) {
                contentHtml = deepThinkHtml;
            } else {
                contentHtml = identityHtml; 
            }
            
            if (parsed.answer || (!deepThinkHtml && !parsed.answer)) {
                 contentHtml += `<div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm ${bubbleClass} w-fit min-w-0 max-w-full overflow-hidden leading-7">
                    <div class="markdown-body w-full max-w-full overflow-hidden break-words">${typeof marked !== 'undefined' ? marked.parse(parsed.answer) : parsed.answer}</div>
                 </div>`;
            }
        }

        let actions = '';
        if (role === 'user') {
            actions = `<div class="flex items-center gap-3 mt-1 px-1 select-none opacity-50 group-hover:opacity-100 transition-opacity"><button onclick="window.editMessage(this)" class="text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors" title="Edit Pesan"><i class="fas fa-edit"></i> Edit</button><button onclick="window.copyMessageBubble(this)" class="text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors" title="Salin Pesan"><i class="fas fa-copy"></i> Salin</button></div>`;
        } else {
            actions = `<div class="flex items-center gap-3 mt-1 px-1 select-none opacity-50 group-hover:opacity-100 transition-opacity"><button onclick="window.copyMessageBubble(this)" class="text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors" title="Salin"><i class="fas fa-copy"></i> Salin</button><button onclick="window.speakMessage(this)" class="text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors" title="Dengarkan"><i class="fas fa-volume-up"></i> Dengar</button></div>`;
        }

        if (role === 'user') {
             div.innerHTML = `<div class="flex flex-col items-end w-full max-w-full min-w-0">${fileHtml}<div class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm ${bubbleClass} w-fit min-w-0 max-w-full overflow-hidden leading-7">${contentHtml}</div>${actions}</div>`;
        } else {
             div.innerHTML = `<div class="flex flex-col items-start w-full max-w-full min-w-0">${fileHtml}${contentHtml}${actions}</div>`;
        }
        
        return div;
    }

    function renderEmptyState() { 
        if (!messageList) return; 
        messageList.innerHTML = `<div id="empty-state" class="flex flex-col items-center justify-center flex-grow h-full w-full min-h-[60vh] pt-10"><div class="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center mb-6 md:mb-8 perspective-[1000px]"><div class="absolute inset-0 bg-purple-900/20 rounded-full blur-3xl animate-pulse"></div><div class="absolute w-[110%] h-[110%] rounded-full border border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.3)] animate-orbit-1 border-t-transparent border-l-transparent"></div><div class="absolute w-[110%] h-[110%] rounded-full border border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.3)] animate-orbit-2 border-b-transparent border-r-transparent"></div><div class="absolute w-[110%] h-[110%] rounded-full border border-violet-500/50 animate-orbit-3 border-t-transparent border-r-transparent"></div><div class="absolute w-[110%] h-[110%] rounded-full border border-indigo-500/40 animate-orbit-4 border-b-transparent border-l-transparent"></div><div class="absolute w-[110%] h-[110%] rounded-full border border-pink-500/40 animate-orbit-5 border-l-transparent border-r-transparent"></div><div class="absolute w-[110%] h-[110%] rounded-full border border-cyan-500/40 animate-orbit-6 border-t-transparent border-b-transparent"></div><div class="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-purple-400/20 bg-[#050508] relative z-10 shadow-[0_0_40px_rgba(147,51,234,0.3)]"><div class="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-transparent to-black z-10"></div><img src="/logo.png" alt="Logo" class="relative w-full h-full object-cover opacity-90"></div></div><h2 class="text-3xl md:text-5xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">Dardcor AI</h2><p class="text-sm md:text-base text-purple-300/60 text-center max-w-xs md:max-w-md px-4 leading-relaxed font-light tracking-wide">Apa yang bisa saya bantu?</p></div>`; 
        messageList.className = "w-full max-w-3xl mx-auto flex flex-col h-full items-center justify-center pb-4"; 
    }

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function(url) {
            return '<a href="' + url + '" target="_blank" class="text-purple-500 hover:text-purple-300 hover:underline break-all">' + url + '</a>';
        });
    }

    function appendMessage(role, text, files = []) {
        if (!messageList) return null;
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.remove();
        messageList.classList.remove('h-full', 'items-center', 'justify-center');
        messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 pt-4 pb-4";
        const div = createMessageElementSync(role, text, files);
        messageList.appendChild(div);
        
        if (role === 'bot' && text !== '...loading_placeholder...') {
            const body = div.querySelector('.markdown-body');
            if (body && window.renderMathInElement) { renderMathInElement(body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); }
            if (body && typeof hljs !== 'undefined') { body.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el)); }
        }
        return div;
    }

    async function sendMessage() {
        if (isSending) { if (abortController) { abortController.abort(); abortController = null; isSending = false; if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane'); document.getElementById('loading-indicator')?.remove(); } return; }
        const msg = messageInput ? messageInput.value.trim() : '';
        if (!msg && selectedFiles.length === 0) return;
        isSending = true; abortController = new AbortController();
        if (sendIcon) sendIcon.classList.replace('fa-paper-plane', 'fa-stop');
        if (messageInput) { messageInput.blur(); messageInput.value = ''; messageInput.style.height = 'auto'; }
        if (filePreviewContainer) filePreviewContainer.classList.add('hidden');
        
        const userDiv = createMessageElementSync('user', msg, selectedFiles);
        messageList.appendChild(userDiv);
        
        const loaderDiv = document.createElement('div');
        loaderDiv.id = 'loading-indicator';
        loaderDiv.className = "flex w-full justify-start message-bubble-container group min-w-0";
        
        if (isDeepThinkEnabled) {
            loaderDiv.innerHTML = `
                <div class="flex flex-col items-start w-full max-w-full min-w-0">
                    <div class="unified-header">
                        <div class="header-content-wrapper" style="cursor: default;">
                            <div class="logo-stack">
                                <div class="spinner-ring active"></div>
                                <img src="/logo.png" class="main-logo">
                            </div>
                            <span class="bot-name-display animate-pulse">Dardcor AI Thinking...</span>
                            <i class="fas fa-chevron-down toggle-chevron"></i>
                        </div>
                    </div>
                </div>`;
        } else {
            loaderDiv.innerHTML = `
                <div class="flex flex-col items-start w-full max-w-full min-w-0">
                    <div class="unified-header">
                        <div class="header-content-wrapper static-mode">
                            <div class="logo-stack">
                                <div class="spinner-ring active"></div>
                                <img src="/logo.png" class="main-logo">
                            </div>
                            <span class="bot-name-display animate-pulse">Dardcor AI Thinking...</span>
                        </div>
                    </div>
                </div>`;
        }
        
        messageList.appendChild(loaderDiv);
        
        scrollToBottom(true);
        const emptyState = document.getElementById('empty-state'); if (emptyState) emptyState.remove();
        messageList.classList.remove('h-full', 'items-center', 'justify-center');
        messageList.className = "w-full max-w-3xl mx-auto flex flex-col gap-6 pt-4 pb-4";

        const fd = new FormData();
        fd.append('message', msg);
        fd.append('conversationId', serverData.currentConversationId || '');
        fd.append('toolType', currentToolType);
        fd.append('useDeepThink', isDeepThinkEnabled);
        fd.append('useWebSearch', isSearchEnabled);
        selectedFiles.forEach(f => fd.append('file_attachment', f));
        selectedFiles = []; if (fileInput) fileInput.value = '';

        try {
            const response = await fetch('/dardcorchat/ai/chat-stream', { method: 'POST', body: fd, signal: abortController.signal });
            if (!response.ok) throw new Error("Server Error");
            loaderDiv.remove();
            
            const botDiv = document.createElement('div');
            botDiv.className = "flex w-full justify-start message-bubble-container group min-w-0";
            
            botDiv.innerHTML = `<div class="flex flex-col items-start w-full max-w-full min-w-0">
                <div id="dynamic-header"></div>
                <div id="main-content-container" class="chat-content-box relative rounded-2xl px-5 py-3.5 shadow-md text-sm bg-transparent text-gray-200 rounded-bl-sm border-none w-fit min-w-0 max-w-full overflow-hidden leading-7 hidden">
                    <div class="markdown-body w-full max-w-full overflow-hidden break-words"></div>
                </div>
                <div class="flex items-center gap-3 mt-1 px-1 select-none opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.copyMessageBubble(this)" class="text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors" title="Salin"><i class="fas fa-copy"></i> Salin</button>
                    <button onclick="window.speakMessage(this)" class="text-[10px] font-medium bg-transparent border-none p-0 text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors" title="Dengarkan"><i class="fas fa-volume-up"></i> Dengar</button>
                </div>
            </div>`;
            
            if (messageList) messageList.appendChild(botDiv);
            
            const headerContainer = botDiv.querySelector('#dynamic-header');
            const mainContainer = botDiv.querySelector('#main-content-container');
            const botContent = botDiv.querySelector('.markdown-body');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let accumulatedThink = "";
            let accumulatedAnswer = "";
            let isThinking = isDeepThinkEnabled;
            let buffer = "";
            let isStreaming = true;
            let lastUpdate = 0;
            let isIdentityShown = false;

            if (isDeepThinkEnabled) {
                headerContainer.innerHTML = `
                    <details class="unified-header group w-full max-w-full">
                        <summary>
                            <div class="header-content-wrapper">
                                <div class="logo-stack">
                                    <div class="spinner-ring active"></div>
                                    <img src="/logo.png" class="main-logo">
                                </div>
                                <span class="bot-name-display animate-pulse">Dardcor AI Thinking...</span>
                                <i class="fas fa-chevron-down toggle-chevron"></i>
                            </div>
                        </summary>
                        <div class="think-content-box">
                            <div class="whitespace-pre-wrap"></div>
                        </div>
                    </details>`;
            } else {
                headerContainer.innerHTML = `
                    <div class="unified-header">
                        <div class="header-content-wrapper static-mode">
                            <div class="logo-stack">
                                <div class="spinner-ring active"></div>
                                <img src="/logo.png" class="main-logo">
                            </div>
                            <span class="bot-name-display animate-pulse">Dardcor AI Thinking...</span>
                        </div>
                    </div>`;
            }

            const render = (timestamp) => {
                if (!isStreaming) return;
                if (timestamp - lastUpdate < 50) { requestAnimationFrame(render); return; }
                lastUpdate = timestamp;
                
                if (isDeepThinkEnabled) {
                    const details = headerContainer.querySelector('details');
                    if (details) {
                        const contentDiv = details.querySelector('.think-content-box .whitespace-pre-wrap');
                        const spinner = details.querySelector('.spinner-ring');
                        const nameDisplay = details.querySelector('.bot-name-display');
                        
                        if (contentDiv && accumulatedThink) contentDiv.innerText = accumulatedThink;
                        
                        if (!isThinking) {
                            if (spinner) spinner.classList.remove('active');
                            if (nameDisplay) {
                                nameDisplay.innerText = "Dardcor AI : Show Process";
                                nameDisplay.classList.remove('animate-pulse');
                            }
                        }
                    }
                } else {
                    const staticHeader = headerContainer.querySelector('.unified-header');
                    if (staticHeader && accumulatedAnswer) {
                         const spinner = staticHeader.querySelector('.spinner-ring');
                         const nameDisplay = staticHeader.querySelector('.bot-name-display');
                         if(spinner) spinner.classList.remove('active');
                         if(nameDisplay) {
                             nameDisplay.innerText = "Dardcor AI";
                             nameDisplay.classList.remove('animate-pulse');
                         }
                    }
                }

                if (accumulatedAnswer) {
                    if (isDeepThinkEnabled && !isIdentityShown) {
                        isIdentityShown = true;
                    }
                    if (mainContainer) {
                        mainContainer.classList.remove('hidden');
                        
                        let tempFormatted = accumulatedAnswer;
                        const codeBlockCount = (tempFormatted.match(/```/g) || []).length;
                        if (codeBlockCount % 2 !== 0) tempFormatted += "\n```";
                        
                        if (typeof marked !== 'undefined') {
                            botContent.innerHTML = marked.parse(tempFormatted);
                            if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
                        }
                    }
                }
                
                if (!userIsScrolling && chatContainer) {
                    const threshold = 150;
                    const position = chatContainer.scrollTop + chatContainer.clientHeight;
                    const height = chatContainer.scrollHeight;
                    if (height - position <= threshold) {
                        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'auto' });
                    }
                }
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split('\n\n');
                buffer = chunks.pop(); 

                for (const chunkBlock of chunks) {
                    const lines = chunkBlock.split('\n');
                    let eventType = 'message'; 
                    let data = null;

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.substring(7).trim();
                        } else if (line.startsWith('data: ')) {
                            try {
                                data = JSON.parse(line.substring(6));
                            } catch(e) {}
                        }
                    }

                    if (data) {
                        if (eventType === 'deep-think') {
                            if (data.chunk) accumulatedThink += data.chunk;
                        } else if (eventType === 'message') {
                            isThinking = false;
                            if (data.chunk) accumulatedAnswer += data.chunk;
                        } else if (eventType === 'error') {
                            window.showNavbarAlert(data.error || 'Error', 'error');
                        }
                    }
                }
            }
            isStreaming = false; 
            isThinking = false;
            
            if (isDeepThinkEnabled) {
                const details = headerContainer.querySelector('details');
                if (details) {
                    const spinner = details.querySelector('.spinner-ring');
                    const nameDisplay = details.querySelector('.bot-name-display');
                    
                    if (spinner) spinner.classList.remove('active');
                    if (nameDisplay) {
                        nameDisplay.innerText = "Dardcor AI : Show Process";
                        nameDisplay.classList.remove('animate-pulse');
                    }
                    
                    const contentDiv = details.querySelector('.think-content-box .whitespace-pre-wrap');
                    if (contentDiv && accumulatedThink) contentDiv.innerText = accumulatedThink;
                }
            } else {
                const staticHeader = headerContainer.querySelector('.unified-header');
                if (staticHeader) {
                     const spinner = staticHeader.querySelector('.spinner-ring');
                     const nameDisplay = staticHeader.querySelector('.bot-name-display');
                     if(spinner) spinner.classList.remove('active');
                     if(nameDisplay) {
                         nameDisplay.innerText = "Dardcor AI";
                         nameDisplay.classList.remove('animate-pulse');
                     }
                }
            }

            if (accumulatedAnswer && mainContainer) {
                mainContainer.classList.remove('hidden');
                botContent.innerHTML = marked.parse(accumulatedAnswer);
                if (typeof hljs !== 'undefined') botContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            }
            
            scrollToBottom(true);

        } catch (e) {
            if (e.name === 'AbortError') {
                isStreaming = false; 
                document.getElementById('loading-indicator')?.remove();
                if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
                isSending = false;
                abortController = null;
                return;
            }
            document.getElementById('loading-indicator')?.remove();
            window.showNavbarAlert('Gagal mengirim pesan', 'error');
        } finally {
            isSending = false; abortController = null; if (sendIcon) sendIcon.classList.replace('fa-stop', 'fa-paper-plane');
        }
    }

    function scrollToBottom(force = false) { 
        if (!chatContainer) return; 
        const threshold = 150; 
        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold; 
        if (force || isNearBottom) chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'auto' }); 
    }
    
    function initHighlight() { 
        document.querySelectorAll('.message-bubble-container pre code').forEach(el => { if (typeof hljs !== 'undefined') hljs.highlightElement(el); }); 
        document.querySelectorAll('.message-bubble-container .raw-message-content').forEach(raw => { 
            const target = raw.nextElementSibling?.querySelector('.markdown-body') || raw.nextElementSibling; 
            if (target && (target.classList.contains('markdown-body') || target.querySelector('.markdown-body'))) { 
                const mdBody = target.classList.contains('markdown-body') ? target : target.querySelector('.markdown-body');
                if (mdBody && typeof marked !== 'undefined') { 
                    const parsed = parseMessageContent(String(raw.value || ''));
                    mdBody.innerHTML = marked.parse(parsed.answer); 
                    if (window.renderMathInElement) renderMathInElement(mdBody, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); 
                    mdBody.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
                } 
            } 
        }); 
    }

    if (messageList) { 
        const hasMessages = messageList.querySelectorAll('.message-bubble-container').length > 0; 
        const isActuallyEmpty = !hasMessages; 
        if (isActuallyEmpty) { 
            messageList.innerHTML = ''; 
            renderEmptyState(); 
        } else { 
            initHighlight(); 
            scrollToBottom(true); 
        } 
    }

    window.toggleMenu = function(event, menuId) {
        if (event) event.stopPropagation();
        document.querySelectorAll('[id^="menu-"]').forEach(el => { if (el.id !== menuId) el.classList.add('hidden'); });
        const menu = document.getElementById(menuId);
        if (menu) menu.classList.toggle('hidden');
    };

    window.toggleSidebar = function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if (!sidebar) return;
        if (window.innerWidth < 1024) {
            sidebar.classList.toggle('-translate-x-full');
            if (overlay) overlay.classList.toggle('hidden');
        } else {
            document.body.classList.toggle('sidebar-closed');
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
        if (frame) setTimeout(() => { frame.src = 'about:blank'; }, 300);
    };

    window.openRenameModal = function(id) {
        chatToEdit = id;
        const currentTitleEl = document.getElementById(`raw-title-${id}`);
        const input = document.getElementById('rename-input');
        const modal = document.getElementById('rename-modal');
        if (input && currentTitleEl) input.value = currentTitleEl.value;
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
            const res = await fetch('/dardcorchat/ai/rename-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: chatToEdit, newTitle }) });
            if (res.ok) {
                const titleEl = document.getElementById(`title-${chatToEdit}`);
                const rawInput = document.getElementById(`raw-title-${chatToEdit}`);
                if (titleEl) titleEl.innerText = newTitle.length > 25 ? newTitle.substring(0, 25) + '...' : newTitle;
                if (rawInput) rawInput.value = newTitle;
                window.showNavbarAlert('Nama percakapan diperbarui', 'success');
                window.closeModal('rename-modal');
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
            const res = await fetch('/dardcorchat/ai/delete-chat-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: chatToDelete }) });
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
                window.closeModal('delete-modal');
            } else {
                window.showNavbarAlert('Gagal menghapus percakapan', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showNavbarAlert('Terjadi kesalahan sistem', 'error');
        }
    };
});