// Configuration
const N8N_WEBHOOK_URL = 'https://somil.app.n8n.cloud/webhook/14591d83-e679-486d-a00e-1ab2e05e9894';
const N8N_POLL_URL = 'https://somil.app.n8n.cloud/webhook/get-data'; // You'll need to set this up in n8n

let isPolling = false;
let pollInterval = null;
let processedData = null;

// DOM elements
const urlInput = document.getElementById('urlInput');
const processBtn = document.getElementById('processBtn');
const autofillBtn = document.getElementById('autofillBtn');
const statusDiv = document.getElementById('status');

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load saved URL if any
    chrome.storage.local.get(['lastUrl'], (result) => {
        if (result.lastUrl) {
            urlInput.value = result.lastUrl;
        }
    });

    // Check if we have processed data
    chrome.storage.local.get(['processedData'], (result) => {
        if (result.processedData) {
            processedData = result.processedData;
            autofillBtn.disabled = false;
            showStatus('Data ready for autofill', 'success');
        }
    });
});

processBtn.addEventListener('click', processUrl);
autofillBtn.addEventListener('click', autofillForm);

// Save URL when typing
urlInput.addEventListener('input', () => {
    chrome.storage.local.set({ lastUrl: urlInput.value });
});

async function processUrl() {
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

        // Send URL to n8n webhook (using GET request with URL parameter)
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
            // Start polling for results (if you set up a separate polling endpoint later)
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
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            showStatus('No active tab found', 'error');
            return;
        }

        // Inject the content script and autofill
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: autofillFormOnPage,
            args: [processedData]
        });

        showStatus('Form autofilled successfully!', 'success');
        
        // Optional: Close popup after successful autofill
        setTimeout(() => {
            window.close();
        }, 2000);

    } catch (error) {
        console.error('Error autofilling form:', error);
        showStatus(`Error autofilling: ${error.message}`, 'error');
    }
}

