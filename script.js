const { PDFDocument } = PDFLib;
let pdfDocBytes = null;      // เก็บ Raw Data ของ PDF
let pdfjsDoc = null;         // เก็บ Object ของ pdf.js สำหรับ Render
let currentPageNum = 1;
const scale = 1.5;           // ความละเอียดการแสดงผลบนจอ
const pageImages = {};       // เก็บ Element รูปภาพแยกตามหน้า { 1: [img1, img2], 2: [img3] }
let selectedElement = null; // เก็บว่าตอนนี้เราเลือกรูปไหนอยู่

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
    
    // จัดการการแสดงผลรูปภาพ: ซ่อนรูปหน้าอื่น โชว์เฉพาะหน้าปัจจุบัน
    Object.keys(pageImages).forEach(pageIdx => {
        const isCurrent = parseInt(pageIdx) === num;
        pageImages[pageIdx].forEach(img => {
            img.style.display = isCurrent ? 'block' : 'none';
        });
    });

    document.getElementById('page-info').innerText = `หน้า ${num} / ${pdfjsDoc.numPages}`;
}

// --- 2. Event: โหลดไฟล์ PDF ---
document.getElementById('pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("เริ่มโหลดไฟล์:", file.name); // เช็คใน Console (F12)

    try {
        pdfDocBytes = await file.arrayBuffer();
        
        // สร้าง URL สำหรับ pdf.js
        const fileURL = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(fileURL);
        
        pdfjsDoc = await loadingTask.promise;
        
        console.log("โหลด PDF สำเร็จ! จำนวนหน้าทั้งหมด:", pdfjsDoc.numPages);
        
        currentPageNum = 1; 
        renderPage(currentPageNum); // สั่งวาดหน้าแรก และอัปเดตเลขหน้าบนจอ
        
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการโหลด PDF:", error);
        alert("โหลดไฟล์ไม่ได้นะเพื่อน ลองเช็คไฟล์ดูอีกทีครับ");
    }
});

// --- 3. Event: โหลดรูปภาพ ---
document.getElementById('img-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !pdfjsDoc) return alert("กรุณาโหลด PDF ก่อนวางรูปครับเพื่อน!");

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.classList.add('draggable-img');
        img.style.width = '150px';
        img.dataset.page = currentPageNum; // บันทึกว่ารูปนี้อยู่หน้าไหน
        img.addEventListener('click', (e) => {selectImage(e.target);});
        img.addEventListener('mousedown', () => selectImage(img));
        
        document.getElementById('pdf-wrapper').appendChild(img);
        
        // เก็บเข้าคอลเลกชันแยกตามหน้า
        if (!pageImages[currentPageNum]) pageImages[currentPageNum] = [];
        pageImages[currentPageNum].push(img);
        
        setupInteract(img);
    };
    reader.readAsDataURL(file);
});

// --- 4. ฟังก์ชันควบคุมการลากวาง (Interact.js) ---
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
                    x += event.deltaRect.left;
                    y += event.deltaRect.top;
                    Object.assign(event.target.style, {
                        width: `${width}px`, height: `${height}px`,
                        transform: `translate(${x}px, ${y}px)`
                    });
                }
            }
        });
}

// --- 2. ฟังก์ชันสำหรับเลือกรูป ---
function selectImage(el) {
    // เอาขอบสีแดงออกจากรูปเก่าก่อน
    if (selectedElement) {
        selectedElement.style.border = "2px dashed #3498db";
    }
    
    selectedElement = el;
    selectedElement.style.border = "2px solid #ff0000"; // ไฮไลท์สีแดงว่าเลือกอยู่
    console.log("เลือกรูปภาพแล้ว พร้อมลบ");
}

// --- 3. ดักฟังการกดปุ่ม Delete บนคีย์บอร์ด ---
document.addEventListener('keydown', (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        deleteImage(selectedElement);
    }
});

// --- 4. ฟังก์ชันลบรูป ---
function deleteImage(el) {
    if (!confirm("ต้องการลบรูปนี้ใช่ไหมเพื่อน?")) return;

    const pageNum = el.dataset.page;
    
    // ลบออกจากหน้าจอ (DOM)
    el.remove();
    
    // ลบออกจาก Array pageImages (ถ้ามีเก็บไว้)
    if (pageImages[pageNum]) {
        pageImages[pageNum] = pageImages[pageNum].filter(img => img !== el);
    }
    
    selectedElement = null;
    console.log("ลบรูปเรียบร้อย!");
}

// --- 5. ปุ่มเปลี่ยนหน้า ---
window.nextPage = () => {
    if (currentPageNum >= pdfjsDoc.numPages) return;
    currentPageNum++;
    renderPage(currentPageNum);
};

window.prevPage = () => {
    if (currentPageNum <= 1) return;
    currentPageNum--;
    renderPage(currentPageNum);
};

// --- 6. ฟังก์ชัน Save (รวมร่าง PDF) ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!pdfDocBytes) return alert("ไม่มีไฟล์ให้เซฟนะเพื่อน!");
    
    const pdfDoc = await PDFDocument.load(pdfDocBytes);
    const pages = pdfDoc.getPages();

    // วนลูปทุกรูปที่ถูกสร้างขึ้น
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

        // คำนวณพิกัด (กลับแกน Y สำหรับ PDF)
        const pdfX = (rect.left - wrapperRect.left) * ratioX;
        const pdfY = height - ((rect.top - wrapperRect.top + rect.height) * ratioY);

        const imgBytes = await fetch(el.src).then(res => res.arrayBuffer());
        let embeddedImg;
        if (el.src.includes('image/png')) {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
        } else {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
        }

        targetPage.drawImage(embeddedImg, {
            x: pdfX, y: pdfY,
            width: rect.width * ratioX,
            height: rect.height * ratioY
        });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'edited_by_friend.pdf';
    link.click();
});