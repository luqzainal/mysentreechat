const XLSX = require('xlsx');

/**
 * Process uploaded Excel file and extract contact data
 * @param {Buffer} fileBuffer - The uploaded file buffer
 * @param {string} originalName - Original filename
 * @returns {Object} Processed data with contacts array and validation results
 */
const processExcelFile = (fileBuffer, originalName) => {
  try {
    // Read the workbook from buffer
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Get the first worksheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('No worksheets found in the Excel file');
    }
    
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }
    
    // Extract headers
    const headers = jsonData[0];
    if (!headers || headers.length < 2) {
      throw new Error('Invalid Excel format. Expected at least Name and Phone columns.');
    }
    
    // Find column indices - support both English and Malay headers
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
    
    if (nameIndex === -1 || phoneIndex === -1) {
      throw new Error(`Required columns not found. Expected columns: Name/Nama, Phone/Telefon. Found headers: ${headers.join(', ')}`);
    }
    
    // Process data rows
    const dataRows = jsonData.slice(1); // Skip header row
    const processedContacts = [];
    const errors = [];
    
    dataRows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because we start from row 2 (after header)
      
      try {
        const name = row[nameIndex]?.toString()?.trim();
        const phone = row[phoneIndex]?.toString()?.trim();
        
        // Validate required fields
        if (!name || name.length === 0) {
          errors.push(`Row ${rowNumber}: Name is required`);
          return;
        }
        
        if (!phone || phone.length === 0) {
          errors.push(`Row ${rowNumber}: Phone is required`);
          return;
        }
        
        // Clean and validate phone number (Malaysian format)
        const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
        
        // Add country code if not present
        let formattedPhone = cleanPhone;
        if (!cleanPhone.startsWith('60')) {
          // Remove leading 0 if present, then add 60
          formattedPhone = '60' + cleanPhone.replace(/^0+/, '');
        }
        
        // Validate phone format (Malaysian)
        if (!/^60[1-9][0-9]{7,9}$/.test(formattedPhone)) {
          errors.push(`Row ${rowNumber}: Invalid phone format (${phone}). Expected Malaysian format.`);
          return;
        }
        
        // Check for duplicates in current batch
        const existingContact = processedContacts.find(c => c.phone === formattedPhone);
        if (existingContact) {
          errors.push(`Row ${rowNumber}: Duplicate phone number (${formattedPhone})`);
          return;
        }
        
        // Add valid contact
        processedContacts.push({
          name: name,
          phone: formattedPhone,
          originalPhone: phone,
          rowNumber: rowNumber
        });
        
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error.message}`);
      }
    });
    
    return {
      success: true,
      totalRows: dataRows.length,
      validContacts: processedContacts,
      errors: errors,
      summary: {
        total: dataRows.length,
        valid: processedContacts.length,
        invalid: errors.length,
        fileName: originalName
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      totalRows: 0,
      validContacts: [],
      errors: [error.message]
    };
  }
};

/**
 * Validate Excel file format and basic structure
 * @param {Buffer} fileBuffer - The uploaded file buffer
 * @returns {Object} Validation result
 */
const validateExcelStructure = (fileBuffer) => {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    if (workbook.SheetNames.length === 0) {
      return { isValid: false, error: 'No worksheets found' };
    }
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return { isValid: false, error: 'File must contain header row and at least one data row' };
    }
    
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
    
    if (!hasNameColumn || !hasPhoneColumn) {
      return { isValid: false, error: `Required columns missing. Expected: Name/Nama, Phone/Telefon. Found: ${headers.join(', ')}` };
    }
    
    return { isValid: true };
    
  } catch (error) {
    return { isValid: false, error: 'Invalid Excel file format' };
  }
};

/**
 * Generate sample Excel template
 * @returns {Buffer} Excel file buffer
 */
const generateTemplate = () => {
  const templateData = [
    ['Name', 'Phone'],
    ['John Doe', '601123456789'],
    ['Jane Smith', '601987654321'],
    ['Ahmad Rahman', '601234567890'],
    ['Siti Fatimah', '601112223333']
  ];
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  
  // Set column widths
  ws['!cols'] = [
    { width: 20 }, // Name column
    { width: 15 }  // Phone column
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, "Contact Template");
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  processExcelFile,
  validateExcelStructure,
  generateTemplate
};