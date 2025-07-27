// Content script for N8N Form Autofiller extension
// This script runs on all web pages and handles form detection and autofilling

// Configuration
const EXTENSION_ID = 'n8n-form-autofiller';
// const N8N_WEBHOOK_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';
// const N8N_POLL_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';

const N8N_WEBHOOK_URL = 'https://cf-omega.app.n8n.cloud/webhook-test/954484f2-69e7-40e0-b666-361b97415359';
const N8N_POLL_URL = 'https://cf-omega.app.n8n.cloud/webhook-test/954484f2-69e7-40e0-b666-361b97415359';

// const N8N_WEBHOOK_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';
// const N8N_POLL_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';


// const N8N_WEBHOOK_URL = 'https://cf-omega.app.n8n.cloud/webhook-test/8d59f19b-8c40-4359-ba67-3551a75384b3';
// const N8N_POLL_URL = 'https://cf-omega.app.n8n.cloud/webhook-test/8d59f19b-8c40-4359-ba67-3551a75384b3';


let isInitialized = false;
let isPolling = false;
let pollInterval = null;
let processedData = null;
let isSlideOpen = false;

// Helper function to check if extension context is still valid
function isExtensionContextValid() {
    try {
        return chrome.runtime && chrome.runtime.id;
    } catch (error) {
        return false;
    }
}

// Safe wrapper for chrome storage operations
function safeStorageGet(keys, callback) {
    if (!isExtensionContextValid()) {
        console.log('Extension context invalidated, skipping storage get');
        return;
    }
    
    try {
        chrome.storage.local.get(keys, callback);
    } catch (error) {
        console.log('Storage get failed:', error);
    }
}

function safeStorageSet(data) {
    if (!isExtensionContextValid()) {
        console.log('Extension context invalidated, skipping storage set');
        return;
    }
    
    try {
        chrome.storage.local.set(data);
    } catch (error) {
        console.log('Storage set failed:', error);
    }
}

