// Global variables
let currentData = null;
let rfmData = null;
let segmentData = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);
    document.getElementById('load-url-btn').addEventListener('click', handleUrlLoad);
    document.getElementById('analyze-btn').addEventListener('click', analyzeData);
    document.getElementById('download-btn').addEventListener('click', downloadResults);
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    
    showLoading('Reading file...');
    
    try {
        let data;
        
        if (file.name.includes('.xlsx') || file.name.includes('.xls')) {
            console.log('Processing Excel file...');
            data = await readExcelFile(file);
        } else {
            console.log('Processing CSV file...');
            data = await readCSVFile(file);
        }
        
        console.log('Data loaded successfully:', data.length, 'rows');
        
        if (!data || data.length === 0) {
            throw new Error('No data found in file');
        }

        processUploadedData(data, file.name);
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error reading file: ' + error.message);
    } finally {
        hideLoading();
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // Load SheetJS if not available
                if (typeof XLSX === 'undefined') {
                    loadSheetJS().then(() => {
                        processExcelData(e.target.result, resolve, reject);
                    }).catch(reject);
                } else {
                    processExcelData(e.target.result, resolve, reject);
                }
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function processExcelData(arrayBuffer, resolve, reject) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('Excel sheet processed:', data.length, 'rows');
        resolve(data);
    } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + error.message));
    }
}

function readCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const result = Papa.parse(e.target.result, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    transform: (value) => {
                        if (value === '' || value === null || value === undefined) return null;
                        return value;
                    }
                });
                
                if (result.errors.length > 0) {
                    console.warn('CSV parsing warnings:', result.errors);
                }
                
                const cleanData = result.data.filter(row => 
                    Object.values(row).some(val => val !== null && val !== '')
                );
                
                console.log('CSV processed:', cleanData.length, 'rows');
                resolve(cleanData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
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
        
        let data;
        if (url.includes('.xlsx') || url.includes('.xls')) {
            data = await loadExcelFromUrl(url);
        } else {
            data = await loadCSVFromUrl(url);
        }
        
        console.log('Data loaded from URL:', data.length, 'rows');
        processUploadedData(data, 'URL Dataset');
        
    } catch (error) {
        console.error('Error loading from URL:', error);
        showError('Error loading from URL: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function loadExcelFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch: ' + response.status);
    
    const arrayBuffer = await response.arrayBuffer();
    
    if (typeof XLSX === 'undefined') {
        await loadSheetJS();
    }
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet);
}

async function loadCSVFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch: ' + response.status);
    
    const text = await response.text();
    const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    });
    
    return result.data.filter(row => 
        Object.values(row).some(val => val !== null && val !== '')
    );
}

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

function processUploadedData(data, filename) {
    console.log('Processing uploaded data:', data.length, 'rows');
    
    if (!data || data.length === 0) {
        showError('No valid data found in file');
        return;
    }

    currentData = data;
    
    // Show file info
    document.getElementById('file-info').innerHTML = `
        <div style="color: green; font-weight: bold;">
            ✅ ${filename} uploaded successfully!<br>
            <strong>Rows:</strong> ${data.length}<br>
            <strong>Columns:</strong> ${Object.keys(data[0]).join(', ')}
        </div>
    `;

    // Show data preview
    showDataPreview(data);
    
    // Auto-fill column selectors
    populateColumnSelectors(data[0]);
    
    // Show configuration section
    document.querySelector('.config-section').style.display = 'block';
    document.getElementById('welcome-section').style.display = 'none';
}

