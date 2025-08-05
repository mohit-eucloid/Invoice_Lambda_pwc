// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://of4ci3lab9.execute-api.us-east-1.amazonaws.com/dev',
    UPLOAD_ENDPOINT: '/upload',
    PROCESS_ENDPOINT: '/process'
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileUploadArea = document.getElementById('fileUploadArea');
const selectedFile = document.getElementById('selectedFile');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const processBtn = document.getElementById('processBtn');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');

// Screen elements
const welcomeScreen = document.getElementById('welcomeScreen');
const processingScreen = document.getElementById('processingScreen');
const errorScreen = document.getElementById('errorScreen');
const loadingState = document.getElementById('loadingState');
const extractedData = document.getElementById('extractedData');
const downloadSection = document.getElementById('downloadSection');

// PDF viewer elements
const pdfViewer = document.getElementById('pdfViewer');
const pdfFileName = document.getElementById('pdfFileName');

// Download buttons
const downloadJson = document.getElementById('downloadJson');
const downloadCsv = document.getElementById('downloadCsv');

// Error elements
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

// Global variables
let currentFile = null;
let extractionResults = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    checkEnvironment();
    initializeEventListeners();
});

function checkEnvironment() {
    // Check if we're running from file:// protocol
    if (window.location.protocol === 'file:') {
        console.warn('Running from file:// protocol. CORS issues may occur.');
        console.log('For best results, serve this app via HTTP server:');
        console.log('1. Python: python -m http.server 8000');
        console.log('2. Node.js: npx http-server -p 8000');
        console.log('3. PHP: php -S localhost:8000');
        
        // Show a warning message to the user
        showEnvironmentWarning();
    }
}

function showEnvironmentWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.innerHTML = `
        <div style="background: #fef3cd; border: 1px solid #faebcc; color: #8a6d3b; padding: 10px; margin: 10px; border-radius: 4px; font-size: 14px;">
            <strong>⚠️ Notice:</strong> For best compatibility, serve this app via HTTP server:
            <br><code>python -m http.server 8000</code> then open <code>http://localhost:8000</code>
        </div>
    `;
    document.body.insertBefore(warningDiv, document.body.firstChild);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const icon = sidebarToggle.querySelector('i');
    
    sidebar.classList.toggle('collapsed');
    
    if (sidebar.classList.contains('collapsed')) {
        icon.className = 'fas fa-chevron-right';
    } else {
        icon.className = 'fas fa-chevron-left';
    }
}

function initializeEventListeners() {
    // File upload events
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleDrop);
    
    // Remove file event
    removeFile.addEventListener('click', clearSelectedFile);
    
    // Process button event
    processBtn.addEventListener('click', processInvoice);
    
    // Download events
    downloadJson.addEventListener('click', () => downloadResults('json'));
    downloadCsv.addEventListener('click', () => downloadResults('csv'));
    
    // Retry button event
    retryBtn.addEventListener('click', showWelcomeScreen);
    
    // Sidebar toggle event
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Browse link click
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('browse-link')) {
            fileInput.click();
        }
    });
}

function handleDragOver(e) {
    e.preventDefault();
    fileUploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelection(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFileSelection(file);
    }
}

function handleFileSelection(file) {
    // Validate file type
    if (file.type !== 'application/pdf') {
        showError('Please select a PDF file only.');
        return;
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showError('File size must be less than 10MB.');
        return;
    }
    
    currentFile = file;
    
    // Update UI to show selected file
    fileName.textContent = file.name;
    fileUploadArea.style.display = 'none';
    selectedFile.style.display = 'flex';
    processBtn.disabled = false;
}

function clearSelectedFile() {
    currentFile = null;
    fileInput.value = '';
    
    // Reset UI
    fileUploadArea.style.display = 'block';
    selectedFile.style.display = 'none';
    processBtn.disabled = true;
}

function showWelcomeScreen() {
    welcomeScreen.style.display = 'flex';
    processingScreen.style.display = 'none';
    errorScreen.style.display = 'none';
    clearSelectedFile();
}

function showProcessingScreen() {
    welcomeScreen.style.display = 'none';
    processingScreen.style.display = 'block';
    errorScreen.style.display = 'none';
    
    // Show loading state
    loadingState.style.display = 'flex';
    extractedData.style.display = 'none';
    downloadSection.style.display = 'none';
    
    // Display PDF preview
    displayPdfPreview();
}

