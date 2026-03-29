import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const { PDFDocument } = window.PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(bytes);
    
    updateProgress(50);
    
    // pdf-lib doesn't have deep compression, but we can re-save it
    // which often reduces size if the original was unoptimized
    const pdfBytes = await pdf.save({ useObjectStreams: true });
    updateProgress(100);
    
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return {
        blob,
        fileName: `compressed_${file.name}`
    };
}
