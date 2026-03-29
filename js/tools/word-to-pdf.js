import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    
    const container = document.createElement('div');
    container.id = 'docx-render-container';
    // Position off-screen but keep it fully "visible" for the capture engine
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '800px'; // Standard width for consistent rendering
    container.style.backgroundColor = 'white';
    container.style.padding = '40px';
    container.style.zIndex = '-9999';
    container.style.overflow = 'hidden';
    container.style.wordWrap = 'break-word';
    document.body.appendChild(container);

    try {
        updateProgress(20);
        
        // Use docx-preview to render the Word doc to HTML
        const renderFunc = window.renderAsync || (window.docx && window.docx.renderAsync);
        if (!renderFunc) {
            throw new Error('Word rendering engine not found. Please refresh the page.');
        }

        await renderFunc(bytes, container, null, {
            className: "docx",
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPageOnEmptyParagraph: true,
            useBase64URL: true,
            useMathMLPolyfill: true,
            showChanges: false,
            debug: false
        });

        // Wait for images and styles to settle
        await new Promise(resolve => setTimeout(resolve, 1500));

        updateProgress(50);

        // Convert the rendered HTML to a Canvas (Image)
        const canvas = await window.html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800 // Force the window width for consistent rendering
        });

        updateProgress(80);

        // Put the image into a multi-page PDF
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const totalPdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = totalPdfHeight;
        let position = 0;

        // Add the first page
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight);
        heightLeft -= pdfHeight;

        // Add subsequent pages if needed
        while (heightLeft > 0) {
            position = heightLeft - totalPdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight);
            heightLeft -= pdfHeight;
            
            // Safety break to prevent infinite loops if something goes wrong with calculations
            if (pdf.internal.getNumberOfPages() > 50) break; 
        }
        
        updateProgress(100);

        return {
            blob: pdf.output('blob'),
            fileName: `${file.name.replace('.docx', '')}.pdf`
        };

    } finally {
        document.body.removeChild(container);
    }
}