// This function will be injected into the page
function autofillFormOnPage(data) {
    console.log('Autofilling form with data:', data);
    
    // Flatten and normalize the data structure
    const flattenedData = flattenData(data);
    console.log('Flattened data:', flattenedData);
    
    let filledFields = 0;
    
    // Enhanced field mappings for your specific data format
    const fieldMappings = {
        // Business information
        'Name of Business': ['businessname', 'business_name', 'company_name', 'name', 'business'],
        'DBA Name': ['dba', 'dba_name', 'doing_business_as', 'trade_name'],
        'Website URL': ['website', 'url', 'website_url', 'site', 'homepage'],
        'Business entity type': ['entity_type', 'business_type', 'entity', 'type'],
        'Is the Business non-profit?': ['nonprofit', 'non_profit', 'non-profit'],
        'Year the Business was started': ['start_year', 'year_started', 'founded', 'established'],
        'Description of Business operations': ['description', 'business_description', 'operations'],
        'Years of management experience in industry': ['experience', 'management_experience', 'years_experience'],
        'Annual revenue': ['revenue', 'annual_revenue', 'income'],
        'Total Number of Full-Time Employees': ['full_time_employees', 'fulltime_employees', 'employees'],
        'Total Number of Part-Time Employees': ['part_time_employees', 'parttime_employees'],
        'Total Payroll': ['payroll', 'total_payroll'],
        
        // Personal information
        'First Name': ['firstname', 'first_name', 'fname', 'given_name'],
        'Last Name': ['lastname', 'last_name', 'lname', 'family_name', 'surname'],
        'Phone Number': ['phone', 'telephone', 'phonenumber', 'phone_number', 'contact_phone'],
        'Email': ['email', 'emailaddress', 'email_address', 'user_email', 'contact_email'],
        
        // Address fields
        'Street': ['address', 'street', 'address1', 'street_address'],
        'City': ['city', 'town', 'locality'],
        'State': ['state', 'province', 'region'],
        'ZIP': ['zip', 'zipcode', 'postal', 'postalcode', 'postcode'],
        
        // Policy dates
        'Policy Effective Date': ['effective_date', 'start_date', 'policy_start'],
        'Policy Expiration Date': ['expiration_date', 'end_date', 'policy_end'],
        
        // Special fields
        'Mailing address is same as Primary address?': ['same_address', 'mailing_same', 'address_same']
    };
    
    // Process each field in the flattened data
    for (const [key, value] of Object.entries(flattenedData)) {
        if (value === null || value === undefined || value === '') continue;
        
        const element = findFormElement(key, value, fieldMappings);
        if (element && fillFormElement(element, value, key)) {
            filledFields++;
        }
    }
    
    console.log(`Autofilled ${filledFields} fields`);
    
    // Show a notification on the page
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    notification.textContent = `✅ Autofilled ${filledFields} fields`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
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
function findFormElement(key, value, fieldMappings) {
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
    
    // 3. Try fuzzy matching with cleaned key
    const allInputs = document.querySelectorAll('input, textarea, select');
    for (const input of allInputs) {
        const name = (input.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const id = (input.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const placeholder = (input.placeholder || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const label = getFieldLabel(input).toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (name.includes(keyLower) || id.includes(keyLower) || 
            placeholder.includes(keyLower) || label.includes(keyLower) ||
            keyLower.includes(name) || keyLower.includes(id)) {
            return input;
        }
    }
    
    return null;
}

// Enhanced function to fill form elements
function fillFormElement(element, value, fieldName) {
    try {
        const tagName = element.tagName.toLowerCase();
        const type = element.type ? element.type.toLowerCase() : '';
        
        // Handle different input types based on the field name and value
        switch (type) {
            case 'radio':
                return fillRadioButton(element, value, fieldName);
            case 'checkbox':
                return fillCheckbox(element, value, fieldName);
            case 'date':
                return fillDateField(element, value);
            case 'email':
                if (isValidEmail(value)) {
                    element.value = value;
                    return true;
                }
                break;
            case 'url':
                if (isValidUrl(value)) {
                    element.value = value;
                    return true;
                }
                break;
            case 'tel':
                element.value = formatPhoneNumber(value);
                return true;
            case 'number':
                element.value = value.toString();
                return true;
            default:
                if (tagName === 'select') {
                    return fillSelectElement(element, value);
                } else {
                    element.value = value.toString();
                    return true;
                }
        }
        
        // Trigger events to ensure form validation
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Visual feedback
        element.style.backgroundColor = '#e8f5e8';
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 2000);
        
        return true;
    } catch (error) {
        console.error('Error filling element:', error);
        return false;
    }
}

// Helper functions for specific field types
function fillRadioButton(element, value, fieldName) {
    const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
    
    for (const radio of radioGroup) {
        const radioValue = radio.value.toLowerCase();
        const valueStr = value.toString().toLowerCase();
        
        if (radioValue === valueStr || 
            (value === true && (radioValue === 'yes' || radioValue === 'true' || radioValue === '1')) ||
            (value === false && (radioValue === 'no' || radioValue === 'false' || radioValue === '0'))) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    return false;
}

function fillCheckbox(element, value, fieldName) {
    if (value === true || value === 'Yes' || value === 'true' || value === '1') {
        element.checked = true;
    } else if (value === false || value === 'No' || value === 'false' || value === '0') {
        element.checked = false;
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function fillDateField(element, value) {
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

function fillSelectElement(element, value) {
    const options = element.querySelectorAll('option');
    const valueStr = value.toString().toLowerCase();
    
    for (const option of options) {
        const optionValue = option.value.toLowerCase();
        const optionText = option.textContent.toLowerCase();
        
        if (optionValue === valueStr || optionText === valueStr ||
            optionValue.includes(valueStr) || optionText.includes(valueStr)) {
            element.value = option.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    return false;
}

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

function formatPhoneNumber(phone) {
    const cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone.toString();
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function showStatus(message, type) {
    statusDiv.style.display = 'block';
    statusDiv.className = `status-${type}`;
    
    if (type === 'loading') {
        statusDiv.innerHTML = `<span class="spinner"></span>${message}`;
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

// Clean up when popup closes
window.addEventListener('beforeunload', () => {
    stopPolling();
}); 