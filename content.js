// Content script for N8N Form Autofiller extension
// This script runs on all web pages and handles form detection and autofilling

// Configuration
const EXTENSION_ID = 'n8n-form-autofiller';
let isInitialized = false;

// Initialize the content script
function initialize() {
    if (isInitialized) return;
    
    console.log('N8N Form Autofiller content script initialized on:', window.location.href);
    isInitialized = true;
    
    // Add visual indicator that the extension is active
    addExtensionIndicator();
    
    // Listen for form detection requests
    detectForms();
}

// Add a small visual indicator that the extension is active
function addExtensionIndicator() {
    // Only add if not already present
    if (document.querySelector(`#${EXTENSION_ID}-indicator`)) return;
    
    const indicator = document.createElement('div');
    indicator.id = `${EXTENSION_ID}-indicator`;
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        z-index: 9999;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 16px;
        font-weight: bold;
        opacity: 0.7;
        transition: all 0.3s ease;
    `;
    indicator.innerHTML = '🤖';
    indicator.title = 'N8N Form Autofiller - Click to open';
    
    // Add hover effect
    indicator.addEventListener('mouseenter', () => {
        indicator.style.opacity = '1';
        indicator.style.transform = 'scale(1.1)';
    });
    
    indicator.addEventListener('mouseleave', () => {
        indicator.style.opacity = '0.7';
        indicator.style.transform = 'scale(1)';
    });
    
    // Click to open extension popup (if possible)
    indicator.addEventListener('click', () => {
        // We can't directly open the popup from content script,
        // but we can show a message
        showNotification('Click the extension icon in the toolbar to open N8N Form Autofiller', 'info');
    });
    
    document.body.appendChild(indicator);
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

// Main autofill function (enhanced version of the one in popup.js)
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
    
    // 3. Try fuzzy matching with cleaned key (DISABLED - using exact matches only)
    // const allInputs = document.querySelectorAll('input, textarea, select');
    // for (const input of allInputs) {
    //     const name = (input.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    //     const id = (input.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    //     const placeholder = (input.placeholder || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    //     const label = getFieldLabel(input).toLowerCase().replace(/[^a-z0-9]/g, '');
    //     
    //     // For boolean values, only match to checkbox/radio fields or exact matches
    //     if (typeof value === 'boolean') {
    //         const inputType = input.type ? input.type.toLowerCase() : '';
    //         if (inputType === 'checkbox' || inputType === 'radio') {
    //             if (name.includes(keyLower) || id.includes(keyLower) || 
    //                 placeholder.includes(keyLower) || label.includes(keyLower)) {
    //                 return input;
    //             }
    //         }
    //         // Skip fuzzy matching for boolean values to prevent false matches
    //         continue;
    //     }
    //     
    //     // For zip/zipCode fields, be very specific to avoid matching business name fields
    //     if (keyLower === 'zip' || keyLower === 'zipcode') {
    //         // Only match to fields that are clearly zip-related
    //         const zipRelatedTerms = ['zip', 'zipcode', 'postal', 'postcode'];
    //         const fieldText = (name + ' ' + id + ' ' + placeholder + ' ' + label).toLowerCase();
    //             
    //         if (zipRelatedTerms.some(term => fieldText.includes(term))) {
    //             return input;
    //         }
    //         // Skip fuzzy matching for zip fields to prevent false matches
    //         continue;
    //     }
    //     
    //     // More precise fuzzy matching - avoid bidirectional matching for short keys
    //     if (name.includes(keyLower) || id.includes(keyLower) || 
    //         placeholder.includes(keyLower) || label.includes(keyLower)) {
    //         console.log(`Fuzzy match found for ${key} (${keyLower}):`, input.name || input.id || input.placeholder);
    //         return input;
    //     }
    //     
    //     // Only do bidirectional matching for longer keys (4+ characters) to avoid false matches
    //     // This prevents short keys like 'zip' from matching longer field names
    //     if (keyLower.length >= 4 && (keyLower.includes(name) || keyLower.includes(id))) {
    //         console.log(`Bidirectional match found for ${key} (${keyLower}):`, input.name || input.id || input.placeholder);
    //         return input;
    //     }
    // }
    
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
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        word-wrap: break-word;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Utility functions
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

function formatPhoneNumber(phone) {
    // Basic phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}



// Note: Message listener moved to end of file to avoid duplicates

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

// Listen for messages from popup
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

console.log('N8N Form Autofiller content script loaded'); 