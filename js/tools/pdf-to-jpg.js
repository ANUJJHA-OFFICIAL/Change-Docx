import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;
    const zip = new window.JSZip();
    
    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        zip.file(`page_${i}.jpg`, blob);
        
        updateProgress((i / pageCount) * 100);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    return {
        blob: zipBlob,
        fileName: `images_${file.name.replace('.pdf', '')}.zip`
    };
}
