
export const excelDateToJSDate = (val: any): Date => {
  if (val instanceof Date) return val;
  
  // Handle numeric Excel serials
  if (typeof val === 'number') {
    return new Date((val - 25569) * 86400 * 1000);
  }

  // Handle String formats like "10.01.2026" or "10.01.2026 08:00:00"
  if (typeof val === 'string') {
    const parts = val.split(/[\s.]+ /); // Split by dot or space
    if (val.includes('.')) {
        const dparts = val.split(' ')[0].split('.');
        if (dparts.length === 3) {
            // JS Date uses YYYY, MM (0-indexed), DD
            const year = parseInt(dparts[2]);
            const month = parseInt(dparts[1]) - 1;
            const day = parseInt(dparts[0]);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }
    }
    // Fallback for standard ISO or other string formats
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date;
  }

  return new Date(NaN);
};

export const getMonthKey = (val?: any): string | null => {
  if (val === undefined || val === null) return null;
  const date = excelDateToJSDate(val);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
};

export const getDayOfMonth = (val?: any): number => {
  if (val === undefined || val === null) return 0;
  const date = excelDateToJSDate(val);
  if (isNaN(date.getTime())) return 0;
  return date.getDate();
};

export const formatFullDate = (val?: any): string => {
  if (val === undefined || val === null) return '-';
  const date = excelDateToJSDate(val);
  if (isNaN(date.getTime())) return String(val); // Return raw value if not a valid date
  return date.toLocaleString('tr-TR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export const formatDateForInput = (val?: any): string => {
   if (val === undefined || val === null) return '';
   const date = excelDateToJSDate(val);
   if (isNaN(date.getTime())) return '';
   return date.toISOString().split('T')[0];
};