function showError(message) {
    errorMessage.textContent = message;
    welcomeScreen.style.display = 'none';
    processingScreen.style.display = 'none';
    errorScreen.style.display = 'flex';
}

function displayPdfPreview() {
    if (!currentFile) return;
    
    pdfFileName.textContent = currentFile.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const pdfData = e.target.result;
        pdfViewer.src = pdfData;
    };
    reader.readAsDataURL(currentFile);
}

async function processInvoice() {
    if (!currentFile) return;
    
    try {
        showProcessingScreen();
        
        // Step 1: Upload PDF
        const uploadResult = await uploadPdf(currentFile);
        
        if (!uploadResult.success) {
            throw new Error(uploadResult.message || 'Upload failed');
        }
        
        // Step 2: Process PDF
        const processResult = await processPdf(uploadResult.data);
        
        if (!processResult) {
            throw new Error('Processing failed');
        }
        
        // Step 3: Display results
        extractionResults = processResult;
        displayExtractionResults(processResult);
        
    } catch (error) {
        console.error('Processing error:', error);
        showError(error.message || 'An error occurred while processing the invoice.');
    }
}

async function uploadPdf(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const fileContent = btoa(e.target.result);
                
                const payload = {
                    file_content: fileContent,
                    filename: file.name,
                    content_type: 'application/pdf'
                };
                
                console.log('Attempting upload to:', `${API_CONFIG.BASE_URL}${API_CONFIG.UPLOAD_ENDPOINT}`);
                console.log('Payload size:', JSON.stringify(payload).length);
                
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.UPLOAD_ENDPOINT}`, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
                
                console.log('Upload response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Upload error response:', errorText);
                    throw new Error(`Upload failed: ${response.status} - ${response.statusText}\n${errorText}`);
                }
                
                const result = await response.json();
                console.log('Upload success:', result);
                resolve(result);
                
            } catch (error) {
                console.error('Upload error:', error);
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsBinaryString(file);
    });
}

async function processPdf(uploadData) {
    const payload = {
        api_key : "AIzaSyDFE1dtBB918ToieGI-fSF5EvS0IMGjYN4",
        s3_bucket: uploadData.s3_bucket,
        s3_key: uploadData.s3_key,
        custom_prompt: `
        I want you to carefully examine each invoice document and extract the key information following these steps:

1. First, identify the type of document (e.g., tax invoice, freight invoice, etc.)

2. For each invoice, extract in this specific order:
   - Vendor information (company name, GSTIN, contact details)
   - Client information (name, GSTIN, address)
   - Invoice details (number, date, due date)
   - Service or product details (description, quantities, rates)
   - Financial information (taxable amount, GST breakdown, total amount)
   - Payment information (bank details, payment terms)

3. Pay special attention to:
   - Tax structures (CGST, SGST, IGST percentages)
   - Any special notes or terms mentioned
   - Different sections of the invoice (header, line items, summary)
   - Currency and units of measurement

4. For each key field, note the exact location on the document to help with future automation

5. Organize the extracted information in a clear, structured format that can be easily transferred to a database or spreadsheet

6. Flag any inconsistencies, unusual charges, or incomplete information

7. Compare common fields across invoices to identify any patterns or discrepancies

8. Summarize the key financial obligations and their timelines

9. Extract the information with 100 percent accuracy

10. Output all extracted information in the following JSON format:

{
  "invoice_metadata": {
    "invoice_type": "",
    "invoice_date": ""
  },
  "vendor_details": {
    "name": "",
    "gstin": "",
    "pan": "",
    "address": {
      "street": "",
      "city": "",
      "state": "",
      "pincode": "",
      "country": ""
    },
    "contact": {
      "email": "",
      "phone": "",
      "website": ""
    },
    "bank_details": {
      "bank_name": "",
      "account_number": "",
      "ifsc_code": "",
      "branch": ""
    }
  },
  "client_details": {
    "name": "",
    "gstin": "",
    "pan": "",
    "address": {
      "street": "",
      "city": "",
      "state": "",
      "pincode": "",
      "country": ""
    },
    "contact": {
      "email": "",
      "phone": ""
    }
  },
  "invoice_details": {
    "invoice_number": "",
    "invoice_date": "",
    "due_date": "",
    "place_of_supply": "",
    "irn_number": "",
    "ack_number": "",
    "ack_date": "",
    "shipping_details": {
      "dispatch_mode": "",
      "tracking_number": "",
      "dispatch_date": "",
      "destination": ""
    }
  },
  "line_items": [
    {
      "item_number": "",
      "description": "",
      "hsn_sac_code": "",
      "quantity": "",
      "unit": "",
      "rate": "",
      "discount_percentage": "",
      "taxable_value": ""
    }
  ],
  "tax_details": {
    "cgst": {
      "rate": "",
      "amount": ""
    },
    "sgst": {
      "rate": "",
      "amount": ""
    },
    "igst": {
      "rate": "",
      "amount": ""
    },
    "total_tax_amount": ""
  },
  "payment_summary": {
    "taxable_value": "",
    "additional_charges": [
      {
        "description": "",
        "amount": ""
      }
    ],
    "discount": "",
    "roundoff": "",
    "total_invoice_value": "",
    "total_invoice_value_in_words": "",
    "amount_due": "",
    "payment_terms": "",
    "payment_status": ""
  },
  "qr_details": {
    "payment_qr": "",
    "government_qr": ""
  }
}

