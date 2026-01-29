
import { read, utils, writeFile } from 'xlsx';
import { WorkOrder } from '../types';

export const parseExcelFile = (file: File): Promise<WorkOrder[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Use named import 'read' directly
        const workbook = read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Use named import 'utils' directly
        const rawRows = utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        let headerRowIndex = 0;
        let maxMatchCount = 0;
        const headerKeywords = ['work order', 'iş emri', 'code', 'status', 'date', 'priority', 'out of order'];

        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
            const row = rawRows[i];
            let currentMatches = 0;
            if (Array.isArray(row)) {
                row.forEach(cell => {
                    if (cell && typeof cell === 'string') {
                        const lowerCell = cell.toLowerCase();
                        if (headerKeywords.some(k => lowerCell.includes(k))) currentMatches++;
                    }
                });
            }
            if (currentMatches > maxMatchCount) {
                maxMatchCount = currentMatches;
                headerRowIndex = i;
            }
        }

        const json = utils.sheet_to_json(sheet, { range: headerRowIndex });
        
        const findKey = (row: any, ...candidates: string[]) => {
            const rowKeys = Object.keys(row);
            for (const c of candidates) {
                if (row[c] !== undefined) return row[c];
            }
            const lowerCandidates = candidates.map(c => c.toLowerCase());
            for (const key of rowKeys) {
                const lowerKey = key.trim().toLowerCase();
                if (lowerCandidates.includes(lowerKey)) return row[key];
            }
            return undefined;
        };

        const mappedData: WorkOrder[] = json.map((row: any) => {
             const code = findKey(row, 'Work order code', 'Code', 'ID', 'Sipariş', 'İş Emri');
             if (!code) return null;

             return {
                 "Work order code": String(code).trim(),
                 "Work order name": findKey(row, 'Work order name', 'Name', 'Description', 'Tanım', 'Açıklama') || 'Tanımsız İş',
                 "Asset Name": findKey(row, 'Asset Name', 'Asset', 'Varlık', 'Ekipman') || '',
                 "WO Activity type Activity type code": findKey(row, 'WO Activity type Activity type code', 'Activity Type', 'Bakım Tipi') || '',
                 "Status code": findKey(row, 'Status code', 'Status', 'Durum') || 'AÇIK',
                 "Work order start date/time": findKey(row, 'Work order start date/time', 'Start Date', 'Başlangıç'),
                 "Work order end date/time": findKey(row, 'Work order end date/time', 'End Date', 'Bitiş'),
                 "Comments: Name without formatting": findKey(row, 'Comments: Name without formatting', 'Comments', 'Notlar') || '',
                 "Priority": findKey(row, 'Priority', 'Öncelik') || 'Normal',
                 "Asset out of order?": findKey(row, 'Asset out of order ?', 'Asset out of order?', 'Duruş') || 'YANLIŞ',
                 ...row 
             } as WorkOrder;
        }).filter((d): d is WorkOrder => d !== null);

        resolve(mappedData);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Dosya işlenirken hata oluştu."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (data: WorkOrder[], fileName: string) => {
    // Use named imports 'utils' and 'writeFile' directly
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Data");
    writeFile(wb, fileName);
};
