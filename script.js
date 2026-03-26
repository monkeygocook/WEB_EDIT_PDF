const { PDFDocument } = PDFLib;
let pdfDocBytes = null;
let scale = 1.5; // ขยายการแสดงผลบนจอ

// 1. โหลดและแสดงผล PDF (Preview)
document.getElementById('pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    pdfDocBytes = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument(URL.createObjectURL(file));
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // แก้เฉพาะหน้าแรกก่อน
    
    const viewport = page.getViewport({ scale });
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    document.getElementById('pdf-wrapper').style.width = viewport.width + 'px';
});

// 2. จัดการรูปภาพ (Add & Drag/Resize)
document.getElementById('img-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.classList.add('draggable-img');
        img.style.width = '150px'; // ขนาดเริ่มต้น
        document.getElementById('pdf-wrapper').appendChild(img);
        
        setupInteract(img);
    };
    reader.readAsDataURL(file);
});

function setupInteract(el) {
    let x = 0, y = 0;
    interact(el)
        .draggable({
            listeners: {
                move (event) {
                    x += event.dx; y += event.dy;
                    event.target.style.transform = `translate(${x}px, ${y}px)`;
                }
            }
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move (event) {
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

// 3. รวมร่างและ Save (หัวใจของวิศวะคอม!)
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!pdfDocBytes) return alert("เลือกไฟล์ PDF ก่อนเพื่อน!");
    
    const pdfDoc = await PDFDocument.load(pdfDocBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const imgElements = document.querySelectorAll('.draggable-img');
    
    for (const el of imgElements) {
        // คำนวณ Ratio ระหว่างสิ่งที่เห็นบนจอ กับ ขนาดจริงใน PDF
        const canvas = document.getElementById('pdf-canvas');
        const ratioX = width / canvas.width;
        const ratioY = height / canvas.height;

        const rect = el.getBoundingClientRect();
        const wrapperRect = document.getElementById('pdf-wrapper').getBoundingClientRect();

        // พิกัด PDF เริ่มจาก "ซ้ายล่าง" แต่ Browser เริ่มจาก "ซ้ายบน" (ต้องกลับด้านแกน Y)
        const pdfX = (rect.left - wrapperRect.left) * ratioX;
        const pdfY = height - ((rect.top - wrapperRect.top + rect.height) * ratioY);

        const imgBytes = await fetch(el.src).then(res => res.arrayBuffer());
        const embeddedImg = await pdfDoc.embedPng(imgBytes); // หรือ embedJpg

        firstPage.drawImage(embeddedImg, {
            x: pdfX, y: pdfY,
            width: rect.width * ratioX,
            height: rect.height * ratioY
        });
    }

    const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = 'edited.pdf';
    link.click();
});