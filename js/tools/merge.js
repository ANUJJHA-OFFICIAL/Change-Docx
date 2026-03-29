import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const { PDFDocument } = window.PDFLib;
    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        
        updateProgress(((i + 1) / files.length) * 100);
    }
    
    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return {
        blob,
        fileName: `merged_${Date.now()}.pdf`
    };
}
