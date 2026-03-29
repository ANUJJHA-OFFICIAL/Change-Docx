import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(bytes);
    
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        
        page.drawText(`Page ${i + 1} of ${pages.length}`, {
            x: width / 2 - 20,
            y: 20,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        updateProgress(((i + 1) / pages.length) * 100);
    }
    
    const pdfBytes = await pdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return {
        blob,
        fileName: `numbered_${file.name}`
    };
}
