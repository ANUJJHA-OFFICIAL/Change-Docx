import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files, options) {
    const { PDFDocument } = window.PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(bytes);
    const pageCount = pdf.getPageCount();
    
    // For simplicity, we'll split all pages into separate PDFs and ZIP them
    const zip = new window.JSZip();
    
    for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();
        zip.file(`page_${i + 1}.pdf`, pdfBytes);
        
        updateProgress(((i + 1) / pageCount) * 100);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    return {
        blob: zipBlob,
        fileName: `split_${file.name.replace('.pdf', '')}.zip`
    };
}