// Safe wrapper for chrome runtime messages
function safeSendMessage(message, callback = null) {
    if (!isExtensionContextValid()) {
        console.log('Extension context invalidated, skipping message send');
        return;
    }
    
    try {
        if (callback) {
            chrome.runtime.sendMessage(message, callback);
        } else {
            chrome.runtime.sendMessage(message).catch(error => {
                console.log('Message send failed:', error);
            });
        }
    } catch (error) {
        console.log('Message send failed:', error);
    }
}

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
         bottom: 20px;
         right: 20px;
         width: 50px;
         height: 50px;
         background: white;
         border-radius: 50%;
         cursor: pointer;
         box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
         display: flex;
         align-items: center;
         justify-content: center;
         color: white;
         font-size: 20px;
         font-weight: bold;
         transition: all 0.3s ease;
         z-index: 10001;
         border: 2px solid rgba(98, 77, 227, 0.2);
    `;
    floatingBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/intellifill-icon.svg')}" style="width: 28px; height: 28px;" alt="IntelliFill">`;
    floatingBtn.title = 'IntelliFill';
    
         // Add hover effect to button
     floatingBtn.addEventListener('mouseenter', () => {
         floatingBtn.style.transform = 'scale(1.1)';
         floatingBtn.style.boxShadow = '0 6px 25px rgba(98, 77, 227, 0.3)';
         floatingBtn.style.background = '#f8fafc';
         floatingBtn.style.borderColor = 'rgba(98, 77, 227, 0.4)';
     });
     
     floatingBtn.addEventListener('mouseleave', () => {
         floatingBtn.style.transform = 'scale(1)';
         floatingBtn.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
         floatingBtn.style.background = 'white';
         floatingBtn.style.borderColor = 'rgba(98, 77, 227, 0.2)';
     });
    
         // Create sliding panel
     const slidingPanel = document.createElement('div');
     slidingPanel.id = `${EXTENSION_ID}-sliding-panel`;
     slidingPanel.style.cssText = `
         position: fixed;
         bottom: 80px;
         right: 20px;
         width: 400px;
         height: auto;
         max-height: 70vh;
         background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e7e3ff 100%);
         transition: all 0.3s ease;
         z-index: 10000;
         overflow-y: auto;
         padding: 15px;
         box-sizing: border-box;
         border-radius: 15px;
         border: 2px solid #624de3;
         transform: translateY(100%) scale(0.9);
         opacity: 0;
         pointer-events: none;
     `;
    
    // Create panel content
    slidingPanel.innerHTML = `
                 <div style="background: rgba(255, 255, 255, 0.9); border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); color: #1f2937; border: 1px solid rgba(98, 77, 227, 0.2);">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                 <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: #624de3; display: flex; align-items: center; gap: 8px;"><img src="${chrome.runtime.getURL('icons/intellifill-icon.svg')}" style="width: 24px; height: 24px;" alt="IntelliFill"> IntelliFill</h1>
                                 <button id="${EXTENSION_ID}-close-btn" style="background: none; border: none; color: #6b7280; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;">×</button>
            </div>
            
                         <div style="margin-bottom: 12px;">
                 <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 14px; color: #374151;">URL to Process:</label>
                 <input type="text" id="${EXTENSION_ID}-url-input" placeholder="example.com or https://example.com" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #374151; font-size: 14px; box-sizing: border-box; transition: border-color 0.2s; outline: none;">
             </div>
             
             <div style="margin-bottom: 12px;">
                 <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 14px; color: #374151;">Data to Process:</label>
                 <textarea id="${EXTENSION_ID}-data-input" placeholder="Enter any unstructured data to process..." style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #374151; font-size: 14px; box-sizing: border-box; min-height: 70px; resize: vertical; font-family: inherit; transition: border-color 0.2s; outline: none;"></textarea>
             </div>
             
             <div style="margin-bottom: 12px; padding: 8px 10px; background: linear-gradient(135deg, rgba(98, 77, 227, 0.1) 0%, rgba(54, 57, 164, 0.1) 100%); border: 1px solid rgba(98, 77, 227, 0.3); border-radius: 6px; font-size: 12px; color: #4b5563;">
                 <strong style="color: #624de3;">Note:</strong> Please provide either a URL or data (or both).
             </div>
            
                         <div style="display: flex; gap: 10px; margin-top: 16px;">
                                 <button id="${EXTENSION_ID}-super-paste-btn" style="flex: 1; padding: 12px; border: 1px solid #624de3; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-size: 14px; background: #624de3; color: white;">Super Paste</button>
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
    const dataInput = document.getElementById(`${EXTENSION_ID}-data-input`);
    const superPasteBtn = document.getElementById(`${EXTENSION_ID}-super-paste-btn`);
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
    
    // Super Paste button click - combines both process and autofill
    superPasteBtn.addEventListener('click', () => {
        processAndAutofill();
    });
    
    // Save URL when typing
    urlInput.addEventListener('input', () => {
        safeStorageSet({ lastUrl: urlInput.value });
    });
    
    // Save data when typing
    dataInput.addEventListener('input', () => {
        safeStorageSet({ lastData: dataInput.value });
    });
    
    // Add focus effects for inputs
    urlInput.addEventListener('focus', () => {
        urlInput.style.borderColor = '#624de3';
        urlInput.style.boxShadow = '0 0 0 3px rgba(98, 77, 227, 0.1)';
    });
    
    urlInput.addEventListener('blur', () => {
        urlInput.style.borderColor = '#d1d5db';
        urlInput.style.boxShadow = 'none';
    });
    
    dataInput.addEventListener('focus', () => {
        dataInput.style.borderColor = '#624de3';
        dataInput.style.boxShadow = '0 0 0 3px rgba(98, 77, 227, 0.1)';
    });
    
    dataInput.addEventListener('blur', () => {
        dataInput.style.borderColor = '#d1d5db';
        dataInput.style.boxShadow = 'none';
    });
    
    // Close button hover effect
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(107, 114, 128, 0.1)';
        closeBtn.style.color = '#374151';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
        closeBtn.style.color = '#6b7280';
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
    panel.style.transform = 'translateY(0) scale(1)';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    isSlideOpen = true;
}

function closeSlidePanel(panel) {
    panel.style.transform = 'translateY(100%) scale(0.9)';
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    isSlideOpen = false;
}

function loadSavedData() {
    // Load saved URL if any
    safeStorageGet(['lastUrl'], (result) => {
        const urlInput = document.getElementById(`${EXTENSION_ID}-url-input`);
        if (result && result.lastUrl && urlInput) {
            urlInput.value = result.lastUrl;
        }
    });
    
    // Load saved data if any
    safeStorageGet(['lastData'], (result) => {
        const dataInput = document.getElementById(`${EXTENSION_ID}-data-input`);
        if (result && result.lastData && dataInput) {
            dataInput.value = result.lastData;
        }
    });

    // Check if we have processed data
    safeStorageGet(['processedData'], (result) => {
        if (result && result.processedData) {
            processedData = result.processedData;
            showStatus('Previously processed data available', 'success');
        }
    });
}

// Function to extract clean form content from the page
function getCleanFormContent() {
    try {
        console.log('Starting form content extraction...');
        const cleanContent = [];
        
        // First, try to find and process forms
        const forms = document.querySelectorAll('form');
        console.log(`Found ${forms.length} forms on the page`);
        
        forms.forEach((form, index) => {
            // Skip if this is part of the extension panel
            if (form.closest(`#${EXTENSION_ID}-container`)) {
                console.log(`Skipping form ${index} - part of extension`);
                return;
            }
            
            console.log(`Processing form ${index}`);
            const cleanHtml = cleanElement(form.cloneNode(true));
            if (cleanHtml.trim()) {
                cleanContent.push(`<!-- Form ${index + 1} -->\n${cleanHtml}`);
                console.log(`Added form ${index} content, length: ${cleanHtml.length}`);
            }
        });
        
        // If no forms found, or as additional content, look for input containers
        const inputs = document.querySelectorAll('input, textarea, select');
        console.log(`Found ${inputs.length} input elements on the page`);
        
        if (forms.length === 0 && inputs.length > 0) {
            console.log('No forms found, but inputs exist. Looking for input containers...');
            
            // Group inputs by their containers
            const processedContainers = new Set();
            
            inputs.forEach((input, index) => {
                // Skip extension inputs
                if (input.closest(`#${EXTENSION_ID}-container`)) return;
                
                // Find a meaningful container
                let container = input.closest('main, section, article, div[class*="form"], div[class*="container"], div[class*="content"]') || 
                               input.closest('div') || 
                               input.parentElement;
                
                if (container && !processedContainers.has(container)) {
                    processedContainers.add(container);
                    console.log(`Processing input container ${index} for input: ${input.name || input.id || input.type}`);
                    
                    const cleanHtml = cleanElement(container.cloneNode(true));
                    if (cleanHtml.trim()) {
                        cleanContent.push(`<!-- Input Container ${processedContainers.size} -->\n${cleanHtml}`);
                        console.log(`Added input container content, length: ${cleanHtml.length}`);
                    }
                }
            });
        }
        
        // If still no content, try broader selectors
        if (cleanContent.length === 0) {
            console.log('No content found yet, trying broader selectors...');
            
            const potentialContainers = document.querySelectorAll(
                'main, [role="main"], .main-content, .content, .page-content, ' +
                '[class*="form"], [id*="form"], [class*="application"], [class*="questionnaire"]'
            );
            
            console.log(`Found ${potentialContainers.length} potential containers`);
            
            potentialContainers.forEach((container, index) => {
                if (container.closest(`#${EXTENSION_ID}-container`)) return;
                
                // Check if this container has any form elements or substantial text
                const hasFormElements = container.querySelector('input, textarea, select, button');
                const textContent = container.textContent.trim();
                const hasSubstantialText = textContent.length > 50;
                
                console.log(`Container ${index}: hasFormElements=${!!hasFormElements}, textLength=${textContent.length}`);
                
                if (hasFormElements || hasSubstantialText) {
                    const cleanHtml = cleanElement(container.cloneNode(true));
                    if (cleanHtml.trim()) {
                        cleanContent.push(`<!-- Container ${index + 1} -->\n${cleanHtml}`);
                        console.log(`Added container ${index} content, length: ${cleanHtml.length}`);
                    }
                }
            });
        }
        
        // Final fallback - get body content if nothing else worked
        if (cleanContent.length === 0) {
            console.log('No content found with specific selectors, using body fallback...');
            const bodyClone = document.body.cloneNode(true);
            const cleanHtml = cleanElement(bodyClone);
            if (cleanHtml.trim()) {
                cleanContent.push(`<!-- Body Content -->\n${cleanHtml}`);
                console.log(`Added body content as fallback, length: ${cleanHtml.length}`);
            }
        }
        
        const result = cleanContent.join('\n\n');
        console.log(`Final page source length: ${result.length}`);
        console.log('Page source preview:', result.substring(0, 500) + '...');
        
        return result;
        
    } catch (error) {
        console.error('Error extracting form content:', error);
        console.error('Error stack:', error.stack);
        
        // Emergency fallback - just return a simplified body content
        try {
            const bodyText = document.body.innerText;
            console.log('Using emergency fallback with body text, length:', bodyText.length);
            return `<!-- Emergency Fallback -->\n${bodyText}`;
        } catch (fallbackError) {
            console.error('Even fallback failed:', fallbackError);
            return 'Error extracting page content';
        }
    }
}

// Function to clean an element by removing unnecessary content
function cleanElement(element) {
    try {
        console.log('Cleaning element:', element.tagName, element.className || element.id || '');
        
        // Remove only the most obvious non-content elements
        const elementsToRemove = element.querySelectorAll(
            'script, style, noscript'
        );
        console.log(`Removing ${elementsToRemove.length} script/style elements`);
        elementsToRemove.forEach(el => el.remove());
        
        // Remove extension elements
        const extensionElements = element.querySelectorAll(`#${EXTENSION_ID}-container, [id*="${EXTENSION_ID}"]`);
        console.log(`Removing ${extensionElements.length} extension elements`);
        extensionElements.forEach(el => el.remove());
        
        // Minimal attribute cleaning - keep most attributes for now
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            // Only remove clearly unnecessary attributes
            const attributesToRemove = [];
            
            for (let i = 0; i < el.attributes.length; i++) {
                const attr = el.attributes[i];
                // Only remove styling and event attributes
                if (attr.name.startsWith('on') || // event handlers
                    attr.name === 'style' || // inline styles
                    attr.name.startsWith('_') // internal attributes
                   ) {
                    attributesToRemove.push(attr.name);
                }
            }
            
            attributesToRemove.forEach(attrName => {
                el.removeAttribute(attrName);
            });
        });
        
        const result = element.outerHTML;
        console.log(`Cleaned element result length: ${result.length}`);
        console.log('Cleaned element preview:', result.substring(0, 200) + '...');
        
        return result;
        
    } catch (error) {
        console.error('Error cleaning element:', error);
        // Return original if cleaning fails
        return element.outerHTML;
    }
}

