import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const { PDFDocument } = window.PDFLib;
    const pdf = await PDFDocument.create();
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await readFileAsArrayBuffer(file);
        
        let image;
        const type = file.type || '';
        const name = file.name.toLowerCase();
        
        if (type === 'image/jpeg' || type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
            image = await pdf.embedJpg(bytes);
        } else if (type === 'image/png' || name.endsWith('.png')) {
            image = await pdf.embedPng(bytes);
        } else {
            // Skip unsupported formats
            continue;
        }
        
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height
        });
        
        updateProgress(((i + 1) / files.length) * 100);
    }
    
    const pdfBytes = await pdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return {
        blob,
        fileName: `images_to_pdf_${Date.now()}.pdf`
    };
}
