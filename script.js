// Global variables
let currentData = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);
    document.getElementById('analyze-btn').addEventListener('click', analyzeData);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data;
            
            if (file.name.includes('.xlsx') || file.name.includes('.xls')) {
                // Handle Excel files - we'll use a simple approach
                alert('Excel file detected. Please convert to CSV or use the sample data.');
                return;
            } else {
                // Handle CSV files
                const result = Papa.parse(e.target.result, {
                    header: true,
                    skipEmptyLines: true
                });
                data = result.data;
            }
            
            console.log('Data loaded:', data);
            
            if (!data || data.length === 0) {
                alert('No data found in file! Please check the file format.');
                return;
            }

            currentData = data;
            
            // Show success message
            document.getElementById('file-info').innerHTML = `
                <div style="color: green; font-weight: bold;">
                    ✅ File uploaded successfully!<br>
                    Rows: ${data.length}<br>
                    Columns: ${Object.keys(data[0]).join(', ')}
                </div>
            `;

            // Show data preview
            showDataPreview(data);
            
            // Auto-fill column selectors
            populateColumnSelectors(data[0]);
            
            // Show configuration section
            document.querySelector('.config-section').style.display = 'block';
            document.getElementById('welcome-section').style.display = 'none';
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error reading file. Please make sure it\'s a valid CSV file.');
        }
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

function showDataPreview(data) {
    const preview = data.slice(0, 3); // Show first 3 rows
    let html = '<div style="margin-top: 10px; border: 1px solid #ccc; padding: 10px; background: #f9f9f9;">';
    html += '<strong>Data Preview (first 3 rows):</strong><br>';
    
    // Headers
    const headers = Object.keys(data[0]);
    html += '<div style="font-weight: bold; color: #333;">' + headers.join(' | ') + '</div>';
    
    // Data rows
    preview.forEach(row => {
        const values = headers.map(header => row[header] || '');
        html += '<div style="color: #666;">' + values.join(' | ') + '</div>';
    });
    
    html += '</div>';
    document.getElementById('file-info').innerHTML += html;
}

function populateColumnSelectors(firstRow) {
    const columns = Object.keys(firstRow);
    
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
    
    // Try to auto-detect columns
    autoDetectColumns(columns);
}

function autoDetectColumns(columns) {
    // Simple auto-detection logic
    columns.forEach(col => {
        const colLower = col.toLowerCase();
        
        if (colLower.includes('customer') || colLower.includes('cust') || colLower.includes('id')) {
            document.getElementById('customer-col').value = col;
        }
        
        if (colLower.includes('date') || colLower.includes('time')) {
            document.getElementById('date-col').value = col;
        }
        
        if (colLower.includes('amount') || colLower.includes('price') || colLower.includes('value') || colLower.includes('total')) {
            document.getElementById('amount-col').value = col;
        }
    });
}

function analyzeData() {
    if (!currentData) {
        alert('Please upload a file first!');
        return;
    }

    const customerCol = document.getElementById('customer-col').value;
    const dateCol = document.getElementById('date-col').value;
    const amountCol = document.getElementById('amount-col').value;

    if (!customerCol) {
        alert('Please select Customer ID column');
        return;
    }

    console.log('Starting analysis with:', { customerCol, dateCol, amountCol });

    try {
        // Process the data
        const processedData = processData(currentData, customerCol, dateCol, amountCol);
        
        // Calculate RFM
        const rfmData = calculateRFM(processedData, customerCol, dateCol, amountCol);
        
        // Perform segmentation
        const segments = performSegmentation(rfmData);
        
        // Display results
        displayResults(segments);
        
        // Show results section
        document.getElementById('results-section').style.display = 'block';
        
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Analysis error: ' + error.message);
    }
}

function processData(data, customerCol, dateCol, amountCol) {
    return data.map(row => {
        const processed = {
            CustomerID: row[customerCol] || 'Unknown',
            InvoiceDate: dateCol ? new Date(row[dateCol]) : new Date(),
            Amount: amountCol ? parseFloat(row[amountCol]) || 0 : 1
        };
        return processed;
    }).filter(row => row.CustomerID && row.CustomerID !== 'Unknown');
}