// Combined function to process data and autofill form
async function processAndAutofill() {
    const urlInput = document.getElementById(`${EXTENSION_ID}-url-input`);
    const dataInput = document.getElementById(`${EXTENSION_ID}-data-input`);
    const superPasteBtn = document.getElementById(`${EXTENSION_ID}-super-paste-btn`);
    
    const url = urlInput.value.trim();
    const data = dataInput.value.trim();
    
    // Check that at least one field is provided
    if (!url && !data) {
        showStatus('Please provide either a URL or data to process', 'error');
        // Clear the error message after 5 seconds
        setTimeout(() => {
            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
            if (statusDiv && statusDiv.style.display !== 'none') {
                statusDiv.style.display = 'none';
            }
        }, 5000);
        return;
    }

    // If URL is provided, validate it
    if (url && !isValidUrl(url)) {
        showStatus('Please enter a valid URL format', 'error');
        // Clear the error message after 5 seconds
        setTimeout(() => {
            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
            if (statusDiv && statusDiv.style.display !== 'none') {
                statusDiv.style.display = 'none';
            }
        }, 5000);
        return;
    }

    try {
        // Clear previous processed data first to avoid context issues
        processedData = null;
        safeStorageSet({ processedData: null });
        
        superPasteBtn.disabled = true;
        showStatus('Processing data and preparing to autofill...', 'loading');

        // Build webhook URL with provided parameters
        let webhookUrl = N8N_WEBHOOK_URL;
        
        // Prepare request body for POST
        const requestBody = {};
        
        if (url) {
            // Normalize the URL (add https:// if needed)
            const normalizedUrl = normalizeUrl(url);
            requestBody.url = normalizedUrl;
        }
        
        if (data) {
            requestBody.data = data;
        }
        
        // Add the cleaned form content from the current page
        requestBody.pageSource = getCleanFormContent();
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
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
            safeStorageSet({ processedData: result });
            
            // Automatically start autofill
            showStatus('Data received! Starting autofill...', 'loading');
            
            setTimeout(() => {
                try {
                    const filledCount = autofillFormAdvanced(processedData);
                    
                    if (filledCount > 0) {
                        showStatus(`Super Paste completed! Filled ${filledCount} fields successfully.`, 'success');
                        
                        // Clear the success message after 5 seconds
                        setTimeout(() => {
                            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                            if (statusDiv && statusDiv.style.display !== 'none') {
                                statusDiv.style.display = 'none';
                            }
                        }, 5000);
                        
                        // Close panel after successful autofill
                        setTimeout(() => {
                            const slidingPanel = document.getElementById(`${EXTENSION_ID}-sliding-panel`);
                            closeSlidePanel(slidingPanel);
                        }, 3000);
                    } else {
                        showStatus('No fields were filled. Check if the page has compatible forms.', 'error');
                        
                        // Clear the error message after 5 seconds
                        setTimeout(() => {
                            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                            if (statusDiv && statusDiv.style.display !== 'none') {
                                statusDiv.style.display = 'none';
                            }
                        }, 5000);
                    }
                } catch (autofillError) {
                    console.error('Error during autofill:', autofillError);
                    showStatus(`Error during autofill: ${autofillError.message}`, 'error');
                    // Clear the error message after 5 seconds
                    setTimeout(() => {
                        const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                        if (statusDiv && statusDiv.style.display !== 'none') {
                            statusDiv.style.display = 'none';
                        }
                    }, 5000);
                }
                
                superPasteBtn.disabled = false;
            }, 500);
            
        } else {
            // Start polling for results
            showStatus('Data sent successfully. Polling for results...', 'loading');
            startPollingWithAutofill();
        }

    } catch (error) {
        console.error('Error sending data to n8n:', error);
        showStatus(`Error: ${error.message}`, 'error');
        // Clear the error message after 5 seconds
        setTimeout(() => {
            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
            if (statusDiv && statusDiv.style.display !== 'none') {
                statusDiv.style.display = 'none';
            }
        }, 5000);
        superPasteBtn.disabled = false;
    }
}

async function processData() {
    const urlInput = document.getElementById(`${EXTENSION_ID}-url-input`);
    const dataInput = document.getElementById(`${EXTENSION_ID}-data-input`);
    const processBtn = document.getElementById(`${EXTENSION_ID}-process-btn`);
    const autofillBtn = document.getElementById(`${EXTENSION_ID}-autofill-btn`);
    
    const url = urlInput.value.trim();
    const data = dataInput.value.trim();
    
    // Check that at least one field is provided
    if (!url && !data) {
        showStatus('Please provide either a URL or data to process', 'error');
        // Clear the error message after 5 seconds
        setTimeout(() => {
            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
            if (statusDiv && statusDiv.style.display !== 'none') {
                statusDiv.style.display = 'none';
            }
        }, 5000);
        return;
    }

    // If URL is provided, validate it
    if (url && !isValidUrl(url)) {
        showStatus('Please enter a valid URL format', 'error');
        // Clear the error message after 5 seconds
        setTimeout(() => {
            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
            if (statusDiv && statusDiv.style.display !== 'none') {
                statusDiv.style.display = 'none';
            }
        }, 5000);
        return;
    }

    try {
        // Clear previous processed data first to avoid context issues
        processedData = null;
        safeStorageSet({ processedData: null });
        
        processBtn.disabled = true;
        autofillBtn.disabled = true;
        showStatus('Processing data...', 'loading');

        // Build webhook URL with provided parameters
        let webhookUrl = N8N_WEBHOOK_URL;
        const params = [];
        
        if (url) {
            // Normalize the URL (add https:// if needed)
            const normalizedUrl = normalizeUrl(url);
            params.push(`url=${encodeURIComponent(normalizedUrl)}`);
        }
        
        if (data) {
            params.push(`data=${encodeURIComponent(data)}`);
        }
        
        // Prepare request body for POST
        const requestBody = {};
        
        if (url) {
            // Normalize the URL (add https:// if needed)
            const normalizedUrl = normalizeUrl(url);
            requestBody.url = normalizedUrl;
        }
        
        if (data) {
            requestBody.data = data;
        }
        
        // Add the cleaned form content from the current page
        requestBody.pageSource = getCleanFormContent();
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
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
            safeStorageSet({ processedData: result });
            
            processBtn.disabled = false;
            autofillBtn.disabled = false;
            showStatus('Data received! Ready to autofill form.', 'success');
        } else {
            // Start polling for results
            showStatus('Data sent successfully. Polling for results...', 'loading');
            startPolling();
        }

    } catch (error) {
        console.error('Error sending data to n8n:', error);
        showStatus(`Error: ${error.message}`, 'error');
        // Clear the error message after 5 seconds
        setTimeout(() => {
            const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
            if (statusDiv && statusDiv.style.display !== 'none') {
                statusDiv.style.display = 'none';
            }
        }, 5000);
        processBtn.disabled = false;
    }
}

