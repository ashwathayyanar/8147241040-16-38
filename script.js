// Global variables
let currentData = null;
let rfmData = null;
let segmentData = null;
let charts = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    showNotification('🚀 Platform Ready! All processing happens locally in your browser.', 'success');
});

function initializeEventListeners() {
    // File upload listeners
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);
    document.getElementById('excel-upload').addEventListener('change', handleFileUpload);
    document.getElementById('load-url-btn').addEventListener('click', handleUrlLoad);
    document.getElementById('load-sample-btn').addEventListener('click', loadSampleData);
    
    // Analysis listeners
    document.getElementById('analyze-btn').addEventListener('click', analyzeData);
    document.getElementById('download-btn').addEventListener('click', downloadResults);
    
    // Navigation smooth scroll
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
}

// Sample data for quick testing
const sampleData = `CustomerID,InvoiceDate,Quantity,UnitPrice,Description
12345,2023-01-01,2,25.50,Product A
12345,2023-01-15,1,15.00,Product B
12345,2023-02-01,3,10.00,Product C
67890,2023-01-05,1,45.00,Product D
67890,2023-02-10,2,22.50,Product E
67890,2023-03-15,1,30.00,Product F
24680,2023-01-10,5,8.00,Product G
24680,2023-03-20,2,12.50,Product H
13579,2023-02-05,1,100.00,Product I
13579,2023-02-25,1,75.00,Product J
11223,2023-01-20,3,15.00,Product K
11223,2023-03-10,2,20.00,Product L
44556,2023-02-15,1,50.00,Product M
44556,2023-03-25,1,60.00,Product N
77991,2023-01-25,4,5.00,Product O
77991,2023-03-05,2,7.50,Product P`;

