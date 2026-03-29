import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const workbook = window.XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    updateProgress(50);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.autoTable({
        head: [data[0]],
        body: data.slice(1),
    });
    
    updateProgress(100);
    
    const pdfBlob = doc.output('blob');
    
    return {
        blob: pdfBlob,
        fileName: `${file.name.replace('.xlsx', '').replace('.xls', '')}.pdf`
    };
}