function startPollingWithAutofill() {
    if (isPolling) return;
    
    const superPasteBtn = document.getElementById(`${EXTENSION_ID}-super-paste-btn`);
    
    isPolling = true;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10-second intervals

    pollInterval = setInterval(async () => {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.log('Extension context invalidated, stopping polling');
            stopPolling();
            return;
        }
        
        attempts++;
        
        try {
            const response = await fetch(N8N_POLL_URL);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && Object.keys(data).length > 0) {
                    // We got data!
                    processedData = data;
                    safeStorageSet({ processedData: data });
                    
                    stopPolling();
                    
                    // Automatically start autofill
                    showStatus('Data received! Starting autofill...', 'loading');
                    
                    setTimeout(() => {
                        try {
                            const filledCount = autofillFormAdvanced(processedData);
                            
                            if (filledCount > 0) {
                                showStatus(`Super Paste completed! Filled ${filledCount} fields successfully.`, 'success');
                                
                                // Clear the success message after 5 seconds
                                setTimeout(() => {
                                    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                                    if (statusDiv && statusDiv.style.display !== 'none') {
                                        statusDiv.style.display = 'none';
                                    }
                                }, 5000);
                                
                                // Close panel after successful autofill
                                setTimeout(() => {
                                    const slidingPanel = document.getElementById(`${EXTENSION_ID}-sliding-panel`);
                                    closeSlidePanel(slidingPanel);
                                }, 3000);
                            } else {
                                showStatus('No fields were filled. Check if the page has compatible forms.', 'error');
                                
                                // Clear the error message after 5 seconds
                                setTimeout(() => {
                                    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                                    if (statusDiv && statusDiv.style.display !== 'none') {
                                        statusDiv.style.display = 'none';
                                    }
                                }, 5000);
                            }
                        } catch (autofillError) {
                            console.error('Error during autofill:', autofillError);
                            showStatus(`Error during autofill: ${autofillError.message}`, 'error');
                            // Clear the error message after 5 seconds
                            setTimeout(() => {
                                const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                                if (statusDiv && statusDiv.style.display !== 'none') {
                                    statusDiv.style.display = 'none';
                                }
                            }, 5000);
                        }
                        
                        superPasteBtn.disabled = false;
                    }, 500);
                    
                    return;
                }
            }
            
            if (attempts >= maxAttempts) {
                stopPolling();
                superPasteBtn.disabled = false;
                showStatus('Timeout: No data received after 5 minutes', 'error');
                // Clear the error message after 5 seconds
                setTimeout(() => {
                    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                    if (statusDiv && statusDiv.style.display !== 'none') {
                        statusDiv.style.display = 'none';
                    }
                }, 5000);
            } else {
                showStatus(`Polling for results... (${attempts}/${maxAttempts})`, 'loading');
            }
            
        } catch (error) {
            console.error('Polling error:', error);
            if (attempts >= maxAttempts) {
                stopPolling();
                superPasteBtn.disabled = false;
                showStatus('Error polling for results', 'error');
                // Clear the error message after 5 seconds
                setTimeout(() => {
                    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                    if (statusDiv && statusDiv.style.display !== 'none') {
                        statusDiv.style.display = 'none';
                    }
                }, 5000);
            }
        }
    }, 10000); // Poll every 10 seconds
}

