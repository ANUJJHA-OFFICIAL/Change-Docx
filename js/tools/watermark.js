import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files, options) {
    const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(bytes);
    
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pages = pdf.getPages();
    const text = options.text || 'CONFIDENTIAL';
    const opacity = options.opacity || 0.5;
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        
        page.drawText(text, {
            x: width / 2 - 100,
            y: height / 2,
            size: 50,
            font: font,
            color: rgb(0.8, 0.8, 0.8),
            opacity: opacity,
            rotate: degrees(45),
        });
        
        updateProgress(((i + 1) / pages.length) * 100);
    }
    
    const pdfBytes = await pdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return {
        blob,
        fileName: `watermarked_${file.name}`
    };
}
