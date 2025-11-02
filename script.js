// Global variables
let currentData = null;
let analysisResults = null;
let charts = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    showNotification('🚀 Platform Ready! Click "Load Sample Data" to start instantly.', 'success');
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
}

// Enhanced sample data with more products and dates
const sampleData = `CustomerID,InvoiceDate,Quantity,UnitPrice,Description,Country
12345,2023-01-15,2,25.50,White Chocolate,LONDON
12345,2023-02-20,1,15.00,Milk Chocolate,MANCHESTER
12345,2023-03-10,3,10.00,Dark Chocolate,BIRMINGHAM
67890,2023-01-05,1,45.00,Premium Chocolate Box,LONDON
67890,2023-02-28,2,22.50,Assorted Chocolates,MANCHESTER
67890,2023-03-25,1,30.00,Chocolate Gift Set,LONDON
24680,2023-01-10,5,8.00,Chocolate Bars,BIRMINGHAM
24680,2023-03-20,2,12.50,Chocolate Truffles,MANCHESTER
13579,2023-02-05,1,100.00,Luxury Chocolate Hamper,LONDON
13579,2023-02-25,1,75.00,Chocolate Basket,LONDON
11223,2023-01-20,3,15.00,White Chocolate Bars,MANCHESTER
11223,2023-03-10,2,20.00,Chocolate Coins,BIRMINGHAM
44556,2023-02-15,1,50.00,Chocolate Box Set,LONDON
44556,2023-03-25,1,60.00,Premium Chocolates,LONDON
77991,2023-01-25,4,5.00,Chocolate Snacks,MANCHESTER
77991,2023-03-05,2,7.50,Chocolate Bites,BIRMINGHAM
33447,2023-02-10,3,18.00,Chocolate Bars,LONDON
33447,2023-03-15,1,35.00,Chocolate Gift,LONDON`;

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

// File handling functions remain the same...
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading('Reading file...');
    
    try {
        let data;
        
        if (file.name.includes('.xlsx') || file.name.includes('.xls')) {
            data = await readExcelFile(file);
        } else {
            data = await readCSVFile(file);
        }
        
        if (!data || data.length === 0) {
            throw new Error('No data found in file');
        }

        currentData = data;
        showSuccess('File uploaded successfully!');
        displayDataPreview(data);
        populateColumnSelectors(data[0]);
        showConfigurationSection();
        
    } catch (error) {
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
                });
                
                const cleanData = result.data.filter(row => 
                    Object.values(row).some(val => val !== null && val !== '')
                );
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
        let data;
        if (url.includes('.xlsx') || url.includes('.xls')) {
            data = await loadExcelFromUrl(url);
        } else {
            data = await loadCSVFromUrl(url);
        }
        
        currentData = data;
        showSuccess('Data loaded successfully from URL!');
        displayDataPreview(data);
        populateColumnSelectors(data[0]);
        showConfigurationSection();
        
    } catch (error) {
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
    return result.data.filter(row => Object.values(row).some(val => val !== null && val !== ''));
}

function displayDataPreview(data) {
    const previewContainer = document.getElementById('data-preview');
    
    if (!data || data.length === 0) {
        previewContainer.innerHTML = '<p>No data available for preview</p>';
        return;
    }
    
    let html = '<h4><i class="fas fa-table"></i> Data Preview (First 10 Rows)</h4>';
    html += '<div class="table-responsive"><table class="preview-table"><thead><tr>';
    
    const headers = Object.keys(data[0]);
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
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
    const columnMapping = {
        customer_id: document.getElementById('customer-col').value,
        date: document.getElementById('date-col').value,
        quantity: document.getElementById('quantity-col').value,
        price: document.getElementById('price-col').value
    };
    
    if (!columnMapping.customer_id || !columnMapping.date) {
        showError('Please select Customer ID and Date columns (required)');
        return;
    }
    
    showLoading('Analyzing data and generating insights...');
    document.getElementById('results-section').style.display = 'block';
    
    setTimeout(() => {
        try {
            // Process data and perform all analyses
            analysisResults = performComprehensiveAnalysis(currentData, columnMapping);
            
            // Display all results
            displayAllAnalyses(analysisResults);
            
            showSuccess('Analysis completed successfully!');
            
        } catch (error) {
            console.error('Analysis error:', error);
            showError('Analysis failed: ' + error.message);
        } finally {
            hideLoading();
        }
    }, 100);
}

