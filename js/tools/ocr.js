import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;
    let fullText = '';
    
    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        const { data: { text } } = await window.Tesseract.recognize(canvas, 'eng', {
            logger: m => console.log(m)
        });
        
        fullText += `--- Page ${i} ---\n\n${text}\n\n`;
        
        updateProgress((i / pageCount) * 100);
    }
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    
    return {
        blob,
        fileName: `ocr_${file.name.replace('.pdf', '')}.txt`
    };
}
