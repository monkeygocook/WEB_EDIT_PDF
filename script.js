const { PDFDocument, rgb, StandardFonts } = PDFLib;
let pdfDocBytes = null;
let pdfjsDoc = null;
let currentPageNum = 1;
const scale = 1.5;
let selectedElement = null;

// --- 1. Render PDF ---
async function renderPage(num) {
    if (!pdfjsDoc) return;
    const page = await pdfjsDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;

    // แสดงเฉพาะ Element ของหน้านี้
    document.querySelectorAll('.draggable-img, .draggable-text').forEach(el => {
        el.style.display = parseInt(el.dataset.page) === num ? 'block' : 'none';
    });
    document.getElementById('page-info').innerText = `หน้า ${num} / ${pdfjsDoc.numPages}`;
}

// --- 2. ฟังก์ชันเพิ่มข้อความ (New!) ---
window.addText = () => {
    if (!pdfjsDoc) return alert("โหลด PDF ก่อนนะเพื่อน!");
    
    const textDiv = document.createElement('div');
    textDiv.innerText = "ดับเบิ้ลคลิกเพื่อแก้ไข...";
    textDiv.contentEditable = "false"; // เริ่มต้นห้ามแก้ไข เพื่อให้ลากได้
    textDiv.classList.add('draggable-text');
    textDiv.dataset.page = currentPageNum;
    textDiv.dataset.type = "text";

    // --- ระบบ Double Click เพื่อแก้ไข ---
    textDiv.addEventListener('dblclick', () => {
        textDiv.contentEditable = "true";
        textDiv.focus();
        // หยุดการลากวางชั่วคราวขณะพิมพ์
        interact(textDiv).draggable(false);
        textDiv.style.cursor = "text";
        textDiv.style.border = "2px solid #27ae60"; // เปลี่ยนสีให้รู้ว่ากำลังพิมพ์
    });

    // --- ระบบ Blur (คลิกข้างนอก) เพื่อกลับไปโหมดลากวาง ---
    textDiv.addEventListener('blur', () => {
        textDiv.contentEditable = "false";
        // กลับมาเปิดการลากวางเหมือนเดิม
        interact(textDiv).draggable(true);
        textDiv.style.cursor = "move";
        textDiv.style.border = "1px dashed #3498db";
        
        // ถ้าพิมพ์จนว่างเปล่า ให้ใส่ข้อความ Default ไว้กันหาย
        if (textDiv.innerText.trim() === "") {
            textDiv.innerText = "ข้อความว่างเปล่า";
        }
    });

    // คลิกครั้งเดียวแค่เพื่อเลือก (Select) ให้ลบหรือย้ายได้
    textDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectElementFunc(textDiv);
    });

    document.getElementById('pdf-wrapper').appendChild(textDiv);
    setupInteract(textDiv); // เรียกใช้ interact.js
    selectElementFunc(textDiv);
};

// --- 3. จัดการการเลือกและลบ ---
function selectElementFunc(el) {
    document.querySelectorAll('.draggable-img, .draggable-text').forEach(item => {
        item.style.border = "1px dashed #3498db";
    });
    selectedElement = el;
    selectedElement.style.border = "2px solid #ff0000";
}

function deleteImage(el) {
    if (el && confirm("ลบส่วนที่เลือกใช่ไหม?")) {
        el.remove();
        selectedElement = null;
    }
}

document.addEventListener('keydown', (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        // ถ้ากำลังพิมพ์อยู่ในกล่องข้อความ ไม่ต้องลบกล่องทิ้ง
        if (document.activeElement === selectedElement) return;
        e.preventDefault();
        deleteImage(selectedElement);
    }
}, true);

// --- 4. Interact Setup (รองรับทั้งรูปและข้อความ) ---
function setupInteract(el) {
    let x = 0, y = 0;
    const ratio = el.tagName === 'IMG' ? el.naturalWidth / el.naturalHeight : null;

    interact(el)
        .draggable({
            listeners: {
                move(event) {
                    x += event.dx; y += event.dy;
                    event.target.style.transform = `translate(${x}px, ${y}px)`;
                }
            }
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move(event) {
                    let { width, height } = event.rect;
                    const isLock = document.getElementById('aspect-ratio-lock')?.checked;
                    
                    if (isLock && ratio) {
                        if (width / height > ratio) width = height * ratio;
                        else height = width / ratio;
                    }

                    x += event.deltaRect.left;
                    y += event.deltaRect.top;

                    Object.assign(event.target.style, {
                        width: `${width}px`,
                        height: `${height}px`,
                        transform: `translate(${x}px, ${y}px)`
                    });
                }
            }
        });
}

// --- 5. Save PDF (รวมร่างรูปและข้อความ) ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!pdfDocBytes) return alert("ไม่มีไฟล์ให้เซฟ!");
    const pdfDoc = await PDFDocument.load(pdfDocBytes);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const elements = document.querySelectorAll('.draggable-img, .draggable-text');
    for (const el of elements) {
        const pageIdx = parseInt(el.dataset.page) - 1;
        const targetPage = pages[pageIdx];
        const { width: pW, height: pH } = targetPage.getSize();
        const canvas = document.getElementById('pdf-canvas');
        const rX = pW / canvas.width;
        const rY = pH / canvas.height;
        const rect = el.getBoundingClientRect();
        const wRect = document.getElementById('pdf-wrapper').getBoundingClientRect();

        const pX = (rect.left - wRect.left) * rX;
        const pY = pH - ((rect.top - wRect.top + rect.height) * rY);

        if (el.dataset.type === "text") {
            // วาดข้อความลง PDF
            targetPage.drawText(el.innerText, {
                x: pX,
                y: pY + (5 * rY), // ปรับ Offset นิดหน่อยให้ตรงกับที่เห็น
                size: parseFloat(window.getComputedStyle(el).fontSize) * rY,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
        } else {
            // วาดรูปภาพ
            const imgBytes = await fetch(el.src).then(res => res.arrayBuffer());
            const img = el.src.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
            targetPage.drawImage(img, { x: pX, y: pY, width: rect.width * rX, height: rect.height * rY });
        }
    }

    const pdfBytes = await pdfDoc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
    link.download = 'edited.pdf';
    link.click();
});

// --- โหลดไฟล์ (ปุ่มเดิม) ---
document.getElementById('pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pdfDocBytes = await file.arrayBuffer();
    const task = pdfjsLib.getDocument(URL.createObjectURL(file));
    pdfjsDoc = await task.promise;
    currentPageNum = 1; renderPage(1);
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

window.nextPage = () => { if (pdfjsDoc && currentPageNum < pdfjsDoc.numPages) { currentPageNum++; renderPage(currentPageNum); } };
window.prevPage = () => { if (pdfjsDoc && currentPageNum > 1) { currentPageNum--; renderPage(currentPageNum); } };