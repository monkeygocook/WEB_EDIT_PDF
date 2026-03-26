const { PDFDocument, rgb, StandardFonts } = PDFLib;
let pdfDocBytes = null;
let pdfjsDoc = null;
let currentPageNum = 1;
const scale = 1.5;
let selectedElement = null;

// --- 1. ฟังก์ชันเพิ่มติ๊กถูกสีดำ (✔) ---
window.addCheckmark = () => {
    console.log("กำลังเพิ่มติ๊กถูก...");
    const wrapper = document.getElementById('pdf-wrapper');
    
    const el = document.createElement('div');
    el.innerText = "✔";
    el.classList.add('draggable-text');
    el.style.color = "#000000";
    el.style.fontSize = "40px";
    el.style.position = "absolute";
    el.style.top = "50px"; // บังคับให้ปรากฏด้านบนของ Wrapper
    el.style.left = "50px";
    el.style.zIndex = "1000";
    el.dataset.page = currentPageNum;
    el.dataset.type = "text";

    el.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        selectElementFunc(el); 
    });

    wrapper.appendChild(el);
    setupInteract(el);
    selectElementFunc(el);
};

// --- 2. ฟังก์ชันเพิ่มข้อความ (Double Click to Edit) ---
window.addText = () => {
    const wrapper = document.getElementById('pdf-wrapper');
    const el = document.createElement('div');
    el.innerText = "ดับเบิ้ลคลิกเพื่อแก้";
    el.contentEditable = "false";
    el.classList.add('draggable-text');
    el.style.position = "absolute";
    el.style.top = "100px";
    el.style.left = "50px";
    el.dataset.page = currentPageNum;
    el.dataset.type = "text";

    el.addEventListener('dblclick', () => {
        el.contentEditable = "true";
        el.focus();
        interact(el).draggable(false);
        el.style.border = "2px solid #27ae60";
    });

    el.addEventListener('blur', () => {
        el.contentEditable = "false";
        interact(el).draggable(true);
        el.style.border = "1px dashed #3498db";
    });

    el.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        selectElementFunc(el); 
    });

    wrapper.appendChild(el);
    setupInteract(el);
    selectElementFunc(el);
};

// --- 3. ระบบ Interact (ลากวาง/ย่อขยาย) ---
function setupInteract(el) {
    let x = 0, y = 0;
    const ratio = el.tagName === 'IMG' ? el.naturalWidth / el.naturalHeight : null;

    interact(el).draggable({
        listeners: { move(event) { 
            x += event.dx; y += event.dy; 
            event.target.style.transform = `translate(${x}px, ${y}px)`; 
        } }
    }).resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: { move(event) {
            let { width, height } = event.rect;
            const isLock = document.getElementById('aspect-ratio-lock')?.checked;
            
            // 1. จัดการสัดส่วน (ถ้าเป็นรูปภาพ)
            if (isLock && ratio) {
                if (width / height > ratio) width = height * ratio; else height = width / ratio;
            }
            
            x += event.deltaRect.left; y += event.deltaRect.top;

            // 2. อัปเดตขนาดกล่อง
            Object.assign(event.target.style, { 
                width: `${width}px`, 
                height: `${height}px`, 
                transform: `translate(${x}px, ${y}px)` 
            });

            // 3. ✨ ทริคเด็ด: ถ้าเป็นข้อความหรือติ๊กถูก ให้ขยาย Font ตามความสูงกล่อง
            if (event.target.classList.contains('draggable-text')) {
                // ลดขนาดลงนิดหน่อย (0.8) เพื่อให้ตัวอักษรไม่เบียดขอบกล่องเกินไป
                event.target.style.fontSize = `${height * 0.8}px`; 
                event.target.style.lineHeight = `${height}px`; // จัดให้อยู่กึ่งกลางแนวตั้ง
            }
        }}
    });
}

// --- 4. การจัดการ Selection และลบ ---
function selectElementFunc(el) {
    document.querySelectorAll('.draggable-img, .draggable-text').forEach(item => {
        item.style.border = "1px dashed #3498db";
        item.style.zIndex = "1";
    });
    selectedElement = el;
    selectedElement.style.border = "2px solid #ff0000";
    selectedElement.style.zIndex = "100";
}

function deleteElement(el) {
    if (el && confirm("ลบส่วนที่เลือกใช่ไหมเพื่อน?")) {
        el.remove();
        selectedElement = null;
    }
}

document.addEventListener('keydown', (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        if (document.activeElement === selectedElement) return;
        e.preventDefault();
        deleteElement(selectedElement);
    }
}, true);

// --- 5. ระบบไฟล์ PDF ---
document.getElementById('pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    pdfDocBytes = await file.arrayBuffer();
    pdfjsDoc = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    currentPageNum = 1; renderPage(1);
});

document.getElementById('img-input').addEventListener('change', (e) => {
    const file = e.target.files[0]; const reader = new FileReader();
    reader.onload = (ev) => {
        const img = document.createElement('img'); img.src = ev.target.result;
        img.classList.add('draggable-img'); img.style.width = '150px';
        img.dataset.page = currentPageNum;
        img.onload = () => { setupInteract(img); selectElementFunc(img); };
        img.addEventListener('mousedown', (e) => { e.stopPropagation(); selectElementFunc(img); });
        document.getElementById('pdf-wrapper').appendChild(img);
    };
    reader.readAsDataURL(file);
});

async function renderPage(num) {
    if (!pdfjsDoc) return;
    const page = await pdfjsDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height; canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    
    // แสดงเฉพาะของหน้านี้
    document.querySelectorAll('.draggable-img, .draggable-text').forEach(el => 
        el.style.display = parseInt(el.dataset.page) === num ? 'block' : 'none'
    );
    document.getElementById('page-info').innerText = `หน้า ${num} / ${pdfjsDoc.numPages}`;
}

window.nextPage = () => { if (pdfjsDoc && currentPageNum < pdfjsDoc.numPages) { currentPageNum++; renderPage(currentPageNum); } };
window.prevPage = () => { if (pdfjsDoc && currentPageNum > 1) { currentPageNum--; renderPage(currentPageNum); } };

// --- 6. ฟังก์ชัน Save ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!pdfDocBytes) return alert("เลือกไฟล์ PDF ก่อนเพื่อน!");
    const pdfDoc = await PDFDocument.load(pdfDocBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const elements = document.querySelectorAll('.draggable-img, .draggable-text');
    
    for (const el of elements) {
        const pageIdx = parseInt(el.dataset.page) - 1;
        const page = pages[pageIdx];
        const { width: pW, height: pH } = page.getSize();
        const canvas = document.getElementById('pdf-canvas');
        const rX = pW / canvas.width; const rY = pH / canvas.height;
        const rect = el.getBoundingClientRect();
        const wRect = document.getElementById('pdf-wrapper').getBoundingClientRect();
        
        const pX = (rect.left - wRect.left) * rX;
        const pY = pH - ((rect.top - wRect.top + rect.height) * rY);

        if (el.dataset.type === "text") {
            page.drawText(el.innerText, { 
                x: pX, y: pY + (5 * rY), 
                size: parseFloat(window.getComputedStyle(el).fontSize) * rY, 
                font: font, color: rgb(0,0,0) 
            });
        } else {
            const imgBytes = await fetch(el.src).then(res => res.arrayBuffer());
            const img = el.src.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
            page.drawImage(img, { x: pX, y: pY, width: rect.width * rX, height: rect.height * rY });
        }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([await pdfDoc.save()], { type: 'application/pdf' }));
    link.download = 'edited.pdf'; link.click();
});