import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;
    const sections = [];
    
    let docxLib = window.docxGen || window.docx;
    if (docxLib && docxLib.default) {
        docxLib = docxLib.default;
    }
    
    if (!docxLib || !docxLib.Document) {
        throw new Error('The Word document generation library (docx) failed to load correctly. Please refresh the page and try again.');
    }
    const { Document, Paragraph, TextRun, Packer } = docxLib;
    
    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group text items by their vertical position (y-coordinate)
        const lines = {};
        textContent.items.forEach(item => {
            const y = Math.round(item.transform[5]); // Vertical position
            if (!lines[y]) {
                lines[y] = [];
            }
            lines[y].push(item);
        });

        // Sort lines by y-coordinate (descending for top-to-bottom)
        const sortedY = Object.keys(lines).sort((a, b) => b - a);
        
        const pageChildren = [];
        sortedY.forEach(y => {
            // Sort items in each line by x-coordinate
            const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const lineText = lineItems.map(item => item.str).join(' ');
            
            if (lineText.trim()) {
                pageChildren.push(
                    new Paragraph({
                        children: [new TextRun(lineText)],
                    })
                );
            }
        });

        sections.push({
            properties: {},
            children: pageChildren,
        });
        
        updateProgress((i / pageCount) * 100);
    }
    
    const doc = new Document({ sections });
    const docBlob = await Packer.toBlob(doc);
    
    return {
        blob: docBlob,
        fileName: `${file.name.replace('.pdf', '')}.docx`
    };
}