function performComprehensiveAnalysis(data, columnMapping) {
    const results = {};
    
    // Basic data processing
    const processedData = data.map(row => ({
        ...row,
        TotalAmount: (row[columnMapping.quantity] || 1) * (row[columnMapping.price] || 1),
        InvoiceDate: new Date(row[columnMapping.date]),
        CustomerID: row[columnMapping.customer_id]
    })).filter(row => row.CustomerID && row.TotalAmount > 0);

    // 1. Sales Analysis
    results.salesAnalysis = analyzeSales(processedData, columnMapping);
    
    // 2. Customer Analysis
    results.customerAnalysis = analyzeCustomers(processedData);
    
    // 3. Product Analysis
    results.productAnalysis = analyzeProducts(processedData, columnMapping);
    
    // 4. Time-based Analysis
    results.timeAnalysis = analyzeTimePatterns(processedData);
    
    // 5. RFM Analysis (Simplified)
    results.rfmAnalysis = performSimpleRFM(processedData);
    
    return results;
}

function analyzeSales(data, columnMapping) {
    const sales = {
        totalRevenue: data.reduce((sum, row) => sum + row.TotalAmount, 0),
        totalTransactions: data.length,
        averageOrderValue: 0,
        salesByProduct: {},
        salesByMonth: {},
        topSellingProducts: []
    };
    
    sales.averageOrderValue = sales.totalRevenue / sales.totalTransactions;
    
    // Sales by product
    data.forEach(row => {
        const product = row.Description || 'Unknown Product';
        sales.salesByProduct[product] = (sales.salesByProduct[product] || 0) + row.TotalAmount;
    });
    
    // Sales by month
    data.forEach(row => {
        const month = row.InvoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        sales.salesByMonth[month] = (sales.salesByMonth[month] || 0) + row.TotalAmount;
    });
    
    // Top selling products
    sales.topSellingProducts = Object.entries(sales.salesByProduct)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([product, revenue]) => ({ product, revenue }));
    
    return sales;
}

function analyzeCustomers(data) {
    const customers = {
        totalCustomers: new Set(data.map(row => row.CustomerID)).size,
        customerFrequency: {},
        topCustomers: [],
        newVsReturning: {
            new: 0,
            returning: 0
        }
    };
    
    // Customer frequency
    data.forEach(row => {
        customers.customerFrequency[row.CustomerID] = (customers.customerFrequency[row.CustomerID] || 0) + 1;
    });
    
    // Top customers by spending
    const customerSpending = {};
    data.forEach(row => {
        customerSpending[row.CustomerID] = (customerSpending[row.CustomerID] || 0) + row.TotalAmount;
    });
    
    customers.topCustomers = Object.entries(customerSpending)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([customer, spending]) => ({ customer, spending }));
    
    return customers;
}

function analyzeProducts(data, columnMapping) {
    const products = {
        totalProducts: new Set(data.map(row => row.Description)).size,
        productsByRevenue: {},
        productsByQuantity: {},
        lowStockItems: []
    };
    
    // Products by revenue
    data.forEach(row => {
        const product = row.Description || 'Unknown';
        products.productsByRevenue[product] = (products.productsByRevenue[product] || 0) + row.TotalAmount;
        products.productsByQuantity[product] = (products.productsByQuantity[product] || 0) + (row[columnMapping.quantity] || 1);
    });
    
    return products;
}

function analyzeTimePatterns(data) {
    const timePatterns = {
        salesByHour: {},
        salesByDay: {},
        salesByMonth: {},
        peakHours: []
    };
    
    data.forEach(row => {
        const hour = row.InvoiceDate.getHours();
        const day = row.InvoiceDate.getDay();
        const month = row.InvoiceDate.getMonth();
        
        timePatterns.salesByHour[hour] = (timePatterns.salesByHour[hour] || 0) + row.TotalAmount;
        timePatterns.salesByDay[day] = (timePatterns.salesByDay[day] || 0) + row.TotalAmount;
        timePatterns.salesByMonth[month] = (timePatterns.salesByMonth[month] || 0) + row.TotalAmount;
    });
    
    return timePatterns;
}

