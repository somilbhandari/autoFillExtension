// Content script for N8N Form Autofiller extension
// This script runs on all web pages and handles form detection and autofilling

// Configuration
const EXTENSION_ID = 'n8n-form-autofiller';
const N8N_WEBHOOK_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';
const N8N_POLL_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';

let isInitialized = false;
let isPolling = false;
let pollInterval = null;
let processedData = null;
let isSlideOpen = false;

// Initialize the content script
function initialize() {
    if (isInitialized) return;
    
    console.log('N8N Form Autofiller content script initialized on:', window.location.href);
    isInitialized = true;
    
    // Add floating button and sliding panel
    addFloatingInterface();
    
    // Listen for form detection requests
    detectForms();
    
    // Load saved data
    loadSavedData();
}

// Add floating button and sliding panel interface
function addFloatingInterface() {
    // Only add if not already present
    if (document.querySelector(`#${EXTENSION_ID}-container`)) return;
    
    // Create container
    const container = document.createElement('div');
    container.id = `${EXTENSION_ID}-container`;
    container.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    // Create floating button
    const floatingBtn = document.createElement('div');
    floatingBtn.id = `${EXTENSION_ID}-floating-btn`;
    floatingBtn.style.cssText = `
        position: fixed;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        font-weight: bold;
        transition: all 0.3s ease;
        z-index: 10001;
    `;
    floatingBtn.innerHTML = '🤖';
    floatingBtn.title = 'N8N Form Autofiller';
    
    // Add hover effect to button
    floatingBtn.addEventListener('mouseenter', () => {
        floatingBtn.style.transform = 'translateY(-50%) scale(1.1)';
        floatingBtn.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.4)';
    });
    
    floatingBtn.addEventListener('mouseleave', () => {
        floatingBtn.style.transform = 'translateY(-50%) scale(1)';
        floatingBtn.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    });
    
         // Create sliding panel
     const slidingPanel = document.createElement('div');
     slidingPanel.id = `${EXTENSION_ID}-sliding-panel`;
     slidingPanel.style.cssText = `
         position: fixed;
         top: 50%;
         right: -420px;
         transform: translateY(-50%);
         width: 400px;
         max-height: 500px;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
         box-shadow: -5px 0 20px rgba(0, 0, 0, 0.3);
         transition: right 0.3s ease;
         z-index: 10000;
         overflow-y: auto;
         padding: 20px;
         box-sizing: border-box;
         border-radius: 15px 0 0 15px;
     `;
    
    // Create panel content
    slidingPanel.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 20px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 18px; font-weight: 600;">🤖 N8N Form Autofiller</h1>
                <button id="${EXTENSION_ID}-close-btn" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s;">×</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">URL to Process:</label>
                <input type="url" id="${EXTENSION_ID}-url-input" placeholder="https://example.com" required style="width: 100%; padding: 12px; border: none; border-radius: 8px; background: rgba(255, 255, 255, 0.9); color: #333; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="${EXTENSION_ID}-process-btn" style="flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-size: 14px; background: #4CAF50; color: white;">Process URL</button>
                <button id="${EXTENSION_ID}-autofill-btn" style="flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-size: 14px; background: #2196F3; color: white;" disabled>Autofill Form</button>
            </div>
            
            <div id="${EXTENSION_ID}-status" style="margin-top: 15px; padding: 10px; border-radius: 8px; font-size: 13px; text-align: center; display: none;"></div>
        </div>
    `;
    
    // Add panel to container
    container.appendChild(floatingBtn);
    container.appendChild(slidingPanel);
    document.body.appendChild(container);
    
    // Add event listeners
    setupEventListeners(floatingBtn, slidingPanel);
}

function setupEventListeners(floatingBtn, slidingPanel) {
    const urlInput = document.getElementById(`${EXTENSION_ID}-url-input`);
    const processBtn = document.getElementById(`${EXTENSION_ID}-process-btn`);
    const autofillBtn = document.getElementById(`${EXTENSION_ID}-autofill-btn`);
    const closeBtn = document.getElementById(`${EXTENSION_ID}-close-btn`);
    
    // Floating button click
    floatingBtn.addEventListener('click', () => {
        toggleSlidePanel(slidingPanel);
    });
    
    // Close button click
    closeBtn.addEventListener('click', () => {
        closeSlidePanel(slidingPanel);
    });
    
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (isSlideOpen && !slidingPanel.contains(e.target) && !floatingBtn.contains(e.target)) {
            closeSlidePanel(slidingPanel);
        }
    });
    
    // Process button click
    processBtn.addEventListener('click', () => {
        processUrl();
    });
    
    // Autofill button click
    autofillBtn.addEventListener('click', () => {
        autofillForm();
    });
    
    // Save URL when typing
    urlInput.addEventListener('input', () => {
        chrome.storage.local.set({ lastUrl: urlInput.value });
    });
    
    // Close button hover effect
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
    });
}

function toggleSlidePanel(panel) {
    if (isSlideOpen) {
        closeSlidePanel(panel);
    } else {
        openSlidePanel(panel);
    }
}

function openSlidePanel(panel) {
    panel.style.right = '0px';
    isSlideOpen = true;
}

function closeSlidePanel(panel) {
    panel.style.right = '-420px';
    isSlideOpen = false;
}

function loadSavedData() {
    // Load saved URL if any
    chrome.storage.local.get(['lastUrl'], (result) => {
        const urlInput = document.getElementById(`${EXTENSION_ID}-url-input`);
        if (result.lastUrl && urlInput) {
            urlInput.value = result.lastUrl;
        }
    });

    // Check if we have processed data
    chrome.storage.local.get(['processedData'], (result) => {
        const autofillBtn = document.getElementById(`${EXTENSION_ID}-autofill-btn`);
        if (result.processedData && autofillBtn) {
            processedData = result.processedData;
            autofillBtn.disabled = false;
            showStatus('Data ready for autofill', 'success');
        }
    });
}

async function processUrl() {
    const urlInput = document.getElementById(`${EXTENSION_ID}-url-input`);
    const processBtn = document.getElementById(`${EXTENSION_ID}-process-btn`);
    const autofillBtn = document.getElementById(`${EXTENSION_ID}-autofill-btn`);
    
    const url = urlInput.value.trim();
    
    if (!url) {
        showStatus('Please enter a valid URL', 'error');
        return;
    }

    if (!isValidUrl(url)) {
        showStatus('Please enter a valid URL format', 'error');
        return;
    }

    try {
        processBtn.disabled = true;
        autofillBtn.disabled = true;
        showStatus('Processing URL...', 'loading');

        // Send URL to n8n webhook
        const webhookUrl = `${N8N_WEBHOOK_URL}?url=${encodeURIComponent(url)}`;
        const response = await fetch(webhookUrl, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Webhook response:', result);

        // Check if we got data directly from the webhook
        if (result && Object.keys(result).length > 0 && !result.message) {
            // We got the processed data directly!
            processedData = result;
            chrome.storage.local.set({ processedData: result });
            
            processBtn.disabled = false;
            autofillBtn.disabled = false;
            showStatus('Data received! Ready to autofill form.', 'success');
        } else {
            // Start polling for results
            showStatus('URL sent successfully. Polling for results...', 'loading');
            startPolling();
        }

    } catch (error) {
        console.error('Error sending URL to n8n:', error);
        showStatus(`Error: ${error.message}`, 'error');
        processBtn.disabled = false;
    }
}

function startPolling() {
    if (isPolling) return;
    
    const processBtn = document.getElementById(`${EXTENSION_ID}-process-btn`);
    const autofillBtn = document.getElementById(`${EXTENSION_ID}-autofill-btn`);
    
    isPolling = true;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10-second intervals

    pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch(N8N_POLL_URL);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && Object.keys(data).length > 0) {
                    // We got data!
                    processedData = data;
                    chrome.storage.local.set({ processedData: data });
                    
                    stopPolling();
                    processBtn.disabled = false;
                    autofillBtn.disabled = false;
                    showStatus('Data received! Ready to autofill form.', 'success');
                    return;
                }
            }
            
            if (attempts >= maxAttempts) {
                stopPolling();
                processBtn.disabled = false;
                showStatus('Timeout: No data received after 5 minutes', 'error');
            } else {
                showStatus(`Polling for results... (${attempts}/${maxAttempts})`, 'loading');
            }
            
        } catch (error) {
            console.error('Polling error:', error);
            if (attempts >= maxAttempts) {
                stopPolling();
                processBtn.disabled = false;
                showStatus('Error polling for results', 'error');
            }
        }
    }, 10000); // Poll every 10 seconds
}

function stopPolling() {
    isPolling = false;
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function autofillForm() {
    if (!processedData) {
        showStatus('No data to autofill. Process a URL first.', 'error');
        return;
    }

    try {
        console.log('Attempting to autofill with data:', processedData);
        
        const filledCount = autofillFormAdvanced(processedData);
        
        if (filledCount > 0) {
            showStatus(`Form autofilled successfully! Filled ${filledCount} fields.`, 'success');
            
            // Optional: Close panel after successful autofill
            setTimeout(() => {
                const slidingPanel = document.getElementById(`${EXTENSION_ID}-sliding-panel`);
                closeSlidePanel(slidingPanel);
            }, 2000);
        } else {
            showStatus('No fields were filled. Check if the page has compatible forms.', 'error');
        }

    } catch (error) {
        console.error('Error autofilling form:', error);
        showStatus(`Error autofilling: ${error.message}`, 'error');
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.className = '';
    
    // Set background color based on type
    let backgroundColor, borderColor;
    switch (type) {
        case 'loading':
            backgroundColor = 'rgba(255, 193, 7, 0.3)';
            borderColor = '#ffc107';
            break;
        case 'success':
            backgroundColor = 'rgba(76, 175, 80, 0.3)';
            borderColor = '#4caf50';
            break;
        case 'error':
            backgroundColor = 'rgba(244, 67, 54, 0.3)';
            borderColor = '#f44336';
            break;
        default:
            backgroundColor = 'rgba(33, 150, 243, 0.3)';
            borderColor = '#2196f3';
    }
    
    statusDiv.style.background = backgroundColor;
    statusDiv.style.border = `1px solid ${borderColor}`;
    
    if (type === 'loading') {
        statusDiv.innerHTML = `<span style="border: 2px solid #f3f3f3; border-top: 2px solid #333; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; margin-right: 8px;"></span>${message}`;
        
        // Add keyframes for spinner animation
        if (!document.querySelector('#spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        statusDiv.textContent = message;
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Detect forms on the page
function detectForms() {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input, textarea, select');
    
    console.log(`Found ${forms.length} forms and ${inputs.length} input fields on this page`);
    
    // Store form information for potential autofilling
    const formData = {
        url: window.location.href,
        forms: forms.length,
        fields: Array.from(inputs).map(input => ({
            name: input.name || '',
            id: input.id || '',
            type: input.type || input.tagName.toLowerCase(),
            placeholder: input.placeholder || '',
            className: input.className || ''
        }))
    };
    
    // Send form data to background script
    chrome.runtime.sendMessage({
        action: 'storePageInfo',
        data: formData
    }).catch(error => {
        console.log('Could not send message to background script:', error);
    });
}

// Main autofill function (enhanced version)
function autofillFormAdvanced(data) {
    console.log('Advanced autofill starting with data:', data);
    
    // Flatten and normalize the data structure
    const flattenedData = flattenData(data);
    console.log('Flattened data:', flattenedData);
    console.log('Keys in flattened data:', Object.keys(flattenedData));
    
    let filledFields = 0;
    const fieldMappings = {
        // Business information - direct field mappings
        'businessName': ['businessname', 'business_name', 'company_name', 'business', 'company', 'organization'],
        'doingBusinessAs': ['dba', 'dba_name', 'doing_business_as', 'trade_name', 'dbaname'],
        'businessWebsite': ['website', 'url', 'website_url', 'site', 'homepage', 'web_site'],
        'natureOfOperations': ['description', 'business_description', 'operations', 'nature_of_business', 'business_type', 'type_of_business'],
        'naics': ['naics_code', 'naics', 'industry_code', 'sic_code'],
        'fein': ['fein', 'ein', 'employer_id', 'tax_id', 'federal_tax_id'],
        'annualRevenue': ['revenue', 'annual_revenue', 'income', 'gross_revenue', 'annual_income'],
        'yearsOfManagementExperience': ['experience', 'management_experience', 'years_experience', 'management_years','yearsOfExperience'],
        'yearOfFounding': ['start_year', 'year_started', 'founded', 'established', 'year_founded', 'founding_year'],
        'isNonProfit': ['nonprofit', 'non_profit', 'non-profit', 'is_nonprofit', 'non_profit_status'],
        
        // Contact information - from contacts array
        'phone': ['phone', 'telephone', 'phonenumber', 'phone_number', 'contact_phone', 'business_phone', 'office_phone'],
        'email': ['email', 'emailaddress', 'email_address', 'user_email', 'contact_email', 'business_email'],
        'fax': ['fax', 'fax_number', 'fax_phone', 'facsimile'],
        
        // Address fields - from mailingAddress object
        'street': ['address', 'street', 'address1', 'street_address', 'mailing_address', 'business_address'],
        'city': ['city', 'town', 'locality', 'business_city'],
        'state': ['state', 'province', 'region', 'business_state'],
        'zip': ['zip', 'zipcode', 'postal', 'postalcode', 'postcode', 'business_zip'],
        'zipCode': ['zip', 'zipcode', 'postal', 'postalcode', 'postcode', 'business_zip'],
    };
    
    // Process each field in the flattened data
    for (const [key, value] of Object.entries(flattenedData)) {
        if (value === null || value === undefined || value === '') continue;
        
        console.log(`Trying to fill field: ${key} = ${value}`);
        const element = findFormElementAdvanced(key, value, fieldMappings);
        if (element) {
            console.log(`Found element for ${key}:`, element.name || element.id || element.placeholder);
            if (fillField(element, value)) {
                filledFields++;
            }
        } else {
            console.log(`No element found for ${key}`);
        }
    }
    
    console.log(`Advanced autofill completed. Filled ${filledFields} fields.`);
    showNotification(`✅ Autofilled ${filledFields} fields successfully!`, 'success');
    
    return filledFields;
}

// Helper function to flatten nested data structures
function flattenData(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively flatten nested objects
            Object.assign(flattened, flattenData(value, newKey));
            
            // Also add individual nested fields directly
            Object.assign(flattened, flattenData(value, ''));
        } else {
            flattened[newKey] = value;
            // Also add without prefix for easier matching
            if (prefix) {
                flattened[key] = value;
            }
        }
    }
    
    return flattened;
}

// Enhanced function to find form elements
function findFormElementAdvanced(key, value, fieldMappings) {
    let element = null;
    const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // 1. Try exact matches first
    const exactSelectors = [
        `input[name="${key}"]`,
        `input[id="${key}"]`,
        `textarea[name="${key}"]`,
        `textarea[id="${key}"]`,
        `select[name="${key}"]`,
        `select[id="${key}"]`
    ];
    
    for (const selector of exactSelectors) {
        element = document.querySelector(selector);
        if (element) return element;
    }
    
    // 2. Try mapped field names
    const mappedFields = fieldMappings[key] || [];
    for (const mappedField of mappedFields) {
        const mappedSelectors = [
            `input[name="${mappedField}"]`,
            `input[id="${mappedField}"]`,
            `input[name*="${mappedField}"]`,
            `input[id*="${mappedField}"]`,
            `textarea[name="${mappedField}"]`,
            `textarea[id="${mappedField}"]`,
            `select[name="${mappedField}"]`,
            `select[id="${mappedField}"]`
        ];
        
        for (const selector of mappedSelectors) {
            element = document.querySelector(selector);
            if (element) return element;
        }
    }
    
    return null;
}

// Fill a specific field with a value
function fillField(element, value) {
    try {
        const tagName = element.tagName.toLowerCase();
        const type = element.type ? element.type.toLowerCase() : '';
        let success = false;
        
        // Handle different input types
        switch (type) {
            case 'radio':
                success = fillRadioButtonAdvanced(element, value);
                break;
                
            case 'checkbox':
                success = fillCheckboxAdvanced(element, value);
                break;
                
            case 'date':
                success = fillDateFieldAdvanced(element, value);
                break;
                
            case 'email':
                if (isValidEmail(value)) {
                    element.value = value;
                    success = true;
                }
                break;
                
            case 'url':
                if (isValidUrl(value)) {
                    element.value = value;
                    success = true;
                }
                break;
                
            case 'tel':
                element.value = formatPhoneNumber(value);
                success = true;
                break;
                
            case 'number':
                element.value = value.toString();
                success = true;
                break;
                
            default:
                if (tagName === 'select') {
                    success = fillSelectElementAdvanced(element, value);
                } else {
                    element.value = value.toString();
                    success = true;
                }
                break;
        }
        
        if (success) {
            // Trigger events to ensure form validation and updates
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // Visual feedback
            highlightField(element);
        }
        
        return success;
    } catch (error) {
        console.error('Error filling field:', error);
        return false;
    }
}

// Enhanced helper functions for specific field types
function fillRadioButtonAdvanced(element, value) {
    const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
    
    for (const radio of radioGroup) {
        const radioValue = radio.value.toLowerCase();
        const valueStr = value.toString().toLowerCase();
        
        if (radioValue === valueStr || 
            (value === true && (radioValue === 'yes' || radioValue === 'true' || radioValue === '1')) ||
            (value === false && (radioValue === 'no' || radioValue === 'false' || radioValue === '0'))) {
            radio.checked = true;
            return true;
        }
    }
    return false;
}

function fillCheckboxAdvanced(element, value) {
    if (value === true || value === 'Yes' || value === 'true' || value === '1') {
        element.checked = true;
    } else if (value === false || value === 'No' || value === 'false' || value === '0') {
        element.checked = false;
    }
    return true;
}

function fillDateFieldAdvanced(element, value) {
    try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            element.value = `${year}-${month}-${day}`;
            return true;
        }
    } catch (error) {
        console.error('Error formatting date:', error);
    }
    return false;
}

function fillSelectElementAdvanced(element, value) {
    const options = element.querySelectorAll('option');
    const valueStr = value.toString().toLowerCase();
    
    for (const option of options) {
        const optionValue = option.value.toLowerCase();
        const optionText = option.textContent.toLowerCase();
        
        if (optionValue === valueStr || optionText === valueStr ||
            optionValue.includes(valueStr) || optionText.includes(valueStr)) {
            element.value = option.value;
            return true;
        }
    }
    return false;
}

// Get label text for a field
function getFieldLabel(element) {
    // Try to find associated label
    if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) return label.textContent.trim();
    }
    
    // Try to find parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    
    // Try to find preceding label
    let prev = element.previousElementSibling;
    while (prev) {
        if (prev.tagName.toLowerCase() === 'label') {
            return prev.textContent.trim();
        }
        prev = prev.previousElementSibling;
    }
    
    return '';
}

// Highlight a field that was filled
function highlightField(element) {
    const originalBackground = element.style.backgroundColor;
    const originalBorder = element.style.border;
    
    element.style.backgroundColor = '#e8f5e8';
    element.style.border = '2px solid #4CAF50';
    element.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
        element.style.backgroundColor = originalBackground;
        element.style.border = originalBorder;
    }, 2000);
}

// Show notification on the page
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector(`#${EXTENSION_ID}-notification`);
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = `${EXTENSION_ID}-notification`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10002;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        word-wrap: break-word;
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
        transition: all 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function formatPhoneNumber(phone) {
    // Basic phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Also initialize on dynamic content changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if new forms were added
            const hasNewForms = Array.from(mutation.addedNodes).some(node => 
                node.nodeType === 1 && (
                    node.tagName === 'FORM' || 
                    node.querySelector && node.querySelector('form')
                )
            );
            
            if (hasNewForms) {
                setTimeout(detectForms, 500); // Delay to allow full rendering
            }
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    switch (request.action) {
        case 'ping':
            sendResponse({ success: true, message: 'Content script is active' });
            break;
            
        case 'autofill':
            const filledCount = autofillFormAdvanced(request.data);
            sendResponse({ success: true, filledFields: filledCount });
            break;
            
        case 'detectForms':
            detectForms();
            sendResponse({ success: true });
            break;
            
        case 'highlight':
            // Highlight all form fields
            const inputs = document.querySelectorAll('input, textarea, select');
            inputs.forEach(input => highlightField(input));
            sendResponse({ success: true, fieldCount: inputs.length });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep the message channel open for async response
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    stopPolling();
});

console.log('N8N Form Autofiller content script loaded'); 