function startPolling() {
    if (isPolling) return;
    
    const processBtn = document.getElementById(`${EXTENSION_ID}-process-btn`);
    const autofillBtn = document.getElementById(`${EXTENSION_ID}-autofill-btn`);
    
    isPolling = true;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10-second intervals

    pollInterval = setInterval(async () => {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.log('Extension context invalidated, stopping polling');
            stopPolling();
            return;
        }
        
        attempts++;
        
        try {
            const response = await fetch(N8N_POLL_URL);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && Object.keys(data).length > 0) {
                    // We got data!
                    processedData = data;
                    safeStorageSet({ processedData: data });
                    
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
                // Clear the error message after 5 seconds
                setTimeout(() => {
                    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                    if (statusDiv && statusDiv.style.display !== 'none') {
                        statusDiv.style.display = 'none';
                    }
                }, 5000);
            } else {
                showStatus(`Polling for results... (${attempts}/${maxAttempts})`, 'loading');
            }
            
        } catch (error) {
            console.error('Polling error:', error);
            if (attempts >= maxAttempts) {
                stopPolling();
                processBtn.disabled = false;
                showStatus('Error polling for results', 'error');
                // Clear the error message after 5 seconds
                setTimeout(() => {
                    const statusDiv = document.getElementById(`${EXTENSION_ID}-status`);
                    if (statusDiv && statusDiv.style.display !== 'none') {
                        statusDiv.style.display = 'none';
                    }
                }, 5000);
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
    // Remove whitespace
    string = string.trim();
    
    // Allow empty strings to fail validation
    if (!string) return false;
    
    // Try with the string as-is first
    try {
        new URL(string);
        return true;
    } catch (_) {
        // If it fails, try adding https:// prefix
        try {
            new URL('https://' + string);
            return true;
        } catch (_) {
            // Basic pattern check for domain-like strings
            const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
            return domainPattern.test(string) || string.includes('.');
        }
    }
}

function normalizeUrl(string) {
    // Remove whitespace
    string = string.trim();
    
    // If it already has a protocol, return as-is
    if (string.match(/^https?:\/\//)) {
        return string;
    }
    
    // Try to create URL with https:// prefix
    try {
        const url = new URL('https://' + string);
        return url.toString();
    } catch (_) {
        // If that fails, just add https:// anyway
        return 'https://' + string;
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
    safeSendMessage({
        action: 'storePageInfo',
        data: formData
    });
}

// Main autofill function (enhanced version)
function autofillFormAdvanced(data) {
    console.log('Advanced autofill starting with data:', data);
    
    let filledFields = 0;
    let fieldMappings = null;
    
    // Check if we have the new message.content structure
    let contentData = null;
    
    // Handle array response structure
    if (Array.isArray(data) && data.length > 0 && data[0].message && data[0].message.content) {
        console.log('Using new array[0].message.content structure for direct field mapping');
        contentData = data[0].message.content;
    } 
    // Handle direct object structure
    else if (data && data.message && data.message.content) {
        console.log('Using new message.content structure for direct field mapping');
        contentData = data.message.content;
    }
    
    if (contentData) {
        fieldMappings = contentData;
        console.log('Field mappings:', fieldMappings);
        
        // First pass: collect all radio button fields for sequential processing
        const radioFields = [];
        const nonRadioFields = [];
        
        for (const [fieldId, value] of Object.entries(fieldMappings)) {
            if (value === null || value === undefined || value === '') continue;
            
            console.log(`Analyzing field ID: ${fieldId} = ${value}`);
            
            // Find element by exact ID first
            let element = document.getElementById(fieldId);
            
            // If not found by ID, try by name
            if (!element) {
                element = document.querySelector(`input[name="${fieldId}"], textarea[name="${fieldId}"], select[name="${fieldId}"]`);
            }
            
            // Special handling for radio buttons
            if (!element) {
                // Try to find radio button group by name (common case)
                const radioGroup = document.querySelectorAll(`input[type="radio"][name="${fieldId}"]`);
                if (radioGroup.length > 0) {
                    element = radioGroup[0]; // Use first radio as representative
                    console.log(`Found radio group for ${fieldId} with ${radioGroup.length} options`);
                } else {
                    // Try to find radio buttons within a container with the field ID (Ant Design pattern)
                    const radioContainer = document.getElementById(fieldId);
                    if (radioContainer) {
                        const containerRadios = radioContainer.querySelectorAll('input[type="radio"]');
                        if (containerRadios.length > 0) {
                            element = containerRadios[0]; // Use first radio as representative
                            console.log(`Found radio container for ${fieldId} with ${containerRadios.length} options`);
                        }
                    }
                }
            }
            
            // Skip if element is part of extension panel
            if (element && element.closest(`#${EXTENSION_ID}-container`)) {
                console.log(`Skipping ${fieldId} - part of extension panel`);
                continue;
            }
            
            if (element) {
                // Check if this is a radio group container (Ant Design pattern)
                if (element.tagName.toLowerCase() === 'div' && 
                    (element.classList.contains('ant-radio-group') || element.querySelector('input[type="radio"]'))) {
                    radioFields.push({ fieldId, value, element });
                } else {
                    nonRadioFields.push({ fieldId, value, element });
                }
            } else {
                console.log(`No element found for field ID: ${fieldId}`);
            }
        }
        
        // Process non-radio fields immediately
        for (const { fieldId, value, element } of nonRadioFields) {
            console.log(`Processing non-radio field: ${fieldId}`);
            if (fillField(element, value)) {
                filledFields++;
            }
        }
        
        // Process radio fields sequentially with proper delays
        radioFields.forEach(({ fieldId, value, element }, index) => {
            setTimeout(() => {
                                 console.log(`Processing radio field ${index + 1}/${radioFields.length}: ${fieldId} = ${value}`);
                 
                 // Find radio inputs within the container and use fillRadioButtonAdvanced
                 const radioInputs = element.querySelectorAll('input[type="radio"]');
                 if (radioInputs.length > 0) {
                     console.log(`Found ${radioInputs.length} radio inputs in container for ${fieldId}`);
                     if (fillRadioButtonAdvanced(radioInputs[0], value)) {
                         console.log(`✓ Successfully filled radio group for ${fieldId}`);
                         // Note: filledFields count will be updated in the final summary
                     }
                 } else {
                     console.log(`No radio inputs found in container ${fieldId}`);
                 }
                         }, index * 300); // 300ms between each radio button selection
         });
         
         // Update filled fields count to include radio fields
         filledFields += radioFields.length;
    } else {
        console.log('Using legacy data structure with field mapping');
        
        // Fallback to old logic for backward compatibility
        const flattenedData = flattenData(data);
        console.log('Flattened data:', flattenedData);
        
        // No complex field mappings needed anymore - using direct field ID matching
        
        // First pass: collect all radio button fields for sequential processing (legacy version)
        const legacyRadioFields = [];
        const legacyNonRadioFields = [];
        
        for (const [key, value] of Object.entries(flattenedData)) {
            if (value === null || value === undefined || value === '') continue;
            
            console.log(`Analyzing legacy field: ${key} = ${value}`);
            const element = findFormElementAdvanced(key, value);
            if (element) {
                // Check if this is a radio group container (Ant Design pattern)
                if (element.tagName.toLowerCase() === 'div' && 
                    (element.classList.contains('ant-radio-group') || element.querySelector('input[type="radio"]'))) {
                    legacyRadioFields.push({ key, value, element });
                } else {
                    legacyNonRadioFields.push({ key, value, element });
                }
            } else {
                console.log(`No element found for legacy field: ${key}`);
            }
        }
        
        // Process non-radio fields immediately (legacy)
        for (const { key, value, element } of legacyNonRadioFields) {
            console.log(`Processing legacy non-radio field: ${key}`);
            console.log(`Found element for ${key}:`, element.name || element.id || element.placeholder);
            if (fillField(element, value)) {
                filledFields++;
            }
        }
        
        // Process radio fields sequentially with proper delays (legacy)
        legacyRadioFields.forEach(({ key, value, element }, index) => {
            setTimeout(() => {
                console.log(`Processing legacy radio field ${index + 1}/${legacyRadioFields.length}: ${key} = ${value}`);
                
                // Find radio inputs within the container and use fillRadioButtonAdvanced
                const radioInputs = element.querySelectorAll('input[type="radio"]');
                if (radioInputs.length > 0) {
                    console.log(`Found ${radioInputs.length} radio inputs in legacy container for ${key}`);
                    if (fillRadioButtonAdvanced(radioInputs[0], value)) {
                        console.log(`✓ Successfully filled legacy radio group for ${key}`);
                    }
                } else {
                    console.log(`No radio inputs found in legacy container ${key}`);
                }
            }, index * 300); // 300ms between each radio button selection
        });
        
        // Update filled fields count to include radio fields
        filledFields += legacyRadioFields.length;
    }
    
    // Specific handling for insurance date fields by exact ID
    // Only apply this if using new direct mapping and these fields weren't already filled
    const insuranceEffectiveField = document.getElementById('insuranceEffectiveDate');
    const insuranceExpiryField = document.getElementById('insuranceExpiryDate');
    
    // For new message.content structure, only fill these dates if they weren't explicitly provided
    const shouldFillInsuranceDates = !fieldMappings || 
                                   (!fieldMappings.hasOwnProperty('insuranceEffectiveDate') && 
                                    !fieldMappings.hasOwnProperty('insuranceExpiryDate'));
    
    if (shouldFillInsuranceDates) {
        if (insuranceEffectiveField && !insuranceEffectiveField.closest(`#${EXTENSION_ID}-container`) && !insuranceEffectiveField.value) {
            // Set effective date to tomorrow
            const effectiveDate = new Date();
            effectiveDate.setDate(effectiveDate.getDate() + 1);
            
            const year = effectiveDate.getFullYear();
            const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
            const day = String(effectiveDate.getDate()).padStart(2, '0');
            insuranceEffectiveField.value = `${month}-${day}-${year}`;
            
            // Store the value for protection
            const effectiveValue = insuranceEffectiveField.value;
            insuranceEffectiveField.dataset.intellifillValue = effectiveValue;
            
            // Trigger events with protection
            highlightField(insuranceEffectiveField);
            setTimeout(() => {
                if (insuranceEffectiveField.value !== effectiveValue) {
                    insuranceEffectiveField.value = effectiveValue;
                }
                try {
                    insuranceEffectiveField.dispatchEvent(new Event('input', { bubbles: true }));
                    setTimeout(() => {
                        insuranceEffectiveField.dispatchEvent(new Event('change', { bubbles: true }));
                    }, 100);
                } catch (e) {
                    console.log('Error triggering events for insuranceEffectiveDate:', e);
                }
            }, 50);
            
            filledFields++;
            console.log('Filled insuranceEffectiveDate with:', effectiveValue);
        }
        
        if (insuranceExpiryField && !insuranceExpiryField.closest(`#${EXTENSION_ID}-container`) && !insuranceExpiryField.value) {
            // Set expiry date to tomorrow + 1 year
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 1);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            
            const year = expiryDate.getFullYear();
            const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
            const day = String(expiryDate.getDate()).padStart(2, '0');
            insuranceExpiryField.value = `${month}-${day}-${year}`;
            
            // Store the value for protection
            const expiryValue = insuranceExpiryField.value;
            insuranceExpiryField.dataset.intellifillValue = expiryValue;
            
            // Trigger events with protection
            highlightField(insuranceExpiryField);
            setTimeout(() => {
                if (insuranceExpiryField.value !== expiryValue) {
                    insuranceExpiryField.value = expiryValue;
                }
                try {
                    insuranceExpiryField.dispatchEvent(new Event('input', { bubbles: true }));
                    setTimeout(() => {
                        insuranceExpiryField.dispatchEvent(new Event('change', { bubbles: true }));
                    }, 100);
                } catch (e) {
                    console.log('Error triggering events for insuranceExpiryDate:', e);
                }
            }, 50);
            
            filledFields++;
            console.log('Filled insuranceExpiryDate with:', expiryValue);
        }
    }
    
    // Additional pass: Look for other insurance date fields that might not have been mapped
    // Only do this for legacy mode or if using new mode but dates weren't provided
    if (shouldFillInsuranceDates) {
        const allDateInputs = document.querySelectorAll('input[type="date"]');
        for (const dateInput of allDateInputs) {
            // Skip if this is part of the extension panel
            if (dateInput.closest(`#${EXTENSION_ID}-container`)) continue;
            
            // Skip if this is one of the specific fields we already handled
            if (dateInput.id === 'insuranceEffectiveDate' || dateInput.id === 'insuranceExpiryDate') continue;
            
            // Skip if this field was already filled by direct mapping (new mode)
            if (fieldMappings && (dateInput.id in fieldMappings || dateInput.name in fieldMappings)) continue;
            
            const fieldName = (dateInput.name || dateInput.id || '').toLowerCase();
            const isInsuranceDate = fieldName.includes('insurance') || fieldName.includes('coverage') || fieldName.includes('policy');
            const isEffective = fieldName.includes('effective') || fieldName.includes('start') || 
                               fieldName.includes('begin') || fieldName.includes('commence');
            const isExpiry = fieldName.includes('expir') || fieldName.includes('end') || 
                            fieldName.includes('termination') || fieldName.includes('finish');
            
            if (isInsuranceDate && (isEffective || isExpiry) && !dateInput.value) {
                let targetDate;
                
                if (isEffective) {
                    // Set effective date to tomorrow
                    targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + 1);
                } else if (isExpiry) {
                    // Set expiry date to tomorrow + 1 year
                    targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + 1);
                    targetDate.setFullYear(targetDate.getFullYear() + 1);
                }
                
                if (targetDate) {
                    const year = targetDate.getFullYear();
                    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                    const day = String(targetDate.getDate()).padStart(2, '0');
                    dateInput.value = `${month}-${day}-${year}`;
                    
                    // Store the value for protection
                    const dateValue = dateInput.value;
                    dateInput.dataset.intellifillValue = dateValue;
                    
                    // Trigger events with protection
                    highlightField(dateInput);
                    setTimeout(() => {
                        if (dateInput.value !== dateValue) {
                            dateInput.value = dateValue;
                        }
                        try {
                            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                            setTimeout(() => {
                                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }, 100);
                        } catch (e) {
                            console.log('Error triggering events for date field:', e);
                        }
                    }, 50);
                    
                    filledFields++;
                }
            }
        }
    }
    
    console.log(`Advanced autofill completed. Filled ${filledFields} fields.`);
    showNotification(`✅ Autofilled ${filledFields} fields successfully!`, 'success');
    
    // Show instruction about removing highlights
    if (filledFields > 0) {
        setTimeout(() => {
            showNotification(`💡 Green highlights will disappear when you interact with the fields`, 'info');
        }, 3000);
    }
    
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

// Simplified function to find form elements by exact ID/name matching
function findFormElementAdvanced(key, value) {
    // Helper function to check if element is part of the extension panel
    function isExtensionElement(el) {
        return el.closest(`#${EXTENSION_ID}-container`) !== null;
    }
    
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
        const element = document.querySelector(selector);
        if (element && !isExtensionElement(element)) return element;
    }
    
    // 2. Try radio buttons specifically by name
    const radioSelector = `input[type="radio"][name="${key}"]`;
    const radioGroup = document.querySelectorAll(radioSelector);
    if (radioGroup.length > 0) {
        const firstRadio = Array.from(radioGroup).find(r => !isExtensionElement(r));
        if (firstRadio) {
            console.log(`Found radio group for ${key}`);
            return firstRadio;
        }
    }
    
    // 3. Try container-based radio groups (Ant Design pattern)
    const radioContainer = document.getElementById(key);
    if (radioContainer) {
        const containerRadios = radioContainer.querySelectorAll('input[type="radio"]');
        if (containerRadios.length > 0) {
            const firstContainerRadio = Array.from(containerRadios).find(r => !isExtensionElement(r));
            if (firstContainerRadio) {
                console.log(`Found container radio group for ${key}`);
                return firstContainerRadio;
            }
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
                // For radio buttons, find the actually checked radio for event triggering
                if (success) {
                    const checkedRadio = document.querySelector(`input[type="radio"][name="${element.name}"]:checked`);
                    if (checkedRadio) {
                        element = checkedRadio; // Update element reference to the checked radio
                    }
                }
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
                    // For select elements, add extra protection since they're prone to being cleared
                    if (success) {
                        console.log(`Select element filled with: ${element.value}`);
                    }
                } else {
                    element.value = value.toString();
                    success = true;
                }
                break;
        }
        
        if (success) {
            // Store the value to protect against clearing
            const filledValue = element.value;
            element.dataset.intellifillValue = filledValue;
            
            // Visual feedback first
            highlightField(element);
            
            // Trigger events with different timing for different element types
            const isSelect = element.tagName.toLowerCase() === 'select';
            const initialDelay = isSelect ? 100 : 50; // Longer delay for select elements
            const changeDelay = isSelect ? 200 : 100; // Even longer delay for change event on selects
            
            setTimeout(() => {
                // Check if value was cleared and restore if needed
                if (element.value !== filledValue || (isSelect && element.selectedIndex === -1)) {
                    console.log(`Value was cleared for ${element.tagName.toLowerCase()} ${element.name || element.id}, restoring:`, filledValue);
                    element.value = filledValue;
                    if (isSelect) {
                        // For select elements, also ensure the correct option is selected
                        const matchingOption = Array.from(element.options).find(opt => opt.value === filledValue);
                        if (matchingOption) {
                            matchingOption.selected = true;
                        }
                    }
                }
                
                // Trigger events more carefully
                try {
                    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                } catch (e) {
                    console.log('Error triggering input event:', e);
                }
                
                setTimeout(() => {
                    try {
                        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                        if (isSelect) {
                            // Additional event that some frameworks expect
                            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        }
                    } catch (e) {
                        console.log('Error triggering change event:', e);
                    }
                }, changeDelay);
                
            }, initialDelay);
            
            // Add protection against value clearing
            const protectValue = () => {
                if ((element.value === '' || element.selectedIndex === -1) && element.dataset.intellifillValue) {
                    console.log(`Protecting ${element.tagName.toLowerCase()} ${element.name || element.id} from being cleared`);
                    element.value = element.dataset.intellifillValue;
                    
                    // For select elements, also dispatch change event after restoration
                    if (element.tagName.toLowerCase() === 'select') {
                        setTimeout(() => {
                            try {
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                            } catch (e) {
                                console.log('Error triggering change event during protection:', e);
                            }
                        }, 10);
                    }
                }
            };
            
            // Monitor for value clearing - more frequently for select elements
            const isSelectElement = element.tagName.toLowerCase() === 'select';
            const monitorInterval = isSelectElement ? 100 : 200; // Check select elements more frequently
            const protectionDuration = isSelectElement ? 8000 : 5000; // Protect select elements longer
            
            const protectionInterval = setInterval(() => {
                protectValue();
            }, monitorInterval);
            
            // Add user interaction handlers to stop protection
            const stopProtection = () => {
                clearInterval(protectionInterval);
                element.removeAttribute('data-intellifill-value');
                element.removeEventListener('focus', stopProtection);
                element.removeEventListener('mousedown', stopProtection);
                element.removeEventListener('keydown', stopProtection);
                if (isSelectElement) {
                    element.removeEventListener('change', userChangeHandler);
                }
            };
            
            // For select elements, be more careful about when to stop protection
            const userChangeHandler = (e) => {
                // Only stop protection if user manually changed the value to something different
                if (e.isTrusted && element.value !== element.dataset.intellifillValue) {
                    console.log(`User manually changed select value, stopping protection`);
                    stopProtection();
                }
            };
            
            element.addEventListener('focus', stopProtection, { once: true });
            element.addEventListener('mousedown', stopProtection, { once: true }); // Use mousedown instead of click for select
            element.addEventListener('keydown', stopProtection, { once: true });
            
            if (isSelectElement) {
                element.addEventListener('change', userChangeHandler);
            }
            
            // Stop protection after specified duration
            setTimeout(stopProtection, protectionDuration);
        }
        
        return success;
    } catch (error) {
        console.error('Error filling field:', error);
        return false;
    }
}