function performSimpleRFM(data) {
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
        customerMap[customerId].monetary += row.TotalAmount;
        if (row.InvoiceDate > customerMap[customerId].lastDate) {
            customerMap[customerId].lastDate = row.InvoiceDate;
        }
    });
    
    const rfmData = [];
    for (const [customerId, stats] of Object.entries(customerMap)) {
        const recency = Math.floor((referenceDate - stats.lastDate) / (1000 * 60 * 60 * 24));
        rfmData.push({
            CustomerID: customerId,
            Recency: recency,
            Frequency: stats.frequency,
            Monetary: stats.monetary
        });
    }
    
    // Simple segmentation based on percentiles
    const segments = rfmData.map(customer => {
        let score = 0;
        
        // Simple scoring (you can make this more sophisticated)
        if (customer.Recency <= 30) score += 3;
        else if (customer.Recency <= 90) score += 2;
        else score += 1;
        
        if (customer.Frequency >= 5) score += 3;
        else if (customer.Frequency >= 2) score += 2;
        else score += 1;
        
        if (customer.Monetary >= 100) score += 3;
        else if (customer.Monetary >= 50) score += 2;
        else score += 1;
        
        let segment = 'Bronze';
        if (score >= 7) segment = 'Platinum';
        else if (score >= 5) segment = 'Gold';
        else if (score >= 3) segment = 'Silver';
        
        return {
            ...customer,
            Segment: segment
        };
    });
    
    return segments;
}

function displayAllAnalyses(results) {
    // Update metrics
    document.getElementById('total-customers').textContent = 
        results.customerAnalysis.totalCustomers.toLocaleString();
    document.getElementById('total-revenue').textContent = 
        '$' + results.salesAnalysis.totalRevenue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    document.getElementById('avg-frequency').textContent = 
        (results.salesAnalysis.totalRevenue / results.salesAnalysis.totalTransactions).toFixed(1);
    
    // Create all visualizations
    createSalesCharts(results.salesAnalysis);
    createCustomerCharts(results.customerAnalysis);
    createProductCharts(results.productAnalysis);
    createTimeCharts(results.timeAnalysis);
    createRFMCharts(results.rfmAnalysis);
    
    // Display insights
    displayBusinessInsights(results);
}

function createSalesCharts(sales) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};
    
    // Monthly Sales Trend
    const monthlyLabels = Object.keys(sales.salesByMonth);
    const monthlyData = Object.values(sales.salesByMonth);
    
    charts.monthlySales = new Chart(document.getElementById('recency-chart'), {
        type: 'line',
        data: {
            labels: monthlyLabels,
            datasets: [{
                label: 'Monthly Revenue',
                data: monthlyData,
                borderColor: 'rgba(52, 152, 219, 1)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Sales Trend',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Revenue ($)' }
                }
            }
        }
    });
}

function createCustomerCharts(customers) {
    // Top Customers by Spending
    const topCustomerLabels = customers.topCustomers.map(c => `Customer ${c.customer}`);
    const topCustomerData = customers.topCustomers.map(c => c.spending);
    
    charts.topCustomers = new Chart(document.getElementById('frequency-chart'), {
        type: 'bar',
        data: {
            labels: topCustomerLabels,
            datasets: [{
                label: 'Total Spending',
                data: topCustomerData,
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
                    text: 'Top 10 Customers by Spending',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total Spending ($)' }
                }
            }
        }
    });
}