function showDataPreview(data) {
    const preview = data.slice(0, 3);
    const headers = Object.keys(data[0]);
    
    let html = '<div style="margin-top: 15px; border: 1px solid #ccc; padding: 15px; background: #f9f9f9; border-radius: 5px;">';
    html += '<strong>📊 Data Preview (first 3 rows):</strong><br><br>';
    
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    
    // Headers
    html += '<tr style="background: #3498db; color: white;">';
    headers.forEach(header => {
        html += `<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">${header}</th>`;
    });
    html += '</tr>';
    
    // Data rows
    preview.forEach(row => {
        html += '<tr>';
        headers.forEach(header => {
            const value = row[header];
            const displayValue = (value === null || value === undefined) ? '' : 
                               String(value).substring(0, 50); // Limit length
            html += `<td style="padding: 6px; border: 1px solid #ddd; background: white;">${displayValue}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</table>';
    html += '</div>';
    
    document.getElementById('file-info').innerHTML += html;
}

function populateColumnSelectors(firstRow) {
    const columns = Object.keys(firstRow);
    console.log('Available columns:', columns);
    
    // Clear and populate all selectors
    ['customer-col', 'date-col', 'amount-col'].forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select column...</option>';
        
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });
    });
    
    // Auto-detect columns
    autoDetectColumns(columns);
}

function autoDetectColumns(columns) {
    console.log('Auto-detecting columns from:', columns);
    
    const customerPatterns = ['customer', 'cust', 'id', 'client', 'user', 'member'];
    const datePatterns = ['date', 'time', 'invoice', 'order', 'created', 'purchase'];
    const amountPatterns = ['amount', 'price', 'value', 'total', 'cost', 'revenue', 'sales', 'quantity', 'qty'];
    
    columns.forEach(col => {
        const colLower = col.toLowerCase();
        
        // Customer ID
        if (customerPatterns.some(pattern => colLower.includes(pattern))) {
            document.getElementById('customer-col').value = col;
        }
        
        // Date
        if (datePatterns.some(pattern => colLower.includes(pattern))) {
            document.getElementById('date-col').value = col;
        }
        
        // Amount
        if (amountPatterns.some(pattern => colLower.includes(pattern))) {
            document.getElementById('amount-col').value = col;
        }
    });
    
    // Fallback: select first available columns
    if (!document.getElementById('customer-col').value && columns.length > 0) {
        document.getElementById('customer-col').value = columns[0];
    }
    if (!document.getElementById('date-col').value && columns.length > 1) {
        document.getElementById('date-col').value = columns[1];
    }
    if (!document.getElementById('amount-col').value && columns.length > 2) {
        document.getElementById('amount-col').value = columns[2];
    }
}

function analyzeData() {
    if (!currentData) {
        showError('No data loaded. Please upload a file first.');
        return;
    }

    const customerCol = document.getElementById('customer-col').value;
    const dateCol = document.getElementById('date-col').value;
    const amountCol = document.getElementById('amount-col').value;

    if (!customerCol) {
        showError('Please select Customer ID column');
        return;
    }

    console.log('Starting analysis with:', { customerCol, dateCol, amountCol });

    showLoading('Analyzing data...');
    
    setTimeout(() => {
        try {
            // Process the data
            const processedData = processData(currentData, customerCol, dateCol, amountCol);
            console.log('Processed data:', processedData.length, 'rows');
            
            // Calculate RFM
            rfmData = calculateRFM(processedData, customerCol, dateCol, amountCol);
            console.log('RFM data:', rfmData.length, 'customers');
            
            // Perform segmentation
            segmentData = performSegmentation(rfmData);
            console.log('Segmentation completed');
            
            // Display results
            displayResults(segmentData);
            
            // Show results section
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

function processData(data, customerCol, dateCol, amountCol) {
    return data.map(row => {
        const processed = {
            CustomerID: String(row[customerCol] || 'Unknown').trim(),
            InvoiceDate: dateCol ? parseDate(row[dateCol]) : new Date(),
            Amount: amountCol ? parseFloat(row[amountCol]) || 0 : 1
        };
        return processed;
    }).filter(row => row.CustomerID && row.CustomerID !== 'Unknown' && row.CustomerID !== '');
}

function parseDate(dateValue) {
    if (!dateValue) return new Date();
    
    try {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
        return new Date();
    }
}

function calculateRFM(data, customerCol, dateCol, amountCol) {
    const referenceDate = new Date(Math.max(...data.map(row => row.InvoiceDate.getTime())));
    referenceDate.setDate(referenceDate.getDate() + 1);
    
    const customerMap = {};
    
    data.forEach(row => {
        const customerId = row.CustomerID;
        if (!customerMap[customerId]) {
            customerMap[customerId] = {
                lastDate: row.InvoiceDate,
                frequency: 0,
                monetary: 0
            };
        }
        
        customerMap[customerId].frequency++;
        customerMap[customerId].monetary += row.Amount;
        if (row.InvoiceDate > customerMap[customerId].lastDate) {
            customerMap[customerId].lastDate = row.InvoiceDate;
        }
    });
    
    const rfm = [];
    for (const [customerId, stats] of Object.entries(customerMap)) {
        const recency = Math.floor((referenceDate - stats.lastDate) / (1000 * 60 * 60 * 24));
        rfm.push({
            CustomerID: customerId,
            Recency: recency,
            Frequency: stats.frequency,
            Monetary: stats.monetary
        });
    }
    
    return rfm;
}

function performSegmentation(rfmData) {
    // Simple segmentation based on percentiles
    const recencies = rfmData.map(c => c.Recency);
    const frequencies = rfmData.map(c => c.Frequency);
    const monetaries = rfmData.map(c => c.Monetary);
    
    const recencyThresholds = calculatePercentiles(recencies, [0.25, 0.5, 0.75]);
    const frequencyThresholds = calculatePercentiles(frequencies, [0.25, 0.5, 0.75]);
    const monetaryThresholds = calculatePercentiles(monetaries, [0.25, 0.5, 0.75]);
    
    return rfmData.map(customer => {
        const segment = calculateSegment(
            customer.Recency, customer.Frequency, customer.Monetary,
            recencyThresholds, frequencyThresholds, monetaryThresholds
        );
        return {
            ...customer,
            Segment: segment
        };
    });
}

function calculatePercentiles(data, percentiles) {
    const sorted = [...data].sort((a, b) => a - b);
    return percentiles.map(p => {
        const index = Math.floor(p * (sorted.length - 1));
        return sorted[index];
    });
}

function calculateSegment(recency, frequency, monetary, recencyThresholds, frequencyThresholds, monetaryThresholds) {
    let score = 0;
    
    // Recency: lower is better (reverse scoring)
    if (recency <= recencyThresholds[0]) score += 3; // Top 25%
    else if (recency <= recencyThresholds[1]) score += 2; // 25-50%
    else if (recency <= recencyThresholds[2]) score += 1; // 50-75%
    // Bottom 25% gets 0
    
    // Frequency: higher is better
    if (frequency >= frequencyThresholds[2]) score += 3; // Top 25%
    else if (frequency >= frequencyThresholds[1]) score += 2; // 25-50%
    else if (frequency >= frequencyThresholds[0]) score += 1; // 50-75%
    // Bottom 25% gets 0
    
    // Monetary: higher is better
    if (monetary >= monetaryThresholds[2]) score += 3; // Top 25%
    else if (monetary >= monetaryThresholds[1]) score += 2; // 25-50%
    else if (monetary >= monetaryThresholds[0]) score += 1; // 50-75%
    // Bottom 25% gets 0
    
    // Assign segments based on total score (max 9)
    if (score >= 7) return 'Platinum';
    if (score >= 5) return 'Gold';
    if (score >= 3) return 'Silver';
    return 'Bronze';
}

function displayResults(segments) {
    // Update metrics
    document.getElementById('total-customers').textContent = segments.length.toLocaleString();
    document.getElementById('total-revenue').textContent = 
        '$' + segments.reduce((sum, c) => sum + c.Monetary, 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    document.getElementById('avg-frequency').textContent = 
        (segments.reduce((sum, c) => sum + c.Frequency, 0) / segments.length).toFixed(1);
    
    // Create charts
    createRFMCharts(segments);
    createSegmentChart(segments);
    showSegmentTable(segments);
    showRecommendations(segments);
}

function createRFMCharts(segments) {
    // Recency Distribution
    createHistogramChart('recency-chart', segments.map(s => s.Recency), 
        'Recency Distribution', 'Days since last purchase', 'Number of customers', 20);
    
    // Frequency Distribution
    createHistogramChart('frequency-chart', segments.map(s => s.Frequency), 
        'Frequency Distribution', 'Number of transactions', 'Number of customers', 15);
    
    // Monetary Distribution
    createHistogramChart('monetary-chart', segments.map(s => s.Monetary), 
        'Monetary Distribution', 'Total spending ($)', 'Number of customers', 15);
}

function createHistogramChart(canvasId, data, title, xLabel, yLabel, bins = 15) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binSize = (max - min) / bins;
    
    const histogram = new Array(bins).fill(0);
    data.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
        histogram[binIndex]++;
    });
    
    const labels = Array.from({ length: bins }, (_, i) => 
        Math.floor(min + i * binSize)
    );
    
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: yLabel,
                data: histogram,
                backgroundColor: canvasId === 'recency-chart' ? 'rgba(52, 152, 219, 0.7)' :
                              canvasId === 'frequency-chart' ? 'rgba(46, 204, 113, 0.7)' :
                              'rgba(231, 76, 60, 0.7)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: title }
            },
            scales: {
                x: { title: { display: true, text: xLabel } },
                y: { title: { display: true, text: yLabel } }
            }
        }
    });
}

function createSegmentChart(segments) {
    const counts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0 };
    segments.forEach(c => counts[c.Segment]++);
    
    const ctx = document.getElementById('segment-pie-chart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32', '#8B4513']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Customer Segment Distribution' },
                legend: { position: 'bottom' }
            }
        }
    });
}

function showSegmentTable(segments) {
    const segmentStats = {};
    
    segments.forEach(customer => {
        const segment = customer.Segment;
        if (!segmentStats[segment]) {
            segmentStats[segment] = {
                count: 0,
                totalRecency: 0,
                totalFrequency: 0,
                totalMonetary: 0
            };
        }
        segmentStats[segment].count++;
        segmentStats[segment].totalRecency += customer.Recency;
        segmentStats[segment].totalFrequency += customer.Frequency;
        segmentStats[segment].totalMonetary += customer.Monetary;
    });
    
    let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<tr style="background: #3498db; color: white;">';
    html += '<th style="padding: 12px; border: 1px solid #ddd;">Segment</th>';
    html += '<th style="padding: 12px; border: 1px solid #ddd;">Customers</th>';
    html += '<th style="padding: 12px; border: 1px solid #ddd;">%</th>';
    html += '<th style="padding: 12px; border: 1px solid #ddd;">Avg Recency</th>';
    html += '<th style="padding: 12px; border: 1px solid #ddd;">Avg Frequency</th>';
    html += '<th style="padding: 12px; border: 1px solid #ddd;">Avg Monetary</th>';
    html += '</tr>';
    
    for (const [segment, stats] of Object.entries(segmentStats)) {
        const percentage = ((stats.count / segments.length) * 100).toFixed(1);
        html += `<tr style="background: ${getSegmentColor(segment)};">`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;"><strong>${segment}</strong></td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${stats.count}</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${percentage}%</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${(stats.totalRecency / stats.count).toFixed(0)} days</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${(stats.totalFrequency / stats.count).toFixed(1)}</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">$${(stats.totalMonetary / stats.count).toFixed(2)}</td>`;
        html += '</tr>';
    }
    
    html += '</table>';
    document.getElementById('segment-table').innerHTML = html;
}

function getSegmentColor(segment) {
    const colors = {
        'Platinum': '#fffacd',
        'Gold': '#fff8dc', 
        'Silver': '#f8f8ff',
        'Bronze': '#f5f5dc'
    };
    return colors[segment] || '#ffffff';
}

function showRecommendations(segments) {
    const recommendations = {
        'Platinum': [
            "VIP treatment and exclusive offers",
            "Personalized customer service",
            "Early access to new products",
            "Dedicated account manager"
        ],
        'Gold': [
            "Loyalty program benefits", 
            "Special discounts and promotions",
            "Personalized recommendations",
            "Priority customer support"
        ],
        'Silver': [
            "Welcome back campaigns",
            "Educational content and tips",
            "Re-engagement offers",
            "Cross-selling opportunities"
        ],
        'Bronze': [
            "Win-back campaigns with special discounts",
            "Simplified shopping experience", 
            "Feedback requests to understand needs",
            "Basic loyalty program entry"
        ]
    };
    
    let html = '';
    for (const [segment, tips] of Object.entries(recommendations)) {
        const segmentData = segments.filter(s => s.Segment === segment);
        if (segmentData.length === 0) continue;
        
        const avgRecency = segmentData.reduce((sum, s) => sum + s.Recency, 0) / segmentData.length;
        const avgFrequency = segmentData.reduce((sum, s) => sum + s.Frequency, 0) / segmentData.length;
        const avgMonetary = segmentData.reduce((sum, s) => sum + s.Monetary, 0) / segmentData.length;
        
        html += `<div class="recommendation-card">`;
        html += `<h4>${segment} Segment - ${segmentData.length} customers</h4>`;
        html += `<p><strong>Profile:</strong> Recency: ${avgRecency.toFixed(0)} days, Frequency: ${avgFrequency.toFixed(1)}, Monetary: $${avgMonetary.toFixed(2)}</p>`;
        html += `<p><strong>Recommended Actions:</strong></p>`;
        html += '<ul>';
        tips.forEach(tip => {
            html += `<li>${tip}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    document.getElementById('recommendations').innerHTML = html;
}

function downloadResults() {
    if (!segmentData) {
        showError('No data to download');
        return;
    }
    
    const csv = Papa.unparse(segmentData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_segments.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Utility functions
function showLoading(message) {
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
            <div class="loading" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <div>${message}</div>
        </div>
    `;
    
    // Add CSS animation
    if (!document.getElementById('loading-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

function showError(message) {
    alert('❌ ' + message);
}
