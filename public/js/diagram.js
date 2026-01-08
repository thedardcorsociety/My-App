let currentScale = 1;
let pannedX = 0;
let pannedY = 0;
let isDragging = false;
let startX, startY;

document.addEventListener('DOMContentLoaded', function() {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark', 
        securityLevel: 'loose',
        flowchart: { useMaxWidth: false, htmlLabels: true },
        sequence: { useMaxWidth: false },
        gantt: { useMaxWidth: false }
    });
    
    try {
        const b64 = document.getElementById('initial-data').value;
        const decoded = decodeURIComponent(escape(atob(b64)));
        document.getElementById('code-editor').value = decoded;
        
        // Auto-fix on load
        window.fixCode();
    } catch(e) {}

    if (window.innerWidth >= 768) {
        document.body.classList.remove('sidebar-closed');
    } else {
        document.body.classList.remove('sidebar-open');
    }

    const previewPane = document.getElementById('preview-pane');
    
    previewPane.addEventListener('mousedown', (e) => {
        if(e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX - pannedX;
        startY = e.clientY - pannedY;
        previewPane.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        previewPane.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        pannedX = e.clientX - startX;
        pannedY = e.clientY - startY;
        window.updateTransform();
    });

    previewPane.addEventListener('touchstart', (e) => {
        if(e.target.closest('button')) return;
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX - pannedX;
        startY = touch.clientY - pannedY;
    }, {passive: false});

    window.addEventListener('touchend', () => { isDragging = false; });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        pannedX = touch.clientX - startX;
        pannedY = touch.clientY - startY;
        window.updateTransform();
    }, {passive: false});

    previewPane.addEventListener('wheel', (e) => {
        if(e.ctrlKey) {
            e.preventDefault();
            window.adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
        }
    }, {passive: false});
});

window.toggleEditor = function() {
    if (window.innerWidth >= 768) document.body.classList.toggle('sidebar-closed');
    else document.body.classList.toggle('sidebar-open');
};

window.fixCode = function() {
    let code = document.getElementById('code-editor').value;
    // Robust cleaning
    code = code.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/^```mermaid\s*/i, '')
               .replace(/^```\s*/i, '')
               .replace(/```$/i, '')
               .replace(/<br\s*\/?>/gi, '\n')
               .trim();
    
    document.getElementById('code-editor').value = code;
    window.renderDiagram();
};

window.renderDiagram = async function() {
    let code = document.getElementById('code-editor').value.trim();
    const target = document.getElementById('mermaid-target');
    
    if (!code) return;

    target.innerHTML = '';
    target.removeAttribute('data-processed');
    
    try {
        const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), code);
        target.innerHTML = svg;
        if (window.innerWidth < 768) document.body.classList.remove('sidebar-open');
    } catch(error) {
        target.innerHTML = `<div class="text-red-400 p-4 border border-red-800 rounded bg-red-900/20 text-xs font-mono text-center flex flex-col items-center gap-2"><i class="fas fa-exclamation-triangle text-2xl"></i><span>Syntax Error:</span><span class="opacity-75">${error.message}</span></div>`;
    }
};

window.adjustZoom = function(delta) {
    currentScale += delta;
    if (currentScale < 0.1) currentScale = 0.1;
    if (currentScale > 10) currentScale = 10;
    window.updateTransform();
};

window.resetZoom = function() {
    currentScale = 1;
    pannedX = 0;
    pannedY = 0;
    window.updateTransform();
};

window.updateTransform = function() {
    const content = document.getElementById('diagram-content');
    content.style.transform = `translate(${pannedX}px, ${pannedY}px) scale(${currentScale})`;
};

window.openDownloadModal = function() {
    document.getElementById('download-modal').classList.add('active');
};

window.closeDownloadModal = function() {
    document.getElementById('download-modal').classList.remove('active');
};

window.downloadAs = function(format) {
    const svg = document.querySelector('#mermaid-target svg');
    if (!svg) { alert('Tidak ada diagram.'); return; }
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    const svgRect = svg.getBoundingClientRect();
    const scaleFactor = 2; // High Res
    canvas.width = svgRect.width * scaleFactor; 
    canvas.height = svgRect.height * scaleFactor;
    
    img.onload = function() {
        ctx.fillStyle = "#0b0c15";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const filename = `dardcor-diagram-${Date.now()}`;
        
        if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'l' : 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${filename}.pdf`);
        } else {
            const link = document.createElement("a");
            link.download = `${filename}.${format}`;
            link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        window.closeDownloadModal();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
};