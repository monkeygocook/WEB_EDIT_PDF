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

    interact(el)
        .draggable({
            // allowFrom: '.drag-handle', // ถ้าอยากให้ลากได้เฉพาะที่ปุ่ม ให้เปิดบรรทัดนี้
            inertia: true, // เพิ่มความลื่นไหล
            autoScroll: true, // ให้จอเลื่อนตามถ้าลากไปสุดขอบ
            listeners: { 
                move(event) { 
                    x += event.dx; y += event.dy; 
                    event.target.style.transform = `translate(${x}px, ${y}px)`; 
                } 
            }
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            // เพิ่มปุ่มเล็กๆ ตรงมุมให้กดง่ายขึ้น (Resize Handle)
            margin: 15, // ขยายพื้นที่กดขอบให้กว้างขึ้นสำหรับนิ้วมือ
            listeners: { 
                move(event) {
                    let { width, height } = event.rect;
                    const isLock = document.getElementById('aspect-ratio-lock')?.checked;
                    
                    if (isLock && ratio) {
                        if (width / height > ratio) width = height * ratio; else height = width / ratio;
                    }
                    
                    x += event.deltaRect.left; y += event.deltaRect.top;
                    Object.assign(event.target.style, { 
                        width: `${width}px`, 
                        height: `${height}px`, 
                        transform: `translate(${x}px, ${y}px)` 
                    });

                    if (event.target.classList.contains('draggable-text')) {
                        event.target.style.fontSize = `${height * 0.8}px`;
                        event.target.style.lineHeight = `${height}px`;
                    }
                }
            }
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

// --- แก้ไขฟังก์ชัน Save ในไฟล์ JavaScript ---
document.getElementById('save-btn').addEventListener('click', async () => {
    try {
        if (!pdfDocBytes) return alert("เลือกไฟล์ PDF ก่อนเพื่อน!");
        
        const pdfDoc = await PDFLib.PDFDocument.load(pdfDocBytes); // ใช้ PDFLib. โดยตรงถ้าประกาศแบบนั้น
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
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
                // เซฟข้อความ หรือ เครื่องหมายติ๊ก
                page.drawText(el.innerText, { 
                    x: pX, 
                    y: pY + (2 * rY), // ปรับ offset นิดหน่อย
                    size: parseFloat(window.getComputedStyle(el).fontSize) * rY, 
                    font: font, 
                    color: PDFLib.rgb(0,0,0) 
                });
            } else {
                // เซฟรูปภาพ - เปลี่ยนวิธีดึง Bytes
                const response = await fetch(el.src);
                const imgBytes = await response.arrayBuffer();
                
                let img;
                if (el.src.includes('image/png') || el.src.endsWith('.png')) {
                    img = await pdfDoc.embedPng(imgBytes);
                } else {
                    img = await pdfDoc.embedJpg(imgBytes);
                }
                page.drawImage(img, { 
                    x: pX, 
                    y: pY, 
                    width: rect.width * rX, 
                    height: rect.height * rY 
                });
            }
        }
        
        const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
        const link = document.createElement('a');
        link.href = pdfDataUri;
        link.download = 'edited_by_to.pdf'; 
        link.click();

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดตอนเซฟ: " + err.message);
    }
});

function addDragHandle(el) {
    const handle = document.createElement('div');
    handle.innerHTML = "✢"; // สัญลักษณ์ย้าย
    handle.classList.add('drag-handle');
    el.appendChild(handle);
}
