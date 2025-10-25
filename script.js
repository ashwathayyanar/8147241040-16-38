// Global variables
let currentData = null;
let rfmData = null;
let segmentData = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    // File upload
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);
    document.getElementById('load-url-btn').addEventListener('click', handleUrlLoad);
    document.getElementById('analyze-btn').addEventListener('click', analyzeData);
    document.getElementById('download-btn').addEventListener('click', downloadResults);
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading('Reading file...');
    try {
        console.log('File selected:', file.name, file.type);
        
        let data;
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            data = await readExcelFile(file);
        } else {
            data = await readCSVFile(file);
        }
        
        console.log('Data loaded:', data);
        processUploadedData(data, file.name);
    } catch (error) {
        console.error('Error reading file:', error);
        showError('Error reading file: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function readCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                console.log('CSV content loaded');
                const result = Papa.parse(e.target.result, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    transform: (value) => {
                        // Handle empty values
                        if (value === '' || value === null || value === undefined) return null;
                        return value;
                    }
                });
                
                console.log('Parsed CSV data:', result);
                
                if (result.errors.length > 0) {
                    console.warn('CSV parsing warnings:', result.errors);
                }
                
                resolve(result.data.filter(row => {
                    // Filter out completely empty rows
                    return Object.values(row).some(value => value !== null && value !== '');
                }));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

async function readExcelFile(file) {
    // For Excel files, we'll use a simple approach since we can't use external libraries easily
    // We'll convert Excel to CSV using SheetJS CDN
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // If SheetJS is available, use it
                if (typeof XLSX !== 'undefined') {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // Convert to proper format with headers
                    const headers = jsonData[0];
                    const rows = jsonData.slice(1);
                    const result = rows.map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index] !== undefined ? row[index] : null;
                        });
                        return obj;
                    });
                    
                    resolve(result.filter(row => Object.values(row).some(val => val !== null)));
                } else {
                    // Fallback: ask user to convert to CSV
                    reject(new Error('Excel files require additional libraries. Please convert to CSV or install SheetJS.'));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read Excel file'));
        reader.readAsArrayBuffer(file);
    });
}

// Add SheetJS library dynamically for Excel support
function loadSheetJS() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Excel parser'));
        document.head.appendChild(script);
    });
}

async function handleUrlLoad() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) {
        showError('Please enter a URL');
        return;
    }

    showLoading('Loading data from URL...');
    try {
        console.log('Loading from URL:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch data: ' + response.status);
        
        const contentType = response.headers.get('content-type');
        console.log('Content type:', contentType);
        
        let data;
        if (url.includes('.xlsx') || url.includes('.xls') || contentType.includes('spreadsheet')) {
            // For Excel files from URL
            const buffer = await response.arrayBuffer();
            if (typeof XLSX === 'undefined') {
                await loadSheetJS();
            }
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            data = XLSX.utils.sheet_to_json(worksheet);
        } else {
            // For CSV files
            const text = await response.text();
            data = Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            }).data;
        }
        
        console.log('Data loaded from URL:', data);
        processUploadedData(data, 'URL Dataset');
    } catch (error) {
        console.error('Error loading from URL:', error);
        showError('Error loading from URL: ' + error.message);
    } finally {
        hideLoading();
    }
}

function processUploadedData(data, filename) {
    console.log('Processing uploaded data:', data);
    
    if (!data || data.length === 0) {
        showError('No valid data found in file. Please check the file format.');
        return;
    }

    // Clean the data - remove empty rows and handle missing values
    const cleanData = data.filter(row => {
        return row && Object.keys(row).length > 0 && Object.values(row).some(val => 
            val !== null && val !== undefined && val !== ''
        );
    });

    if (cleanData.length === 0) {
        showError('No valid data rows found after cleaning.');
        return;
    }

    currentData = cleanData;
    
    // Show file info
    document.getElementById('file-info').innerHTML = `
        <strong>File:</strong> ${filename}<br>
        <strong>Rows:</strong> ${cleanData.length}<br>
        <strong>Columns:</strong> ${Object.keys(cleanData[0]).join(', ')}<br>
        <strong>First row preview:</strong> ${JSON.stringify(cleanData[0])}
    `;

    // Populate column selectors
    populateColumnSelectors(cleanData[0]);
    
    // Show configuration section
    document.querySelector('.config-section').style.display = 'block';
    document.getElementById('welcome-section').style.display = 'none';
    
    // Show data preview
    showDataPreview(cleanData);
}

function showDataPreview(data) {
    const preview = data.slice(0, 5); // Show first 5 rows
    let previewHTML = '<div class="data-preview"><h4>Data Preview (First 5 rows):</h4><table>';
    
    // Headers
    previewHTML += '<thead><tr>';
    Object.keys(data[0]).forEach(key => {
        previewHTML += `<th>${key}</th>`;
    });
    previewHTML += '</tr></thead><tbody>';
    
    // Rows
    preview.forEach(row => {
        previewHTML += '<tr>';
        Object.values(row).forEach(value => {
            previewHTML += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
        });
        previewHTML += '</tr>';
    });
    
    previewHTML += '</tbody></table></div>';
    
    // Add preview to file info
    document.getElementById('file-info').innerHTML += previewHTML;
}

function populateColumnSelectors(firstRow) {
    const columns = Object.keys(firstRow);
    console.log('Available columns:', columns);
    
    const selects = ['customer-col', 'date-col', 'quantity-col', 'price-col'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select column...</option>';
        
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });
        
        // Auto-select common column names with fuzzy matching
        autoSelectColumn(selectId, columns);
    });
}