// Enhanced helper functions for specific field types
function fillRadioButtonAdvanced(element, value) {
    let radioGroup = [];
    
    // Try to find radio group by name attribute first
    if (element.name) {
        radioGroup = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
        console.log(`Radio group for name "${element.name}":`, Array.from(radioGroup).map(r => ({ value: r.value, id: r.id })));
    }
    
    // If no name-based group found, try to find by container (Ant Design pattern)
    if (radioGroup.length === 0) {
        // Find the container that holds this radio button
        const container = element.closest('[id]') || element.closest('.ant-radio-group') || element.parentElement;
        if (container) {
            radioGroup = container.querySelectorAll('input[type="radio"]');
            console.log(`Radio group in container:`, Array.from(radioGroup).map(r => ({ value: r.value, id: r.id, text: getRadioLabel(r) })));
        }
    }
    
    if (radioGroup.length === 0) {
        console.log(`No radio group found for element`);
        return false;
    }
    
    // First, uncheck all radios in the group
    radioGroup.forEach(radio => {
        radio.checked = false;
    });
    
    const valueStr = value.toString().toLowerCase().trim();
    console.log(`Looking for radio value: "${valueStr}" (original: "${value}", type: ${typeof value})`);
    
    // Supported input values:
    // YES values: "yes", "Y", "y", true, "true", "1" 
    // NO values: "no", "N", "n", false, "false", "0"
    // Or any exact/partial match with radio button values/labels
    
    // Try different matching strategies
    for (const radio of radioGroup) {
        if (radio.closest(`#${EXTENSION_ID}-container`)) continue; // Skip extension radios
        
        const radioValue = radio.value.toLowerCase().trim();
        const radioId = (radio.id || '').toLowerCase();
        const radioLabel = getRadioLabel(radio);
        
        console.log(`Checking radio: value="${radioValue}", id="${radioId}", label="${radioLabel}"`);
        
        // Strategy 1: Exact value match (including string "true"/"false")
        if (radioValue === valueStr) {
            console.log(`✓ Strategy 1 - Exact match found: radioValue="${radioValue}" matches valueStr="${valueStr}"`);
            radio.checked = true;
            
                            // Trigger events to notify the framework  
                setTimeout(() => {
                    // Ant Design needs multiple events to properly update
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`Triggered click, change, and input events for exact match radio`);
                }, 100);
            return true;
        }
        
        // Strategy 2: Boolean/Yes-No value matching with string handling
        // Handle "Yes", "yes", "Y", "y", true, "1", "true" values
        const isYesValue = (value === true || value === 'true' || value === 'True' || value === 'YES' || value === 'Yes' ||
            valueStr === 'true' || valueStr === '1' || valueStr === 'yes' || valueStr === 'y');
        console.log(`  Strategy 2a check: isYesValue=${isYesValue} for value="${value}"`);
        
        if (isYesValue) {
            if (radioValue === 'yes' || radioValue === 'true' || radioValue === '1' || 
                radioValue === 'y' || radioId.includes('yes') || radioLabel.includes('yes') ||
                radioLabel.includes('y ') || radioLabel.startsWith('y ') || radioLabel.endsWith(' y')) {
                console.log(`✓ Strategy 2a - YES/TRUE match found: radioValue="${radioValue}" for input="${value}"`);
                radio.checked = true;
                
                // Trigger events to notify the framework
                setTimeout(() => {
                    // Ant Design needs multiple events to properly update
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`Triggered click, change, and input events for YES radio`);
                }, 100);
                return true;
            }
        }
        
        // Handle "No", "no", "N", "n", false, "0", "false" values  
        const isNoValue = (value === false || value === 'false' || value === 'False' || value === 'NO' || value === 'No' ||
            valueStr === 'false' || valueStr === '0' || valueStr === 'no' || valueStr === 'n');
        console.log(`  Strategy 2b check: isNoValue=${isNoValue} for value="${value}"`);
        
        if (isNoValue) {
            const radioMatches = (radioValue === 'no' || radioValue === 'false' || radioValue === '0' || 
                radioValue === 'n' || radioId.includes('no') || radioLabel.includes('no') ||
                radioLabel.includes('n ') || radioLabel.startsWith('n ') || radioLabel.endsWith(' n'));
            console.log(`    Radio matches NO pattern: ${radioMatches} for radioValue="${radioValue}"`);
            
            if (radioMatches) {
                console.log(`✓ Strategy 2b - NO/FALSE match found: radioValue="${radioValue}" for input="${value}"`);
                radio.checked = true;
                
                // Trigger events to notify the framework
                setTimeout(() => {
                    // Ant Design needs multiple events to properly update
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`Triggered click, change, and input events for NO radio`);
                }, 100);
                return true;
            }
        }
        
        // Strategy 3: Partial value matching
        if (radioValue.includes(valueStr) || valueStr.includes(radioValue)) {
            console.log(`✓ Partial match found for: ${radioValue}`);
            radio.checked = true;
            
            // Trigger events to notify the framework
            setTimeout(() => {
                // Ant Design needs multiple events to properly update
                radio.dispatchEvent(new Event('click', { bubbles: true }));
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));
                console.log(`Triggered click, change, and input events for partial match radio`);
            }, 100);
            return true;
        }
        
        // Strategy 4: Label text matching
        if (radioLabel && (radioLabel.includes(valueStr) || valueStr.includes(radioLabel))) {
            console.log(`✓ Label match found for: ${radioLabel}`);
            radio.checked = true;
            
            // Trigger events to notify the framework
            setTimeout(() => {
                // Ant Design needs multiple events to properly update
                radio.dispatchEvent(new Event('click', { bubbles: true }));
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));
                console.log(`Triggered click, change, and input events for label match radio`);
            }, 100);
            return true;
        }
    }
    
    console.log(`✗ No radio match found for value: "${valueStr}" (original: "${value}") in ${radioGroup.length} radio options`);
    console.log(`Available radio values:`, Array.from(radioGroup).map(r => r.value));
    return false;
}

