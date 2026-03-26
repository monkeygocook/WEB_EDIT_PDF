const { PDFDocument, rgb, StandardFonts } = PDFLib;
let pdfDocBytes = null;
let pdfjsDoc = null;
let currentPageNum = 1;
const scale = 1.5;
let selectedElement = null;

// --- 1. ฟังก์ชันเพิ่มติ๊กถูกสีดำ (Checkmark) ---
window.addCheckmark = () => {
    if (!pdfjsDoc) return alert("โหลด PDF ก่อนนะเพื่อน!");
    const checkDiv = document.createElement('div');
    checkDiv.innerText = "✔"; // เครื่องหมายติ๊กถูกสีดำมาตรฐาน
    checkDiv.style.color = "#000000";
    checkDiv.style.fontSize = "36px";
    checkDiv.style.background = "transparent";
    checkDiv.classList.add('draggable-text');
    checkDiv.dataset.page = currentPageNum;
    checkDiv.dataset.type = "text";

    checkDiv.addEventListener('mousedown', (e) => { e.stopPropagation(); selectElementFunc(checkDiv); });
    document.getElementById('pdf-wrapper').appendChild(checkDiv);
    setupInteract(checkDiv);
    selectElementFunc(checkDiv);
};

// --- 2. ฟังก์ชันเพิ่มข้อความ (Double Click to Edit) ---
window.addText = () => {
    if (!pdfjsDoc) return alert("โหลด PDF ก่อนนะเพื่อน!");
    const textDiv = document.createElement('div');
    textDiv.innerText = "ดับเบิ้ลคลิกเพื่อแก้";
    textDiv.contentEditable = "false"; // เริ่มต้นห้ามแก้เพื่อให้ลากได้
    textDiv.classList.add('draggable-text');
    textDiv.dataset.page = currentPageNum;
    textDiv.dataset.type = "text";

    // Double click เพื่อเริ่มพิมพ์
    textDiv.addEventListener('dblclick', () => {
        textDiv.contentEditable = "true";
        textDiv.focus();
        interact(textDiv).draggable(false); // ปิดการลากตอนพิมพ์
        textDiv.style.border = "2px solid #27ae60";
    });

    // เลิกโฟกัสแล้วกลับไปโหมดลากวาง
    textDiv.addEventListener('blur', () => {
        textDiv.contentEditable = "false";
        interact(textDiv).draggable(true);
        textDiv.style.border = "1px dashed #3498db";
        if (textDiv.innerText.trim() === "") textDiv.innerText = "ข้อความว่างเปล่า";
    });

    textDiv.addEventListener('mousedown', (e) => { e.stopPropagation(); selectElementFunc(textDiv); });
    document.getElementById('pdf-wrapper').appendChild(textDiv);
    setupInteract(textDiv);
    selectElementFunc(textDiv);
};

// --- 3. ระบบควบคุม Element (ลาก/ย่อขยาย/ลบ) ---
function setupInteract(el) {
    let x = 0, y = 0;
    // คำนวณสัดส่วนจริง (สำหรับรูปภาพ)
    const ratio = el.tagName === 'IMG' ? el.naturalWidth / el.naturalHeight : null;

    interact(el).draggable({
        listeners: { 
            move(event) { 
                x += event.dx; y += event.dy; 
                event.target.style.transform = `translate(${x}px, ${y}px)`; 
            } 
        }
    }).resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: { 
            move(event) {
                let { width, height } = event.rect;
                const isLock = document.getElementById('aspect-ratio-lock')?.checked;
                
                // ล็อคสัดส่วนถ้าเป็นรูปภาพและมีการติ๊กถูก/กด Shift
                if (isLock && ratio) {
                    if (width / height > ratio) width = height * ratio;
                    else height = width / ratio;
                }
                
                x += event.deltaRect.left; y += event.deltaRect.top;
                Object.assign(event.target.style, { 
                    width: `${width}px`, 
                    height: `${height}px`, 
                    transform: `translate(${x}px, ${y}px)` 
                });
            }
        }
    });
}

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

// ลบด้วยปุ่ม Delete/Backspace (ยกเว้นตอนกำลังพิมพ์ในกล่องข้อความ)
document.addEventListener('keydown', (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        if (document.activeElement === selectedElement) return; 
        e.preventDefault();
        deleteElement(selectedElement);
    }
}, true);

// --- 4. การจัดการไฟล์และการ Save ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!pdfDocBytes) return alert("ไม่มีไฟล์ให้เซฟนะเพื่อน!");
    const pdfDoc = await PDFDocument.load(pdfDocBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const elements = document.querySelectorAll('.draggable-img, .draggable-text');
    for (const el of elements) {
        const pageIdx = parseInt(el.dataset.page) - 1;
        const page = pages[pageIdx];
        const { width: pW, height: pH } = page.getSize();
        
        const canvas = document.getElementById('pdf-canvas');
        const rX = pW / canvas.width;
        const rY = pH / canvas.height;
        
        const rect = el.getBoundingClientRect();
        const wRect = document.getElementById('pdf-wrapper').getBoundingClientRect();
        
        const pX = (rect.left - wRect.left) * rX;
        const pY = pH - ((rect.top - wRect.top + rect.height) * rY);

        if (el.dataset.type === "text") {
            page.drawText(el.innerText, {
                x: pX,
                y: pY + (5 * rY), 
                size: parseFloat(window.getComputedStyle(el).fontSize) * rY,
                font: font,
                color: rgb(0, 0, 0),
            });
        } else {
            const imgBytes = await fetch(el.src).then(res => res.arrayBuffer());
            const img = el.src.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
            page.drawImage(img, { x: pX, y: pY, width: rect.width * rX, height: rect.height * rY });
        }
    }

    const pdfData = await pdfDoc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }));
    link.download = 'edited_by_โต้.pdf';
    link.click();
});

// --- 5. โหลดไฟล์และ Render ---
document.getElementById('pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pdfDocBytes = await file.arrayBuffer();
    pdfjsDoc = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    currentPageNum = 1;
    renderPage(1);
});

document.getElementById('img-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = document.createElement('img');
        img.src = ev.target.result;
        img.classList.add('draggable-img');
        img.style.width = '150px';
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
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;

    document.querySelectorAll('.draggable-img, .draggable-text').forEach(el => {
        el.style.display = parseInt(el.dataset.page) === num ? 'block' : 'none';
    });
    document.getElementById('page-info').innerText = `หน้า ${num} / ${pdfjsDoc.numPages}`;
}

window.nextPage = () => { if (pdfjsDoc && currentPageNum < pdfjsDoc.numPages) { currentPageNum++; renderPage(currentPageNum); } };
window.prevPage = () => { if (pdfjsDoc && currentPageNum > 1) { currentPageNum--; renderPage(currentPageNum); } };