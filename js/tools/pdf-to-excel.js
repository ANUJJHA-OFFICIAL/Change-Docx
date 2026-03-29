import { readFileAsArrayBuffer, updateProgress } from '../utils.js';

export async function process(files) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;
    const allRows = [];
    
    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Simple heuristic: group items by Y coordinate to form rows
        const rows = {};
        textContent.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!rows[y]) rows[y] = [];
            rows[y].push(item);
        });
        
        // Sort rows by Y (descending) and items by X (ascending)
        const sortedY = Object.keys(rows).sort((a, b) => b - a);
        sortedY.forEach(y => {
            const rowItems = rows[y].sort((a, b) => a.transform[4] - b.transform[4]);
            allRows.push(rowItems.map(item => item.str));
        });
        
        updateProgress((i / pageCount) * 100);
    }
    
    const worksheet = window.XLSX.utils.aoa_to_sheet(allRows);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    
    const excelBuffer = window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    return {
        blob,
        fileName: `${file.name.replace('.pdf', '')}.xlsx`
    };
}