// Helper function to get radio button label text
function getRadioLabel(radioElement) {
    // Try to find associated label
    if (radioElement.id) {
        const label = document.querySelector(`label[for="${radioElement.id}"]`);
        if (label) return label.textContent.toLowerCase().trim();
    }
    
    // Try to find parent label (common in traditional forms)
    const parentLabel = radioElement.closest('label');
    if (parentLabel) {
        // For Ant Design, get only the text that's not part of nested elements
        const parentText = parentLabel.textContent.toLowerCase().trim();
        if (parentText) return parentText;
    }
    
    // Try to find adjacent span elements (Ant Design pattern)
    const container = radioElement.closest('.ant-radio-button') || radioElement.parentElement;
    if (container) {
        const spans = container.parentElement.querySelectorAll('span');
        for (const span of spans) {
            if (!span.querySelector('input') && !span.classList.contains('ant-radio-button-inner')) {
                const spanText = span.textContent.trim();
                if (spanText && spanText.length > 0) {
                    return spanText.toLowerCase();
                }
            }
        }
    }
    
    // Try to find following text/label nodes
    let sibling = radioElement.nextSibling;
    while (sibling) {
        if (sibling.nodeType === 3) { // Text node
            const text = sibling.textContent.trim();
            if (text) return text.toLowerCase();
        } else if (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN') {
            const siblingText = sibling.textContent.toLowerCase().trim();
            if (siblingText) return siblingText;
        }
        sibling = sibling.nextSibling;
    }
    
    return '';
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
        // Check for specific insurance date field IDs first
        if (element.id === 'insuranceEffectiveDate') {
            // Set effective date to tomorrow
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 1);
            
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            element.value = `${month}-${day}-${year}`;
            return true;
        }
        
        if (element.id === 'insuranceExpiryDate') {
            // Set expiry date to tomorrow + 1 year
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 1);
            targetDate.setFullYear(targetDate.getFullYear() + 1);
            
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            element.value = `${month}-${day}-${year}`;
            return true;
        }
        
        // Check if this is an insurance effective or expiry date field
        const fieldName = (element.name || element.id || '').toLowerCase();
        const isInsuranceEffective = fieldName.includes('effective') || fieldName.includes('start') || 
                                    fieldName.includes('begin') || fieldName.includes('commence');
        const isInsuranceExpiry = fieldName.includes('expir') || fieldName.includes('end') || 
                                 fieldName.includes('termination') || fieldName.includes('finish');
        
        let targetDate;
        
        if (isInsuranceEffective) {
            // For insurance effective date, use the very next date (tomorrow)
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 1);
        } else if (isInsuranceExpiry) {
            // For insurance expiry date, use effective date + 1 year (tomorrow + 1 year)
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 1); // Start with tomorrow
            targetDate.setFullYear(targetDate.getFullYear() + 1); // Add one year
        } else {
            // For other dates, use the provided value
            targetDate = new Date(value);
        }
        
        if (!isNaN(targetDate.getTime())) {
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            
            // Check if this is an insurance-related date field
            const fieldName = (element.name || element.id || '').toLowerCase();
            const isInsuranceField = fieldName.includes('insurance') || fieldName.includes('coverage') || fieldName.includes('policy');
            
            if (isInsuranceField) {
                // Use mm-dd-yyyy format for insurance fields
                element.value = `${month}-${day}-${year}`;
            } else {
                // Use yyyy-mm-dd format for other date fields
                element.value = `${year}-${month}-${day}`;
            }
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
    
    console.log(`Filling select element with value: "${value}"`);
    console.log(`Available options:`, Array.from(options).map(opt => ({ value: opt.value, text: opt.textContent.trim() })));
    
    // Reset to no selection first
    element.selectedIndex = -1;
    
    // First try exact matches
    for (const option of options) {
        const optionValue = option.value.toLowerCase();
        const optionText = option.textContent.toLowerCase().trim();
        
        if (optionValue === valueStr || optionText === valueStr) {
            console.log(`✓ Exact match found: ${option.value} = "${option.textContent.trim()}"`);
            element.value = option.value;
            option.selected = true;
            return true;
        }
    }
    
    // Then try partial matches for business entity types
    for (const option of options) {
        const optionValue = option.value.toLowerCase();
        const optionText = option.textContent.toLowerCase().trim();
        
        // Special handling for legal entity types
        if (valueStr === 'association') {
            if (optionValue.includes('association') || optionText.includes('association') ||
                optionValue.includes('assoc') || optionText.includes('assoc')) {
                console.log(`✓ Association match found: ${option.value} = "${option.textContent.trim()}"`);
                element.value = option.value;
                option.selected = true;
                return true;
            }
        }
        
        // General partial matching
        if (optionValue.includes(valueStr) || optionText.includes(valueStr) ||
            valueStr.includes(optionValue) || valueStr.includes(optionText)) {
            console.log(`✓ Partial match found: ${option.value} = "${option.textContent.trim()}"`);
            element.value = option.value;
            option.selected = true;
            return true;
        }
    }
    
    console.log(`✗ No match found for value: "${value}"`);
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
    // Store original styles if not already stored
    if (!element.dataset.originalBackground) {
        element.dataset.originalBackground = element.style.backgroundColor || '';
        element.dataset.originalBorder = element.style.border || '';
    }
    
    // Apply green highlight
    element.style.backgroundColor = '#e8f5e8';
    element.style.border = '2px solid #4CAF50';
    element.style.transition = 'all 0.3s ease';
    
    // Add marker to track highlighted fields
    element.dataset.intellifillHighlighted = 'true';
    
    // Remove highlight on meaningful user interaction (with delay to avoid conflicts)
    const removeHighlight = () => {
        setTimeout(() => {
            element.style.backgroundColor = element.dataset.originalBackground;
            element.style.border = element.dataset.originalBorder;
            element.removeAttribute('data-intellifill-highlighted');
            element.removeAttribute('data-original-background');
            element.removeAttribute('data-original-border');
        }, 100);
    };
    
    // Add event listeners to remove highlight on user interaction (with delays)
    element.addEventListener('keydown', removeHighlight, { once: true });
    element.addEventListener('paste', removeHighlight, { once: true });
    
    // Remove highlight after manual typing (not just focus)
    let userTyped = false;
    element.addEventListener('input', (e) => {
        if (userTyped) {
            removeHighlight();
        }
    }, { once: true });
    
    element.addEventListener('keydown', () => {
        userTyped = true;
    }, { once: true });
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
if (isExtensionContextValid()) {
    try {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // Check extension context on each message
            if (!isExtensionContextValid()) {
                console.log('Extension context invalidated, ignoring message');
                return false;
            }
            
            console.log('Content script received message:', request);
            
            try {
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
                    
                case 'clearHighlights':
                    // Clear all highlights
                    cleanupHighlights();
                    sendResponse({ success: true, message: 'Highlights cleared' });
                    break;
                        
                    default:
                        sendResponse({ success: false, error: 'Unknown action' });
                }
            } catch (error) {
                console.log('Error handling message:', error);
                sendResponse({ success: false, error: error.message });
            }
            
            return true; // Keep the message channel open for async response
        });
    } catch (error) {
        console.log('Failed to add message listener:', error);
    }
}

// Function to clean up all highlights
function cleanupHighlights() {
    const highlightedFields = document.querySelectorAll('[data-intellifill-highlighted="true"]');
    highlightedFields.forEach(element => {
        element.style.backgroundColor = element.dataset.originalBackground || '';
        element.style.border = element.dataset.originalBorder || '';
        element.removeAttribute('data-intellifill-highlighted');
        element.removeAttribute('data-original-background');
        element.removeAttribute('data-original-border');
    });
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    stopPolling();
    cleanupHighlights();
});

// Clean up highlights when navigating away (for single-page apps)
window.addEventListener('pagehide', () => {
    cleanupHighlights();
});

// Additional cleanup - check extension context periodically
setInterval(() => {
    if (!isExtensionContextValid() && isPolling) {
        console.log('Extension context lost, cleaning up polling');
        stopPolling();
    }
}, 5000); // Check every 5 seconds

console.log('N8N Form Autofiller content script loaded'); 