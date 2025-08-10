import * as XLSX from 'xlsx';

// Generate contact upload template
export const generateContactTemplate = (format = 'xlsx') => {
  // Template data with headers and sample data
  const templateData = [
    ['Name', 'Phone'],
    ['John Doe', '601123456789'],
    ['Jane Smith', '601987654321'],
    ['Ahmad Rahman', '601234567890'],
    ['Siti Fatimah', '601987654321']
  ];

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // Set column widths
  ws['!cols'] = [
    { width: 20 }, // Name column
    { width: 15 }  // Phone column
  ];

  // Style the header row (make it bold and with background color)
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4F46E5" } }, // Indigo background
    alignment: { horizontal: "center", vertical: "center" }
  };

  // Apply header styling
  ws['A1'].s = headerStyle;
  ws['B1'].s = headerStyle;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Contact Template");

  // Generate filename
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `contact_template_${timestamp}.${format}`;

  // Write file and trigger download
  XLSX.writeFile(wb, filename, { 
    bookType: format === 'xls' ? 'xls' : 'xlsx',
    type: 'binary'
  });

  return filename;
};

// Generate bulk campaign template (if needed in future)
export const generateBulkCampaignTemplate = (format = 'xlsx') => {
  const templateData = [
    ['Name', 'Phone', 'Message', 'Media_URL'],
    ['John Doe', '601123456789', 'Hello {{name}}, this is a test message!', ''],
    ['Jane Smith', '601987654321', 'Hi {{name}}, welcome to our service!', 'https://example.com/image.jpg'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // Set column widths
  ws['!cols'] = [
    { width: 20 }, // Name
    { width: 15 }, // Phone
    { width: 40 }, // Message
    { width: 30 }  // Media URL
  ];

  // Header styling
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "16A34A" } }, // Green background
    alignment: { horizontal: "center", vertical: "center" }
  };

  // Apply header styling
  ['A1', 'B1', 'C1', 'D1'].forEach(cell => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  XLSX.utils.book_append_sheet(wb, ws, "Bulk Campaign Template");

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `bulk_campaign_template_${timestamp}.${format}`;

  XLSX.writeFile(wb, filename, { 
    bookType: format === 'xls' ? 'xls' : 'xlsx',
    type: 'binary'
  });

  return filename;
};

// Validate uploaded Excel file structure
export const validateExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error('File is empty'));
          return;
        }
        
        // Check headers - support both English and Malay
        const headers = jsonData[0];
        
        const hasNameColumn = headers.some(h => {
          if (!h) return false;
          const headerText = h.toString().toLowerCase();
          return headerText.includes('name') || headerText.includes('nama');
        });
        
        const hasPhoneColumn = headers.some(h => {
          if (!h) return false;
          const headerText = h.toString().toLowerCase();
          return headerText.includes('phone') || headerText.includes('telefon') || headerText.includes('nombor');
        });
        
        const hasValidHeaders = hasNameColumn && hasPhoneColumn;
        
        if (!hasValidHeaders) {
          reject(new Error(`Invalid headers. Expected: Name/Nama, Phone/Telefon. Found: ${headers.join(', ')}`));
          return;
        }
        
        // Check if there's data beyond headers
        if (jsonData.length < 2) {
          reject(new Error('File must contain at least one data row'));
          return;
        }
        
        // Find column indices like backend
        const nameIndex = headers.findIndex(h => {
          if (!h) return false;
          const headerText = h.toString().toLowerCase();
          return headerText.includes('name') || headerText.includes('nama');
        });
        
        const phoneIndex = headers.findIndex(h => {
          if (!h) return false;
          const headerText = h.toString().toLowerCase();
          return headerText.includes('phone') || headerText.includes('telefon') || headerText.includes('nombor');
        });
        
        
        // Validate data rows
        const dataRows = jsonData.slice(1);
        const validRows = [];
        const errors = [];
        
        dataRows.forEach((row, index) => {
          const rowNumber = index + 2; // +2 because we start from row 2 (after header)
          
          if (!row[nameIndex] || !row[phoneIndex]) {
            errors.push(`Row ${rowNumber}: Missing name or phone`);
            return;
          }
          
          const name = row[nameIndex].toString().trim();
          const phone = row[phoneIndex].toString().trim();
          
          if (name.length === 0) {
            errors.push(`Row ${rowNumber}: Name is required`);
          }
          
          if (phone.length === 0) {
            errors.push(`Row ${rowNumber}: Phone is required`);
          }
          
          // Basic phone validation (Malaysian format)
          const cleanPhone = phone.replace(/[\s-+()]/g, '');
          if (!/^(60)?[1-9][0-9]{7,9}$/.test(cleanPhone)) {
            errors.push(`Row ${rowNumber}: Invalid phone format (${phone})`);
          }
          
          if (errors.length === 0 || errors.filter(e => e.includes(`Row ${rowNumber}`)).length === 0) {
            validRows.push({ name, phone: cleanPhone.startsWith('60') ? cleanPhone : '60' + cleanPhone });
          }
        });
        
        resolve({
          isValid: errors.length === 0,
          errors,
          validRows,
          totalRows: dataRows.length,
          validRowCount: validRows.length
        });
        
      } catch (error) {
        reject(new Error('Failed to read Excel file: ' + error.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Read Excel file and return structured data
export const readExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with first row as headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export default {
  generateContactTemplate,
  generateBulkCampaignTemplate,
  validateExcelFile,
  readExcelFile
};