function autoSelectColumn(selectId, columns) {
    const select = document.getElementById(selectId);
    const patterns = {
        'customer-col': ['customer', 'cust', 'client', 'id', 'customerid', 'customer_id'],
        'date-col': ['date', 'time', 'invoice', 'order', 'created', 'timestamp'],
        'quantity-col': ['quantity', 'qty', 'amount', 'units', 'number', 'count'],
        'price-col': ['price', 'cost', 'unitprice', 'unit_price', 'amount', 'value']
    };
    
    const patternsForSelect = patterns[selectId] || [];
    
    for (const pattern of patternsForSelect) {
        const matchingCol = columns.find(col => 
            col.toLowerCase().includes(pattern.toLowerCase())
        );
        if (matchingCol) {
            select.value = matchingCol;
            console.log(`Auto-selected ${matchingCol} for ${selectId}`);
            break;
        }
    }
}

function analyzeData() {
    if (!currentData) {
        showError('No data loaded. Please upload a file first.');
        return;
    }

    const config = {
        customerCol: document.getElementById('customer-col').value,
        dateCol: document.getElementById('date-col').value,
        quantityCol: document.getElementById('quantity-col').value,
        priceCol: document.getElementById('price-col').value
    };

    console.log('Analysis config:', config);

    // Validate configuration
    if (!config.customerCol) {
        showError('Please select Customer ID column');
        return;
    }
    
    if (!config.dateCol) {
        showError('Please select Date column');
        return;
    }

    showLoading('Analyzing data...');
    
    // Process data in chunks to avoid blocking UI
    setTimeout(() => {
        try {
            console.log('Starting data preprocessing...');
            const processedData = preprocessData(currentData, config);
            console.log('Data preprocessing completed:', processedData.length, 'rows');
            
            console.log('Calculating RFM...');
            rfmData = calculateRFM(processedData, config);
            console.log('RFM calculation completed:', rfmData.length, 'customers');
            
            console.log('Performing segmentation...');
            segmentData = performSegmentation(rfmData);
            console.log('Segmentation completed');
            
            displayResults();
            document.getElementById('results-section').style.display = 'block';
            
            // Scroll to results
            document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Analysis error:', error);
            showError('Analysis error: ' + error.message);
        } finally {
            hideLoading();
        }
    }, 100);
}

function preprocessData(data, config) {
    console.log('Preprocessing data with config:', config);
    
    const processed = data.filter(row => {
        // Remove rows with missing customer IDs
        if (!row[config.customerCol] || row[config.customerCol] === '') {
            console.log('Removing row with missing customer ID:', row);
            return false;
        }
        
        // Remove negative quantities and prices if columns exist
        if (config.quantityCol && row[config.quantityCol] < 0) {
            return false;
        }
        if (config.priceCol && row[config.priceCol] < 0) {
            return false;
        }
        
        return true;
    }).map(row => {
        const processed = { ...row };
        
        // Calculate total amount
        if (config.quantityCol && config.priceCol) {
            const quantity = parseFloat(row[config.quantityCol]) || 0;
            const price = parseFloat(row[config.priceCol]) || 0;
            processed.TotalAmount = quantity * price;
        } else {
            processed.TotalAmount = 1; // Default value for frequency analysis
        }
        
        // Parse date
        if (config.dateCol && row[config.dateCol]) {
            try {
                processed.InvoiceDate = new Date(row[config.dateCol]);
                if (isNaN(processed.InvoiceDate.getTime())) {
                    console.warn('Invalid date:', row[config.dateCol]);
                    processed.InvoiceDate = new Date(); // Fallback to current date
                }
            } catch (error) {
                console.warn('Date parsing error:', error);
                processed.InvoiceDate = new Date(); // Fallback to current date
            }
        } else {
            processed.InvoiceDate = new Date(); // Fallback to current date
        }
        
        return processed;
    });
    
    console.log('Preprocessed data sample:', processed.slice(0, 3));
    return processed;
}

// ... rest of the functions remain the same (calculateRFM, performSegmentation, displayResults, etc.)

// Enhanced error handling and loading functions
function showLoading(message) {
    // Create a loading overlay
    let loadingDiv = document.getElementById('loading-overlay');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-overlay';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            font-size: 18px;
        `;
        document.body.appendChild(loadingDiv);
    }
    
    loadingDiv.innerHTML = `
        <div style="text-align: center;">
            <div class="loading" style="width: 40px; height: 40px; margin: 0 auto 20px;"></div>
            <div>${message}</div>
        </div>
    `;
    loadingDiv.style.display = 'flex';
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

function showError(message) {
    // Create a nice error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e74c3c;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
    `;
    errorDiv.innerHTML = `
        <strong>Error:</strong> ${message}
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; margin-left: 10px; cursor: pointer;">×</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// Add CSS for data preview
const style = document.createElement('style');
style.textContent = `
    .data-preview {
        margin-top: 15px;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 10px;
        background: #f9f9f9;
    }
    
    .data-preview table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
    }
    
    .data-preview th, .data-preview td {
        border: 1px solid #ddd;
        padding: 5px;
        text-align: left;
    }
    
    .data-preview th {
        background: #3498db;
        color: white;
    }
    
    .data-preview tr:nth-child(even) {
        background: #f2f2f2;
    }
`;
document.head.appendChild(style);
