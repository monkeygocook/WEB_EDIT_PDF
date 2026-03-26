const { PDFDocument } = PDFLib;
let pdfDocBytes = null;      // เก็บ Raw Data ของ PDF
let pdfjsDoc = null;         // เก็บ Object ของ pdf.js สำหรับ Render
let currentPageNum = 1;
const scale = 1.5;           // ความละเอียดการแสดงผลบนจอ
const pageImages = {};       // เก็บ Element รูปภาพแยกตามหน้า
let selectedElement = null;  // เก็บว่าตอนนี้เราเลือกรูปไหนอยู่

// --- 1. ฟังก์ชัน Render หน้า PDF ---
async function renderPage(num) {
    if (!pdfjsDoc) return;
    
    const page = await pdfjsDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    // แสดงเฉพาะรูปของหน้านี้
    document.querySelectorAll('.draggable-img').forEach(img => {
        const isCurrent = parseInt(img.dataset.page) === num;
        img.style.display = isCurrent ? 'block' : 'none';
    });

    document.getElementById('page-info').innerText = `หน้า ${num} / ${pdfjsDoc.numPages}`;
}

// --- 2. ฟังก์ชันสำหรับเลือกรูป ---
function selectImage(el) {
    document.querySelectorAll('.draggable-img').forEach(img => {
        img.style.border = "2px dashed #3498db";
        img.style.zIndex = "1";
    });
    
    selectedElement = el;
    selectedElement.style.border = "2px solid #ff0000"; 
    selectedElement.style.zIndex = "100";
}

// คลิกที่ว่างเพื่อยกเลิกการเลือก
document.addEventListener('mousedown', (e) => {
    if (!e.target.classList.contains('draggable-img') && !e.target.closest('.toolbar')) {
        if (selectedElement) selectedElement.style.border = "2px dashed #3498db";
        selectedElement = null;
    }
});

// --- 3. ฟังก์ชันลบรูป ---
function deleteImage(el) {
    if (!el || !confirm("ต้องการลบรูปนี้ใช่ไหมเพื่อน?")) return;
    const pageNum = el.dataset.page;
    el.remove();
    if (pageImages[pageNum]) {
        pageImages[pageNum] = pageImages[pageNum].filter(img => img !== el);
    }
    selectedElement = null;
}

// ดักปุ่ม Delete / Backspace
document.addEventListener('keydown', (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        e.preventDefault();
        deleteImage(selectedElement);
    }
}, true);

// --- 4. Event: โหลดไฟล์ PDF ---
document.getElementById('pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        pdfDocBytes = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(URL.createObjectURL(file));
        pdfjsDoc = await loadingTask.promise;
        currentPageNum = 1; 
        renderPage(currentPageNum);
    } catch (error) {
        alert("โหลดไฟล์ไม่ได้นะเพื่อน");
    }
});

// --- 5. Event: โหลดรูปภาพ ---
document.getElementById('img-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !pdfjsDoc) return alert("กรุณาโหลด PDF ก่อนวางรูป!");

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.classList.add('draggable-img');
        img.style.width = '150px';
        img.dataset.page = currentPageNum;
        
        img.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            selectImage(img);
        });
        
        document.getElementById('pdf-wrapper').appendChild(img);
        setupInteract(img);
        selectImage(img);
    };
    reader.readAsDataURL(file);
});

// --- 6. ฟังก์ชันลากวางและย่อขยาย (ล็อคสัดส่วน) ---
function setupInteract(el) {
    let x = 0, y = 0;
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
                    
                    // Logic ล็อคสัดส่วน (Shift หรือ Checkbox)
                    const lockCheckbox = document.getElementById('aspect-ratio-lock');
                    const isLock = event.shiftKey || (lockCheckbox && lockCheckbox.checked);
                    
                    if (isLock) {
                        const ratio = event.target.naturalWidth / event.target.naturalHeight;
                        if (width / height > ratio) {
                            width = height * ratio;
                        } else {
                            height = width / ratio;
                        }
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

// --- 7. ปุ่มเปลี่ยนหน้า ---
window.nextPage = () => {
    if (!pdfjsDoc || currentPageNum >= pdfjsDoc.numPages) return;
    currentPageNum++; renderPage(currentPageNum);
};
window.prevPage = () => {
    if (!pdfjsDoc || currentPageNum <= 1) return;
    currentPageNum--; renderPage(currentPageNum);
};

// --- 8. ฟังก์ชัน Save PDF ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!pdfDocBytes) return alert("ไม่มีไฟล์ให้เซฟนะเพื่อน!");
    
    const pdfDoc = await PDFDocument.load(pdfDocBytes);
    const pages = pdfDoc.getPages();
    const allImgs = document.querySelectorAll('.draggable-img');
    
    for (const el of allImgs) {
        const pageIdx = parseInt(el.dataset.page) - 1;
        const targetPage = pages[pageIdx];
        const { width, height } = targetPage.getSize();
        
        const canvas = document.getElementById('pdf-canvas');
        const ratioX = width / canvas.width;
        const ratioY = height / canvas.height;

        const rect = el.getBoundingClientRect();
        const wrapperRect = document.getElementById('pdf-wrapper').getBoundingClientRect();

        const pdfX = (rect.left - wrapperRect.left) * ratioX;
        const pdfY = height - ((rect.top - wrapperRect.top + rect.height) * ratioY);

        const imgBytes = await fetch(el.src).then(res => res.arrayBuffer());
        const embeddedImg = el.src.includes('image/png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

        targetPage.drawImage(embeddedImg, {
            x: pdfX, y: pdfY,
            width: rect.width * ratioX,
            height: rect.height * ratioY
        });
    }

    const pdfBytes = await pdfDoc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
    link.download = 'edited_pdf.pdf';
    link.click();
});