function createProductCharts(products) {
    // Top Products by Revenue (Pie Chart)
    const topProducts = Object.entries(products.productsByRevenue)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);
    
    const productLabels = topProducts.map(([product]) => product);
    const productData = topProducts.map(([,revenue]) => revenue);
    
    charts.topProducts = new Chart(document.getElementById('monetary-chart'), {
        type: 'pie',
        data: {
            labels: productLabels,
            datasets: [{
                data: productData,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Top Products by Revenue',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createTimeCharts(timePatterns) {
    // Sales by Hour
    const hourLabels = Object.keys(timePatterns.salesByHour).sort((a, b) => a - b);
    const hourData = hourLabels.map(hour => timePatterns.salesByHour[hour]);
    
    charts.salesByHour = new Chart(document.getElementById('segment-pie-chart'), {
        type: 'bar',
        data: {
            labels: hourLabels.map(h => h + ':00'),
            datasets: [{
                label: 'Revenue by Hour',
                data: hourData,
                backgroundColor: 'rgba(155, 89, 182, 0.7)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Sales Distribution by Hour',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Revenue ($)' }
                }
            }
        }
    });
}

function createRFMCharts(rfmData) {
    // Segment Distribution
    const segmentCounts = {};
    rfmData.forEach(c => {
        segmentCounts[c.Segment] = (segmentCounts[c.Segment] || 0) + 1;
    });
    
    charts.segments = new Chart(document.getElementById('rfm-segment-chart'), {
        type: 'doughnut',
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
                title: {
                    display: true,
                    text: 'Customer Segments Distribution',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Customer Value Scatter Plot
    const scatterData = {
        datasets: Object.keys(segmentCounts).map(segment => {
            const segmentPoints = rfmData.filter(s => s.Segment === segment);
            return {
                label: segment,
                data: segmentPoints.map(customer => ({
                    x: customer.Recency,
                    y: customer.Frequency,
                    r: 5
                })),
                backgroundColor: getSegmentColor(segment),
                pointRadius: 6
            };
        })
    };
    
    charts.scatter = new Chart(document.getElementById('segment-scatter-chart'), {
        type: 'scatter',
        data: scatterData,
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Customer Segments: Recency vs Frequency',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Recency (days)' }
                },
                y: {
                    title: { display: true, text: 'Frequency' }
                }
            }
        }
    });
}

function getSegmentColor(segment) {
    const colors = {
        'Platinum': '#FFD700',
        'Gold': '#C0C0C0',
        'Silver': '#CD7F32', 
        'Bronze': '#8B4513'
    };
    return colors[segment] || '#666666';
}

function displayBusinessInsights(results) {
    const container = document.getElementById('recommendations-container');
    
    const insights = generateBusinessInsights(results);
    
    let html = '';
    
    insights.forEach(insight => {
        html += `
            <div class="recommendation-card">
                <h4><i class="fas ${insight.icon}"></i> ${insight.title}</h4>
                <p>${insight.description}</p>
                ${insight.recommendations ? `
                    <p><strong>Recommendations:</strong></p>
                    <ul>
                        ${insight.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function generateBusinessInsights(results) {
    const insights = [];
    
    // Sales Insights
    const topProduct = results.salesAnalysis.topSellingProducts[0];
    insights.push({
        icon: 'fa-chart-line',
        title: 'Sales Performance',
        description: `Total revenue: $${results.salesAnalysis.totalRevenue.toLocaleString()}. ${topProduct ? `Top product "${topProduct.product}" generated $${topProduct.revenue.toFixed(2)}` : ''}`,
        recommendations: [
            'Focus marketing on top-performing products',
            'Create bundles with best-selling items',
            'Increase stock for high-demand products'
        ]
    });
    
    // Customer Insights
    const topCustomer = results.customerAnalysis.topCustomers[0];
    insights.push({
        icon: 'fa-users',
        title: 'Customer Insights',
        description: `Serving ${results.customerAnalysis.totalCustomers} unique customers. ${topCustomer ? `Top customer spent $${topCustomer.spending.toFixed(2)}` : ''}`,
        recommendations: [
            'Implement loyalty program for top customers',
            'Create personalized offers for frequent buyers',
            'Develop win-back campaigns for inactive customers'
        ]
    });
    
    // Product Insights
    const productCount = results.productAnalysis.totalProducts;
    insights.push({
        icon: 'fa-box',
        title: 'Product Analysis',
        description: `Managing ${productCount} different products in inventory.`,
        recommendations: [
            'Optimize inventory for fast-moving products',
            'Consider discontinuing low-performing items',
            'Explore cross-selling opportunities'
        ]
    });
    
    // RFM Insights
    const segmentCounts = {};
    results.rfmAnalysis.forEach(c => {
        segmentCounts[c.Segment] = (segmentCounts[c.Segment] || 0) + 1;
    });
    
    insights.push({
        icon: 'fa-sitemap',
        title: 'Customer Segments',
        description: `Customer base segmented into ${Object.keys(segmentCounts).length} groups for targeted marketing.`,
        recommendations: [
            'Create VIP program for Platinum segment',
            'Develop reactivation campaigns for Bronze customers',
            'Personalize communication for each segment'
        ]
    });
    
    return insights;
}

function downloadResults() {
    if (!analysisResults || !analysisResults.rfmAnalysis) {
        showError('No analysis results to download');
        return;
    }
    
    try {
        const csv = Papa.unparse(analysisResults.rfmAnalysis);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer_analysis_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('Analysis results downloaded successfully!');
    } catch (error) {
        showError('Download failed: ' + error.message);
    }
}

// Utility functions
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
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}