function loadSampleData() {
    showLoading('Loading sample data...');
    
    try {
        const result = Papa.parse(sampleData, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });
        
        currentData = result.data;
        showSuccess('Sample data loaded successfully!');
        displayDataPreview(currentData);
        populateColumnSelectors(currentData[0]);
        showConfigurationSection();
        
        // Auto-select columns for sample data
        document.getElementById('customer-col').value = 'CustomerID';
        document.getElementById('date-col').value = 'InvoiceDate';
        document.getElementById('quantity-col').value = 'Quantity';
        document.getElementById('price-col').value = 'UnitPrice';
        
    } catch (error) {
        showError('Error loading sample data: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

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

        currentData = data;
        showSuccess('File uploaded successfully!');
        displayDataPreview(data);
        populateColumnSelectors(data[0]);
        showConfigurationSection();
        
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
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);
                
                console.log('Excel sheet processed:', data.length, 'rows');
                resolve(data);
            } catch (error) {
                reject(new Error('Failed to parse Excel file: ' + error.message));
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
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
        currentData = data;
        showSuccess('Data loaded successfully from URL!');
        displayDataPreview(data);
        populateColumnSelectors(data[0]);
        showConfigurationSection();
        
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

function displayDataPreview(data) {
    const previewContainer = document.getElementById('data-preview');
    
    if (!data || data.length === 0) {
        previewContainer.innerHTML = '<p>No data available for preview</p>';
        return;
    }
    
    let html = '<h4><i class="fas fa-table"></i> Data Preview (First 10 Rows)</h4>';
    html += '<div class="table-responsive"><table class="preview-table"><thead><tr>';
    
    // Headers
    const headers = Object.keys(data[0]);
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Data rows (limit to 10)
    data.slice(0, 10).forEach(row => {
        html += '<tr>';
        headers.forEach(header => {
            const value = row[header];
            const displayValue = value !== null && value !== undefined ? String(value).substring(0, 30) : '';
            html += `<td title="${value}">${displayValue}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    html += `<p><small>Showing ${Math.min(10, data.length)} of ${data.length} total rows</small></p>`;
    
    previewContainer.innerHTML = html;
    previewContainer.style.display = 'block';
}

function populateColumnSelectors(columns) {
    const selectors = ['customer-col', 'date-col', 'quantity-col', 'price-col'];
    
    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        select.innerHTML = '<option value="">Select column...</option>';
        
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            select.appendChild(option);
        });
    });
    
    // Auto-detect common column names
    autoDetectColumns(columns);
}

function autoDetectColumns(columns) {
    const patterns = {
        'customer-col': ['customer', 'cust', 'id', 'client', 'user', 'member'],
        'date-col': ['date', 'time', 'invoice', 'order', 'created', 'purchase'],
        'quantity-col': ['quantity', 'qty', 'amount', 'units', 'number'],
        'price-col': ['price', 'cost', 'unitprice', 'amount', 'value', 'total']
    };
    
    Object.keys(patterns).forEach(selectorId => {
        const select = document.getElementById(selectorId);
        const columnPatterns = patterns[selectorId];
        
        for (const pattern of columnPatterns) {
            const matchingColumn = columns.find(col => 
                col.toLowerCase().includes(pattern.toLowerCase())
            );
            
            if (matchingColumn) {
                select.value = matchingColumn;
                console.log(`Auto-detected ${matchingColumn} for ${selectorId}`);
                break;
            }
        }
    });
}

function showConfigurationSection() {
    document.getElementById('analysis').scrollIntoView({ behavior: 'smooth' });
    document.querySelector('.config-section').style.display = 'block';
}

function analyzeData() {
    // Collect column mappings
    const columnMapping = {
        customer_id: document.getElementById('customer-col').value,
        date: document.getElementById('date-col').value,
        quantity: document.getElementById('quantity-col').value,
        price: document.getElementById('price-col').value
    };
    
    // Validate required columns
    if (!columnMapping.customer_id || !columnMapping.date) {
        showError('Please select Customer ID and Date columns (required)');
        return;
    }
    
    showLoading('Performing advanced customer segmentation analysis...');
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('insights').scrollIntoView({ behavior: 'smooth' });
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
            // Process data
            const processedData = preprocessData(currentData, columnMapping);
            console.log('Data processed:', processedData.length, 'rows');
            
            // Calculate RFM
            rfmData = calculateRFM(processedData, columnMapping);
            console.log('RFM calculated:', rfmData.length, 'customers');
            
            // Perform segmentation
            segmentData = performSegmentation(rfmData);
            console.log('Segmentation completed');
            
            // Display results
            displayAnalysisResults(segmentData);
            
            showSuccess('Analysis completed successfully!');
            
        } catch (error) {
            console.error('Analysis error:', error);
            showError('Analysis failed: ' + error.message);
        } finally {
            hideLoading();
        }
    }, 100);
}

function preprocessData(data, columnMapping) {
    return data
        .filter(row => {
            // Remove rows with missing customer IDs
            if (!row[columnMapping.customer_id]) {
                return false;
            }
            
            // Remove negative quantities and prices
            if (columnMapping.quantity && row[columnMapping.quantity] <= 0) {
                return false;
            }
            if (columnMapping.price && row[columnMapping.price] <= 0) {
                return false;
            }
            
            return true;
        })
        .map(row => {
            const processed = { ...row };
            
            // Calculate total amount
            if (columnMapping.quantity && columnMapping.price) {
                processed.TotalAmount = (row[columnMapping.quantity] || 0) * (row[columnMapping.price] || 0);
            } else {
                processed.TotalAmount = 1;
            }
            
            // Parse date
            if (columnMapping.date && row[columnMapping.date]) {
                try {
                    processed.InvoiceDate = new Date(row[columnMapping.date]);
                    if (isNaN(processed.InvoiceDate.getTime())) {
                        processed.InvoiceDate = new Date(); // Fallback to current date
                    }
                } catch (error) {
                    processed.InvoiceDate = new Date(); // Fallback to current date
                }
            } else {
                processed.InvoiceDate = new Date(); // Fallback to current date
            }
            
            return processed;
        });
}

function calculateRFM(data, columnMapping) {
    const referenceDate = new Date(Math.max(...data.map(row => row.InvoiceDate.getTime())));
    referenceDate.setDate(referenceDate.getDate() + 1);
    
    const customerMap = {};
    
    data.forEach(row => {
        const customerId = row[columnMapping.customer_id];
        if (!customerMap[customerId]) {
            customerMap[customerId] = {
                lastDate: row.InvoiceDate,
                frequency: 0,
                monetary: 0
            };
        }
        
        customerMap[customerId].frequency++;
        customerMap[customerId].monetary += row.TotalAmount;
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
    // Prepare data for clustering
    const features = rfmData.map(customer => [
        customer.Recency,
        Math.log1p(customer.Frequency),
        Math.log1p(customer.Monetary)
    ]);
    
    // Normalize features
    const normalizedFeatures = normalizeFeatures(features);
    
    // Perform k-means clustering
    const k = 4;
    const result = mlKmeans(normalizedFeatures, k, { initialization: 'kmeans++' });
    
    // Assign segments
    const segmentNames = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    return rfmData.map((customer, index) => ({
        ...customer,
        Cluster: result.clusters[index],
        Segment: segmentNames[result.clusters[index]] || 'Unknown'
    }));
}

function normalizeFeatures(features) {
    const normalized = [];
    const numFeatures = features[0].length;
    
    for (let i = 0; i < numFeatures; i++) {
        const featureValues = features.map(row => row[i]);
        const min = Math.min(...featureValues);
        const max = Math.max(...featureValues);
        const range = max - min;
        
        if (range === 0) {
            // All values are the same, set to 0.5
            features.forEach((row, idx) => {
                if (!normalized[idx]) normalized[idx] = [];
                normalized[idx][i] = 0.5;
            });
        } else {
            features.forEach((row, idx) => {
                if (!normalized[idx]) normalized[idx] = [];
                normalized[idx][i] = (row[i] - min) / range;
            });
        }
    }
    
    return normalized;
}

function displayAnalysisResults(segments) {
    // Update metrics
    document.getElementById('total-customers').textContent = 
        segments.length.toLocaleString();
    document.getElementById('total-revenue').textContent = 
        '$' + segments.reduce((sum, c) => sum + c.Monetary, 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    document.getElementById('avg-frequency').textContent = 
        (segments.reduce((sum, c) => sum + c.Frequency, 0) / segments.length).toFixed(1);
    
    // Create visualizations
    createRFMCharts(segments);
    createSegmentationCharts(segments);
    
    // Display segment analysis
    displaySegmentAnalysis(segments);
    
    // Display recommendations
    displayRecommendations(segments);
}

function createRFMCharts(segments) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};
    
    // Recency Distribution
    charts.recency = new Chart(document.getElementById('recency-chart'), {
        type: 'bar',
        data: {
            labels: createHistogramBins(segments.map(s => s.Recency), 20),
            datasets: [{
                label: 'Number of Customers',
                data: createHistogramData(segments.map(s => s.Recency), 20),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Recency Distribution',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Days since last purchase' }
                },
                y: { 
                    title: { display: true, text: 'Number of customers' },
                    beginAtZero: true
                }
            }
        }
    });
    
    // Frequency Distribution
    charts.frequency = new Chart(document.getElementById('frequency-chart'), {
        type: 'bar',
        data: {
            labels: createHistogramBins(segments.map(s => s.Frequency), 15),
            datasets: [{
                label: 'Number of Customers',
                data: createHistogramData(segments.map(s => s.Frequency), 15),
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Frequency Distribution',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Number of transactions' }
                },
                y: { 
                    title: { display: true, text: 'Number of customers' },
                    beginAtZero: true
                }
            }
        }
    });
    
    // Monetary Distribution
    charts.monetary = new Chart(document.getElementById('monetary-chart'), {
        type: 'bar',
        data: {
            labels: createHistogramBins(segments.map(s => s.Monetary), 15),
            datasets: [{
                label: 'Number of Customers',
                data: createHistogramData(segments.map(s => s.Monetary), 15),
                backgroundColor: 'rgba(231, 76, 60, 0.7)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Monetary Distribution',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Total spending ($)' }
                },
                y: { 
                    title: { display: true, text: 'Number of customers' },
                    beginAtZero: true
                }
            }
        }
    });
}

function createSegmentationCharts(segments) {
    // Segment Distribution Pie Chart
    const segmentCounts = {};
    segments.forEach(c => {
        segmentCounts[c.Segment] = (segmentCounts[c.Segment] || 0) + 1;
    });
    
    charts.segmentPie = new Chart(document.getElementById('segment-pie-chart'), {
        type: 'pie',
        data: {
            labels: Object.keys(segmentCounts),
            datasets: [{
                data: Object.values(segmentCounts),
                backgroundColor: ['#8B4513', '#C0C0C0', '#FFD700', '#E5E4E2'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Customer Segment Distribution',
                    font: { size: 16, weight: 'bold' }
                }
            }
        }
    });
    
    // RFM by Segment Bar Chart
    const segmentStats = calculateSegmentStats(segments);
    const segmentNames = Object.keys(segmentStats);
    
    charts.rfmSegment = new Chart(document.getElementById('rfm-segment-chart'), {
        type: 'bar',
        data: {
            labels: segmentNames,
            datasets: [
                {
                    label: 'Recency (normalized)',
                    data: segmentNames.map(seg => segmentStats[seg].normalizedRecency),
                    backgroundColor: 'rgba(52, 152, 219, 0.7)'
                },
                {
                    label: 'Frequency (normalized)',
                    data: segmentNames.map(seg => segmentStats[seg].normalizedFrequency),
                    backgroundColor: 'rgba(46, 204, 113, 0.7)'
                },
                {
                    label: 'Monetary (normalized)',
                    data: segmentNames.map(seg => segmentStats[seg].normalizedMonetary),
                    backgroundColor: 'rgba(231, 76, 60, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    title: {
                        display: true,
                        text: 'Normalized Values'
                    }
                }
            }
        }
    });
    
    // Customer Segments Scatter Plot
    const segmentColors = {
        'Bronze': '#8B4513',
        'Silver': '#C0C0C0',
        'Gold': '#FFD700',
        'Platinum': '#E5E4E2'
    };
    
    const scatterData = {
        datasets: segmentNames.map(segment => {
            const segmentPoints = segments.filter(s => s.Segment === segment);
            return {
                label: segment,
                data: segmentPoints.map(customer => ({
                    x: customer.Recency,
                    y: customer.Frequency,
                    r: 5 + (customer.Monetary / Math.max(...segments.map(s => s.Monetary))) * 10
                })),
                backgroundColor: segmentColors[segment],
                borderColor: segmentColors[segment],
                pointRadius: 5
            };
        })
    };
    
    charts.scatter = new Chart(document.getElementById('segment-scatter-chart'), {
        type: 'scatter',
        data: scatterData,
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Recency (days)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const customer = segments.find(s => 
                                s.Recency === context.parsed.x && 
                                s.Frequency === context.parsed.y
                            );
                            return [
                                `Customer: ${customer.CustomerID}`,
                                `Recency: ${customer.Recency} days`,
                                `Frequency: ${customer.Frequency} transactions`,
                                `Monetary: $${customer.Monetary.toFixed(2)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function calculateSegmentStats(segments) {
    const stats = {};
    const segmentsList = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    
    segmentsList.forEach(segment => {
        const segmentData = segments.filter(s => s.Segment === segment);
        if (segmentData.length === 0) return;
        
        stats[segment] = {
            count: segmentData.length,
            avgRecency: segmentData.reduce((sum, s) => sum + s.Recency, 0) / segmentData.length,
            avgFrequency: segmentData.reduce((sum, s) => sum + s.Frequency, 0) / segmentData.length,
            avgMonetary: segmentData.reduce((sum, s) => sum + s.Monetary, 0) / segmentData.length
        };
    });
    
    // Normalize values for comparison
    const maxRecency = Math.max(...Object.values(stats).map(s => s.avgRecency));
    const maxFrequency = Math.max(...Object.values(stats).map(s => s.avgFrequency));
    const maxMonetary = Math.max(...Object.values(stats).map(s => s.avgMonetary));
    
    Object.keys(stats).forEach(segment => {
        stats[segment].normalizedRecency = stats[segment].avgRecency / maxRecency;
        stats[segment].normalizedFrequency = stats[segment].avgFrequency / maxFrequency;
        stats[segment].normalizedMonetary = stats[segment].avgMonetary / maxMonetary;
        stats[segment].percentage = ((stats[segment].count / segments.length) * 100).toFixed(1);
    });
    
    return stats;
}

function displaySegmentAnalysis(segments) {
    const tableBody = document.getElementById('segment-table-body');
    tableBody.innerHTML = '';
    
    const segmentStats = calculateSegmentStats(segments);
    
    Object.entries(segmentStats).forEach(([segment, stats]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${segment}</strong></td>
            <td>${stats.count}</td>
            <td>${stats.percentage}%</td>
            <td>${stats.avgRecency.toFixed(0)} days</td>
            <td>${stats.avgFrequency.toFixed(1)}</td>
            <td>$${stats.avgMonetary.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function displayRecommendations(segments) {
    const container = document.getElementById('recommendations-container');
    container.innerHTML = '';
    
    const segmentStats = calculateSegmentStats(segments);
    const recommendations = {
        'Platinum': [
            "VIP treatment with exclusive loyalty programs",
            "Personalized shopping assistance and early access",
            "High-value personalized offers and dedicated support",
            "Invitation-only events and premium experiences"
        ],
        'Gold': [
            "Tiered loyalty program with clear upgrade path",
            "Cross-selling based on comprehensive purchase history",
            "Seasonal promotions and exclusive bundle offers",
            "Personalized email campaigns with smart recommendations"
        ],
        'Silver': [
            "Welcome back campaigns with reactivation offers",
            "Educational content about product benefits",
            "Re-engagement campaigns with social proof",
            "Entry-level loyalty program with achievable goals"
        ],
        'Bronze': [
            "Win-back campaigns with compelling discounts",
            "Simplified shopping experience and guided navigation",
            "Limited-time reactivation offers",
            "Feedback surveys to understand customer needs"
        ]
    };
    
    Object.entries(segmentStats).forEach(([segment, stats]) => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        
        let html = `<h4><i class="fas fa-star"></i> ${segment} Customers (${stats.count} customers, ${stats.percentage}%)</h4>`;
        html += `<p><strong>Profile:</strong> ${stats.avgRecency.toFixed(0)} days recency, ${stats.avgFrequency.toFixed(1)} avg frequency, $${stats.avgMonetary.toFixed(2)} avg spending</p>`;
        html += '<p><strong>Recommended Strategies:</strong></p>';
        html += '<ul>';
        
        (recommendations[segment] || []).forEach(tip => {
            html += `<li>${tip}</li>`;
        });
        
        html += '</ul>';
        card.innerHTML = html;
        container.appendChild(card);
    });
}

function downloadResults() {
    if (!segmentData) {
        showError('No analysis results to download');
        return;
    }
    
    try {
        const csv = Papa.unparse(segmentData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer_segments_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('CSV download started successfully!');
    } catch (error) {
        showError('Download failed: ' + error.message);
    }
}

function generatePDFReport() {
    showNotification('PDF generation would require additional libraries. CSV download is available.', 'info');
}

// Utility functions
function createHistogramBins(data, bins) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binSize = (max - min) / bins;
    return Array.from({ length: bins }, (_, i) => 
        Math.floor(min + i * binSize)
    );
}

function createHistogramData(data, bins) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binSize = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    
    data.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
        histogram[binIndex]++;
    });
    
    return histogram;
}

function showLoading(message) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.querySelector('p').textContent = message;
        spinner.style.display = 'block';
    }
}

function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Add smooth scrolling for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