function calculateRFM(data, customerCol, dateCol, amountCol) {
    const referenceDate = new Date(Math.max(...data.map(row => row.InvoiceDate)));
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
    const segments = rfmData.map(customer => {
        const segment = calculateSegment(customer.Recency, customer.Frequency, customer.Monetary);
        return {
            ...customer,
            Segment: segment
        };
    });
    
    return segments;
}

function calculateSegment(recency, frequency, monetary) {
    // Simple scoring system
    let score = 0;
    
    // Recency: lower is better
    if (recency <= 30) score += 3;
    else if (recency <= 90) score += 2;
    else score += 1;
    
    // Frequency: higher is better
    if (frequency >= 10) score += 3;
    else if (frequency >= 5) score += 2;
    else score += 1;
    
    // Monetary: higher is better
    if (monetary >= 500) score += 3;
    else if (monetary >= 100) score += 2;
    else score += 1;
    
    // Assign segments based on total score
    if (score >= 8) return 'Platinum';
    if (score >= 6) return 'Gold';
    if (score >= 4) return 'Silver';
    return 'Bronze';
}

function displayResults(segments) {
    // Update metrics
    document.getElementById('total-customers').textContent = segments.length;
    document.getElementById('total-revenue').textContent = 
        '$' + segments.reduce((sum, c) => sum + c.Monetary, 0).toFixed(2);
    document.getElementById('avg-frequency').textContent = 
        (segments.reduce((sum, c) => sum + c.Frequency, 0) / segments.length).toFixed(1);
    
    // Create segment distribution
    createSegmentChart(segments);
    
    // Show segment table
    showSegmentTable(segments);
    
    // Show recommendations
    showRecommendations(segments);
}

function createSegmentChart(segments) {
    const counts = {
        Platinum: 0, Gold: 0, Silver: 0, Bronze: 0
    };
    
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
                title: {
                    display: true,
                    text: 'Customer Segments'
                }
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
    html += '<th style="padding: 10px; border: 1px solid #ddd;">Segment</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd;">Customers</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd;">Avg Recency</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd;">Avg Frequency</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd;">Avg Monetary</th>';
    html += '</tr>';
    
    for (const [segment, stats] of Object.entries(segmentStats)) {
        html += `<tr style="background: ${segment === 'Platinum' ? '#fffacd' : segment === 'Gold' ? '#fff8dc' : segment === 'Silver' ? '#f8f8ff' : '#f5f5dc'};">`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;"><strong>${segment}</strong></td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${stats.count}</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${(stats.totalRecency / stats.count).toFixed(0)} days</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">${(stats.totalFrequency / stats.count).toFixed(1)}</td>`;
        html += `<td style="padding: 10px; border: 1px solid #ddd;">$${(stats.totalMonetary / stats.count).toFixed(2)}</td>`;
        html += '</tr>';
    }
    
    html += '</table>';
    document.getElementById('segment-table').innerHTML = html;
}

function showRecommendations(segments) {
    const recommendations = {
        'Platinum': [
            "VIP treatment and exclusive offers",
            "Personalized customer service",
            "Early access to new products"
        ],
        'Gold': [
            "Loyalty program benefits",
            "Special discounts and promotions",
            "Personalized recommendations"
        ],
        'Silver': [
            "Welcome back campaigns",
            "Educational content",
            "Re-engagement offers"
        ],
        'Bronze': [
            "Win-back campaigns",
            "Special discount offers",
            "Feedback requests"
        ]
    };
    
    let html = '';
    for (const [segment, tips] of Object.entries(recommendations)) {
        html += `<div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #3498db;">`;
        html += `<h4 style="color: #2c3e50; margin-bottom: 10px;">${segment} Customers</h4>`;
        html += '<ul style="margin: 0; padding-left: 20px;">';
        tips.forEach(tip => {
            html += `<li style="margin-bottom: 5px;">${tip}</li>`;
        });
        html += '</ul></div>';
    }
    
    document.getElementById('recommendations').innerHTML = html;
}
