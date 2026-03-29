import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const { PDFDocument, degrees } = window.PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(bytes);
    
    const pages = pdf.getPages();
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const rotation = page.getRotation().angle;
        page.setRotation(degrees(rotation + 90));
        
        updateProgress(((i + 1) / pages.length) * 100);
    }
    
    const pdfBytes = await pdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return {
        blob,
        fileName: `rotated_${file.name}`
    };
}