## Important Note:

Please follow the exact output format.`
,
        temperature: 0.0,
        output_format: "json"
    };
    
    console.log('Attempting processing with:', payload);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.PROCESS_ENDPOINT}`, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });
    
    console.log('Process response status:', response.status);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Process error response:', errorText);
        throw new Error(`Processing failed: ${response.status} - ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.text();
    console.log('Process response:', result);
    
    try {
        return JSON.parse(result);
    } catch (e) {
        // If it's not valid JSON, return as string
        return result;
    }
}

function displayExtractionResults(data) {
    try {
        // Hide loading state
        loadingState.style.display = 'none';
        extractedData.style.display = 'block';
        downloadSection.style.display = 'block';
        
        // Clear previous results
        extractedData.innerHTML = '';
        
        if (typeof data === 'string') {
            // Handle raw text response
            extractedData.innerHTML = `
                <div class="data-section">
                    <div class="section-title">
                        <i class="fas fa-file-alt"></i>
                        Raw Output
                    </div>
                    <pre style="background: #f8fafc; padding: 1rem; border-radius: 8px; white-space: pre-wrap; font-size: 0.875rem;">${data}</pre>
                </div>
            `;
        } else if (Array.isArray(data)) {
            // Handle array response (flattened data)
            displayFlattenedData(data);
        } else {
            // Handle structured JSON response
            displayStructuredData(data);
        }
        
    } catch (error) {
        console.error('Error displaying results:', error);
        showError('Failed to display extraction results.');
    }
}

function displayFlattenedData(data) {
    console.log('Displaying flattened array data:', data);
    
    if (!Array.isArray(data) || data.length === 0) {
        extractedData.innerHTML = '<div class="data-section"><div class="section-title">⚠️ No Data Found</div></div>';
        return;
    }
    
    // Group data by sections based on field names
    const invoiceData = data[0]; // Assuming first object contains all data
    const sections = groupDataIntoSections(invoiceData);
    
    // Display each section
    Object.entries(sections).forEach(([sectionName, sectionData]) => {
        if (Object.keys(sectionData).length > 0) {
            const sectionHtml = createFlattenedSection(sectionName, sectionData);
            extractedData.innerHTML += sectionHtml;
        }
    });
}

function groupDataIntoSections(data) {
    const sections = {
        'invoice_info': {},
        'vendor_info': {},
        'buyer_info': {},
        'line_items': {},
        'tax_info': {},
        'bank_info': {}
    };
    
    // Define field mappings
    const fieldMappings = {
        'invoice_info': ['IRN', 'Ack No.', 'Ack Date', 'Invoice No.', 'Dated', 'Reference No. & Date.', 'Buyer\'s Order No.', 'Dispatch Doc No.', 'Delivery Note Date', 'Dispatched through', 'Destination', 'Bill of Lading/LR-RR No.', 'Motor Vehicle No.', 'Terms of Delivery'],
        'buyer_info': ['Consignee (Ship to)', 'Buyer (Bill to)', 'GSTIN/UIN', 'State Name', 'Code'],
        'line_items': ['Sl No. & Kind', 'Description of Goods and Services', 'HSN/SAC', 'GST Rate', 'Quantity', 'Rate', 'Amount'],
        'tax_info': ['Taxable Value', 'IGST Rate', 'IGST Amount', 'Total Tax Amount', 'Tax Amount (in words)', 'COURIER CHARGES', 'IGST', 'ROUNDED OFF', 'Total'],
        'bank_info': ['Company\'s PAN', 'A/c Holder\'s Name', 'Bank Name', 'A/c No.', 'Branch & IFS Code']
    };
    
    // Group fields into sections
    Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        
        let assigned = false;
        Object.entries(fieldMappings).forEach(([sectionKey, fields]) => {
            if (fields.some(field => key.includes(field) || field.includes(key))) {
                sections[sectionKey][key] = value;
                assigned = true;
            }
        });
        
        // If not assigned to any section, put in invoice_info
        if (!assigned) {
            sections['invoice_info'][key] = value;
        }
    });
    
    return sections;
}

function createFlattenedSection(sectionName, sectionData) {
    const sectionTitles = {
        'invoice_info': '📄 Invoice Information',
        'vendor_info': '🏢 Vendor Information',
        'buyer_info': '👤 Buyer Information',
        'line_items': '📝 Line Items',
        'tax_info': '🧮 Tax Information',
        'bank_info': '🏦 Bank Information'
    };
    
    const title = sectionTitles[sectionName] || formatFieldName(sectionName);
    
    return `
        <div class="expandable-section">
            <div class="expandable-header" onclick="toggleSection(this)">
                ${title}
                <i class="fas fa-chevron-down" style="margin-left: auto; transition: transform 0.3s;"></i>
            </div>
            <div class="expandable-content">
                ${createTableFromObject(sectionData)}
            </div>
        </div>
    `;
}

function displayStructuredData(data) {
    console.log('Displaying structured data:', data);
    
    const sections = [
        { key: 'invoice_metadata', title: '📋 Invoice Metadata', icon: 'fas fa-info-circle' },
        { key: 'vendor_details', title: '🏢 Vendor Details', icon: 'fas fa-building' },
        { key: 'client_details', title: '👤 Client Details', icon: 'fas fa-user' },
        { key: 'invoice_details', title: '📄 Invoice Details', icon: 'fas fa-file-invoice' },
        { key: 'line_items', title: '📝 Line Items', icon: 'fas fa-list' },
        { key: 'tax_details', title: '🧮 Tax Details', icon: 'fas fa-calculator' },
        { key: 'payment_summary', title: '💳 Payment Summary', icon: 'fas fa-credit-card' },
        { key: 'qr_details', title: '📱 QR Details', icon: 'fas fa-qrcode' }
    ];
    
    let hasAnyData = false;
    
    sections.forEach(section => {
        if (data[section.key] && hasNonEmptyData(data[section.key])) {
            const sectionHtml = createStreamlitSection(section, data[section.key]);
            extractedData.innerHTML += sectionHtml;
            hasAnyData = true;
        }
    });
    
    // If no structured data found, show all available data
    if (!hasAnyData) {
        console.log('No structured sections found, showing all data');
        extractedData.innerHTML = '<div class="expandable-section"><div class="expandable-header" onclick="toggleSection(this)">📊 Extracted Data <i class="fas fa-chevron-down" style="margin-left: auto;"></i></div><div class="expandable-content">' + 
                                 createTableFromObject(data) + '</div></div>';
    }
}

function hasNonEmptyData(obj) {
    if (Array.isArray(obj)) {
        return obj.length > 0 && obj.some(item => hasNonEmptyData(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some(value => {
            if (typeof value === 'string') return value.trim() !== '';
            if (typeof value === 'object') return hasNonEmptyData(value);
            return value !== null && value !== undefined;
        });
    }
    return obj !== null && obj !== undefined && obj !== '';
}

function createStreamlitSection(section, data) {
    let html = `
        <div class="expandable-section">
            <div class="expandable-header" onclick="toggleSection(this)">
                <i class="${section.icon}"></i>
                ${section.title}
                <i class="fas fa-chevron-down" style="margin-left: auto; transition: transform 0.3s;"></i>
            </div>
            <div class="expandable-content">
    `;
    
    if (Array.isArray(data)) {
        // Handle arrays (like line_items)
        data.forEach((item, index) => {
            if (hasNonEmptyData(item)) {
                html += `<h5 style="margin: 1rem 0 0.5rem 0; color: #262730; font-weight: 600;">Item ${index + 1}</h5>`;
                html += createTableFromObject(item);
            }
        });
    } else if (typeof data === 'object') {
        // Handle objects
        html += createNestedStreamlitObject(data);
    }
    
    html += '</div></div>';
    return html;
}

function createNestedStreamlitObject(obj, level = 0) {
    let html = '';
    
    // Separate simple fields from nested objects
    const simpleFields = {};
    const nestedObjects = {};
    
    Object.entries(obj).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        
        if (typeof value === 'object' && !Array.isArray(value)) {
            if (hasNonEmptyData(value)) {
                nestedObjects[key] = value;
            }
        } else if (Array.isArray(value)) {
            if (value.length > 0) {
                nestedObjects[key] = value;
            }
        } else {
            simpleFields[key] = value;
        }
    });
    
    // Display simple fields in a table
    if (Object.keys(simpleFields).length > 0) {
        html += createTableFromObject(simpleFields);
    }
    
    // Display nested objects as sub-expandables
    Object.entries(nestedObjects).forEach(([key, value]) => {
        const title = formatFieldName(key);
        
        if (Array.isArray(value)) {
            html += `<div class="nested-expandable" style="margin-left: 1rem;">`;
            html += `<h5 style="color: #495057; font-weight: 600; margin: 1rem 0 0.5rem 0;">${title}</h5>`;
            value.forEach((item, index) => {
                if (hasNonEmptyData(item)) {
                    html += `<div style="margin-left: 1rem;">`;
                    html += `<h6 style="color: #6c757d; margin: 0.5rem 0;">Item ${index + 1}</h6>`;
                    html += createTableFromObject(item);
                    html += `</div>`;
                }
            });
            html += `</div>`;
        } else {
            html += `<div class="nested-expandable" style="margin-left: 1rem;">`;
            html += `<h5 style="color: #495057; font-weight: 600; margin: 1rem 0 0.5rem 0;">${title}</h5>`;
            html += createNestedStreamlitObject(value, level + 1);
            html += `</div>`;
        }
    });
    
    return html;
}

// Add toggle functionality for expandable sections
function toggleSection(header) {
    const content = header.nextElementSibling;
    const chevron = header.querySelector('.fa-chevron-down');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
    }
}

function createTableFromObject(obj) {
    const rows = Object.entries(obj)
        .filter(([key, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => {
            const fieldName = formatFieldName(key);
            let displayValue;
            
            // Handle different value types properly
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    // Handle arrays
                    displayValue = value.length > 0 ? 
                        value.map(item => typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)).join('<br>') :
                        'No items';
                } else {
                    // Handle objects - display as formatted JSON or key-value pairs
                    const objEntries = Object.entries(value)
                        .filter(([k, v]) => v !== null && v !== undefined && v !== '')
                        .map(([k, v]) => `<strong>${formatFieldName(k)}:</strong> ${String(v)}`)
                        .join('<br>');
                    displayValue = objEntries || 'No data';
                }
            } else {
                // Handle primitive values
                displayValue = String(value).replace(/\n/g, '<br>');
            }
            
            return `
                <tr>
                    <td><strong>${fieldName}</strong></td>
                    <td>${displayValue}</td>
                </tr>
            `;
        })
        .join('');
    
    if (rows === '') return '';
    
    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Field</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function formatFieldName(str) {
    return str
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function downloadResults(format) {
    if (!extractionResults) return;
    
    const filename = currentFile ? 
        `${currentFile.name.replace('.pdf', '')}_data.${format}` : 
        `invoice_data.${format}`;
    
    if (format === 'json') {
        const jsonData = JSON.stringify(extractionResults, null, 2);
        downloadFile(jsonData, filename, 'application/json');
    } else if (format === 'csv') {
        const csvData = convertToCsv(extractionResults);
        downloadFile(csvData, filename, 'text/csv');
    }
}

function convertToCsv(data) {
    const rows = [];
    rows.push(['Field', 'Value']); // Header
    
    function flattenObject(obj, prefix = '') {
        Object.entries(obj).forEach(([key, value]) => {
            const fieldName = prefix ? `${prefix}.${key}` : key;
            
            if (value === null || value === undefined || value === '') {
                return;
            }
            
            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (typeof item === 'object') {
                        flattenObject(item, `${fieldName}[${index}]`);
                    } else {
                        rows.push([`${fieldName}[${index}]`, String(item)]);
                    }
                });
            } else if (typeof value === 'object') {
                flattenObject(value, fieldName);
            } else {
                rows.push([fieldName, String(value)]);
            }
        });
    }
    
    if (typeof data === 'object') {
        flattenObject(data);
    } else {
        rows.push(['Raw Output', String(data)]);
    }
    
    return rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}