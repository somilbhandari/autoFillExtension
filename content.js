// Content script for N8N Form Autofiller extension
// This script runs on all web pages and handles form detection and autofilling

// Configuration
const EXTENSION_ID = 'n8n-form-autofiller';
// const N8N_WEBHOOK_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';
// const N8N_POLL_URL = 'https://somil.app.n8n.cloud/webhook-test/14591d83-e679-486d-a00e-1ab2e05e9894';

// const N8N_WEBHOOK_URL = 'https://somil.app.n8n.cloud/webhook-test/bf6cecd5-7efe-48a6-98d9-777f1976cfeb';
// const N8N_POLL_URL = 'https://somil.app.n8n.cloud/webhook-test/bf6cecd5-7efe-48a6-98d9-777f1976cfeb';

const N8N_WEBHOOK_URL = 'https://cf-omega.app.n8n.cloud/webhook/954484f2-69e7-40e0-b666-361b97415359';
const N8N_POLL_URL = 'https://cf-omega.app.n8n.cloud/webhook/954484f2-69e7-40e0-b666-361b97415359';


// const N8N_WEBHOOK_URL = 'https://cf-omega.app.n8n.cloud/webhook-test/8d59f19b-8c40-4359-ba67-3551a75384b3';
// const N8N_POLL_URL = 'https://cf-omega.app.n8n.cloud/webhook-test/8d59f19b-8c40-4359-ba67-3551a75384b3';


let isInitialized = false;
let isPolling = false;
let pollInterval = null;
let processedData = null;
let isSlideOpen = false;

// Global handler management to fix TypeError issues
const handlerMap = new Map();
const observerMap = new Map();
let handlerIdCounter = 0;
let observerIdCounter = 0;

function generateHandlerId() {
    return `handler_${++handlerIdCounter}_${Date.now()}`;
}

function storeHandler(element, handler, type = 'click') {
    const handlerId = generateHandlerId();
    handlerMap.set(handlerId, { element, handler, type });
    element.dataset.intellifillHandlerId = handlerId;
    return handlerId;
}

function getHandler(handlerId) {
    return handlerMap.get(handlerId);
}

function removeHandler(handlerId) {
    const handlerData = handlerMap.get(handlerId);
    if (handlerData) {
        const { element, handler, type } = handlerData;
        element.removeEventListener(type, handler);
        element.removeAttribute('data-intellifill-handler-id');
        handlerMap.delete(handlerId);
    }
}

function cleanupAllHandlers() {
    for (const [handlerId, handlerData] of handlerMap.entries()) {
        const { element, handler, type } = handlerData;
        element.removeEventListener(type, handler);
        element.removeAttribute('data-intellifill-handler-id');
    }
    handlerMap.clear();
    
    // Clean up all observers
    for (const [observerId, observer] of observerMap.entries()) {
        if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect();
        }
    }
    observerMap.clear();
}

// Debug function to check observer and handler status
function debugProtectionStatus() {
    console.log('🔍 Protection Status Debug:');
    console.log(`  Handler Map entries: ${handlerMap.size}`);
    console.log(`  Observer Map entries: ${observerMap.size}`);
    
    for (const [handlerId, handlerData] of handlerMap.entries()) {
        console.log(`  Handler ${handlerId}:`, handlerData);
    }
    
    for (const [observerId, observer] of observerMap.entries()) {
        console.log(`  Observer ${observerId}:`, typeof observer.disconnect);
    }
}

// Enhanced test function for the new protection system
// Test functions removed - only fill values from AI responses

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
    
    // Set up global cleanup on page unload
    window.addEventListener('beforeunload', () => {
        console.log('🧹 Cleaning up all handlers and observers...');
        cleanupAllHandlers();
    });
    
    // No test functions exposed - only fill values from AI responses
    // No test functions exposed - only fill values from AI responses
    window.debugProtectionStatus = debugProtectionStatus;
    
    // Add floating button and sliding panel
    addFloatingInterface();
    
    // Listen for form detection requests
    detectForms();
    
    // Load saved data
    loadSavedData();
    
    // No auto-testing - only fill values from AI responses
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
                                 <button id="${EXTENSION_ID}-super-paste-btn" style="flex: 1; padding: 12px; border: 1px solid #624de3; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-size: 14px; background: #624de3; color: white;">Super Fill</button>
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
    
    // Panel now only closes via X button - removed auto-close on outside click
    // This ensures the panel stays open when user clicks on webpage elements
    
    // Super Fill button click - combines both process and autofill
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

// Function to trigger dropdown option loading by simulating clicks
async function waitForDropdownsToLoad() {
    console.log('🔄 Triggering dropdown option loading...');
    
    // Temporarily add CSS to prevent visual dropdown opening/closing
    const invisibleStyle = document.createElement('style');
    invisibleStyle.id = 'intellifill-invisible-dropdowns';
    invisibleStyle.textContent = `
        .ant-select-dropdown,
        .rc-select-dropdown,
        .ant-dropdown,
        select[data-intellifill-loading] {
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
        }
    `;
    document.head.appendChild(invisibleStyle);
    
    // Find all dropdowns that might need option loading
    const dropdowns = document.querySelectorAll('select:not([id*="intellifill"]), .ant-select:not([id*="intellifill"])');
    console.log(`Found ${dropdowns.length} potential dropdowns to trigger`);
    
    for (let i = 0; i < dropdowns.length; i++) {
        const dropdown = dropdowns[i];
        
        // Skip extension dropdowns
        if (dropdown.closest(`#${EXTENSION_ID}-container`)) continue;
        
        const dropdownName = dropdown.name || dropdown.id || dropdown.className || `dropdown-${i}`;
        console.log(`🖱️ Triggering dropdown ${i + 1}/${dropdowns.length}: ${dropdownName}`);
        
        // Mark dropdown as being loaded (for CSS hiding)
        dropdown.setAttribute('data-intellifill-loading', 'true');
        
        try {
            // Check initial option count
            const initialOptions = dropdown.tagName === 'SELECT' ? dropdown.options.length : 0;
            console.log(`Initial options for ${dropdownName}: ${initialOptions}`);
            
            // Simulate user interaction to trigger option loading
            if (dropdown.tagName === 'SELECT') {
                // For native select elements
                await simulateSelectInteraction(dropdown);
            } else if (dropdown.classList.contains('ant-select')) {
                // For Ant Design select components
                await simulateAntSelectInteraction(dropdown);
            }
            
            // Wait a bit for options to load
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check if options were loaded
            const finalOptions = dropdown.tagName === 'SELECT' ? dropdown.options.length : 
                                dropdown.querySelectorAll('.ant-select-item-option, .rc-select-item-option').length;
            
            if (finalOptions > initialOptions) {
                console.log(`✅ ${dropdownName}: Options loaded (${initialOptions} → ${finalOptions})`);
            } else {
                console.log(`ℹ️ ${dropdownName}: No change in options (${finalOptions})`);
            }
            
        } catch (error) {
            console.log(`⚠️ Error triggering ${dropdownName}:`, error.message);
        } finally {
            // Clean up the loading marker
            dropdown.removeAttribute('data-intellifill-loading');
        }
    }
    
    // Remove the invisible style after processing
    const styleElement = document.getElementById('intellifill-invisible-dropdowns');
    if (styleElement) {
        styleElement.remove();
    }
    
    console.log('✅ Finished triggering all dropdowns');
}

// Simulate interaction with native select elements
async function simulateSelectInteraction(selectElement) {
    // Use more subtle event sequence to minimize visual impact
    selectElement.dispatchEvent(new Event('focus', { bubbles: true }));
    selectElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    
    // Minimal wait
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Quick cleanup - use blur instead of more events
    selectElement.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Simulate interaction with Ant Design select components  
async function simulateAntSelectInteraction(antSelectElement) {
    // Find the selector element (usually the clickable part)
    const selector = antSelectElement.querySelector('.ant-select-selector') || antSelectElement;
    
    // More subtle event sequence to trigger option loading without visible opening
    selector.dispatchEvent(new Event('focus', { bubbles: true }));
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    
    // Very brief wait for API call to be triggered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Quick cleanup with minimal events
    selector.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Send escape to ensure any invisible dropdown closes
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// Function to extract clean form content from the page
async function getCleanFormContent() {
    try {
        console.log('Starting form content extraction...');
        
        // Wait for any pending dropdowns to load their options
        await waitForDropdownsToLoad();
        
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
        
        // Add a summary of form elements at the end for better AI context
        const formSummary = generateFormElementSummary();
        
        const result = cleanContent.join('\n\n') + '\n\n' + formSummary;
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
        
        // Enhance dropdown/select elements with option information
        const selectElements = element.querySelectorAll('select');
        selectElements.forEach(select => {
            // Add a data attribute with all available options for better AI context
            const options = Array.from(select.options).map(option => ({
                value: option.value,
                text: option.textContent.trim(),
                selected: option.selected
            }));
            
            if (options.length > 0) {
                // Add comment with available options
                const optionsComment = document.createComment(
                    `SELECT OPTIONS for ${select.name || select.id}: ${JSON.stringify(options)}`
                );
                select.parentNode.insertBefore(optionsComment, select);
                
                // Also add data attribute for easier parsing
                select.setAttribute('data-available-options', JSON.stringify(options));
                
                console.log(`Enhanced select element ${select.name || select.id} with ${options.length} options`);
            }
        });
        
        // Enhance radio button groups with option information
        const radioGroups = {};
        const radios = element.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            const groupName = radio.name || radio.closest('.ant-radio-group')?.id || 'unnamed';
            if (!radioGroups[groupName]) {
                radioGroups[groupName] = [];
            }
            
            // Get label text for this radio
            const label = getRadioLabel(radio);
            radioGroups[groupName].push({
                value: radio.value,
                label: label,
                checked: radio.checked,
                id: radio.id
            });
        });
        
        // Add comments for radio groups
        Object.entries(radioGroups).forEach(([groupName, options]) => {
            if (options.length > 1) { // Only for actual groups
                const firstRadio = element.querySelector(`input[type="radio"][name="${groupName}"]`) ||
                                 element.querySelector(`#${groupName} input[type="radio"]`);
                if (firstRadio) {
                    const optionsComment = document.createComment(
                        `RADIO OPTIONS for ${groupName}: ${JSON.stringify(options)}`
                    );
                    firstRadio.parentNode.insertBefore(optionsComment, firstRadio);
                    console.log(`Enhanced radio group ${groupName} with ${options.length} options`);
                }
            }
        });
        
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

// Generate a summary of all form elements for better AI understanding
function generateFormElementSummary() {
    const summary = ['<!-- FORM ELEMENTS SUMMARY FOR AI CONTEXT -->'];
    
    // Get all form elements
    const inputs = document.querySelectorAll('input:not([id*="intellifill"]), textarea:not([id*="intellifill"]), select:not([id*="intellifill"])');
    
    const elementsByType = {
        text: [],
        email: [],
        tel: [],
        number: [],
        date: [],
        textarea: [],
        select: [],
        radio: [],
        checkbox: []
    };
    
    inputs.forEach(element => {
        // Skip extension elements
        if (element.closest(`#${EXTENSION_ID}-container`)) return;
        
        const type = element.type || element.tagName.toLowerCase();
        const id = element.id;
        const name = element.name;
        const value = element.value;
        const placeholder = element.placeholder;
        
        const elementInfo = {
            id,
            name,
            value,
            placeholder,
            element
        };
        
        // Categorize by type
        if (type === 'text' || type === 'password') {
            elementsByType.text.push(elementInfo);
        } else if (type === 'email') {
            elementsByType.email.push(elementInfo);
        } else if (type === 'tel') {
            elementsByType.tel.push(elementInfo);
        } else if (type === 'number') {
            elementsByType.number.push(elementInfo);
        } else if (type === 'date') {
            elementsByType.date.push(elementInfo);
        } else if (type === 'textarea') {
            elementsByType.textarea.push(elementInfo);
        } else if (type === 'select-one' || type === 'select') {
            const options = Array.from(element.options).map(opt => ({
                value: opt.value,
                text: opt.textContent.trim(),
                selected: opt.selected
            }));
            elementsByType.select.push({...elementInfo, options});
        } else if (type === 'radio') {
            const label = getRadioLabel(element);
            elementsByType.radio.push({...elementInfo, label, checked: element.checked});
        } else if (type === 'checkbox') {
            elementsByType.checkbox.push({...elementInfo, checked: element.checked});
        }
    });
    
    // Generate summary for each type
    Object.entries(elementsByType).forEach(([type, elements]) => {
        if (elements.length > 0) {
            summary.push(`\n<!-- ${type.toUpperCase()} FIELDS (${elements.length}) -->`);
            elements.forEach(elem => {
                let line = `${elem.id || elem.name || 'unnamed'} (${type})`;
                if (elem.placeholder) line += ` - placeholder: "${elem.placeholder}"`;
                if (elem.value) line += ` - current: "${elem.value}"`;
                
                if (type === 'select' && elem.options) {
                    line += ` - options: ${elem.options.map(opt => `"${opt.text}" (${opt.value})`).join(', ')}`;
                } else if (type === 'radio') {
                    line += ` - label: "${elem.label}", value: "${elem.value}", checked: ${elem.checked}`;
                } else if (type === 'checkbox') {
                    line += ` - checked: ${elem.checked}`;
                }
                
                summary.push(`<!-- ${line} -->`);
            });
        }
    });
    
    // Group radio buttons by name/group
    const radioGroups = {};
    elementsByType.radio.forEach(radio => {
        const groupName = radio.name || radio.element.closest('.ant-radio-group')?.id || 'unnamed';
        if (!radioGroups[groupName]) radioGroups[groupName] = [];
        radioGroups[groupName].push(radio);
    });
    
    if (Object.keys(radioGroups).length > 0) {
        summary.push('\n<!-- RADIO BUTTON GROUPS -->');
        Object.entries(radioGroups).forEach(([groupName, radios]) => {
            if (radios.length > 1) {
                const options = radios.map(r => `"${r.label}" (${r.value}, checked: ${r.checked})`).join(', ');
                summary.push(`<!-- Group "${groupName}": ${options} -->`);
            }
        });
    }
    
    return summary.join('\n');
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
        
        // Disable button and update its appearance
        superPasteBtn.disabled = true;
        superPasteBtn.style.opacity = '0.6';
        superPasteBtn.style.cursor = 'not-allowed';
        superPasteBtn.textContent = 'Processing...';
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
        requestBody.pageSource = await getCleanFormContent();
        
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
                        showStatus(`Super Fill completed! Filled ${filledCount} fields successfully.`, 'success');
                        
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
                
                // Re-enable button and restore its appearance
                superPasteBtn.disabled = false;
                superPasteBtn.style.opacity = '1';
                superPasteBtn.style.cursor = 'pointer';
                superPasteBtn.textContent = 'Super Fill';
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
        // Re-enable button and restore its appearance
        superPasteBtn.disabled = false;
        superPasteBtn.style.opacity = '1';
        superPasteBtn.style.cursor = 'pointer';
        superPasteBtn.textContent = 'Super Fill';
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
        requestBody.pageSource = await getCleanFormContent();
        
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
    
    // Disable button and update its appearance
    superPasteBtn.disabled = true;
    superPasteBtn.style.opacity = '0.6';
    superPasteBtn.style.cursor = 'not-allowed';
    superPasteBtn.textContent = 'Polling...';
    
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
                                showStatus(`Super Fill completed! Filled ${filledCount} fields successfully.`, 'success');
                                
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
                        
                        // Re-enable button and restore its appearance
                        superPasteBtn.disabled = false;
                        superPasteBtn.style.opacity = '1';
                        superPasteBtn.style.cursor = 'pointer';
                        superPasteBtn.textContent = 'Super Fill';
                    }, 500);
                    
                    return;
                }
            }
            
            if (attempts >= maxAttempts) {
                stopPolling();
                // Re-enable button and restore its appearance
                superPasteBtn.disabled = false;
                superPasteBtn.style.opacity = '1';
                superPasteBtn.style.cursor = 'pointer';
                superPasteBtn.textContent = 'Super Fill';
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
    
    // Extract Ant Design select information
    const antSelects = document.querySelectorAll('.ant-select');
    const antSelectFields = Array.from(antSelects).map((select, index) => {
        const placeholder = select.querySelector('.ant-select-selection-placeholder');
        const selectedItem = select.querySelector('.ant-select-selection-item');
        
        return {
            name: select.id || select.getAttribute('name') || select.getAttribute('data-field') || `ant_select_${index}`,
            id: select.id || `ant_select_${index}`,
            type: 'ant_select',
            placeholder: placeholder ? placeholder.textContent.trim() : '',
            className: select.className || '',
            currentValue: selectedItem ? selectedItem.textContent.trim() : '',
            isAntDesign: true
        };
    });
    
    // Store form information for potential autofilling
    const formData = {
        url: window.location.href,
        forms: forms.length,
        fields: [
            ...Array.from(inputs).map(input => ({
                name: input.name || '',
                id: input.id || '',
                type: input.type || input.tagName.toLowerCase(),
                placeholder: input.placeholder || '',
                className: input.className || ''
            })),
            ...antSelectFields
        ]
    };
    
    // Debug: Log what fields are being sent to AI
    console.log('🔍 Fields being sent to AI:', formData.fields);
    console.log('🔍 Ant Design select fields:', antSelectFields);
    
    // Send form data to background script
    safeSendMessage({
        action: 'storePageInfo',
        data: formData
    });
    
    // Also detect Ant Design selects after a delay to ensure they're loaded
    setTimeout(() => {
        console.log('🔍 Re-detecting Ant Design selects after delay...');
        const delayedAntSelects = document.querySelectorAll('.ant-select');
        console.log(`Found ${delayedAntSelects.length} Ant Design selects after delay`);
        
        const delayedAntSelectFields = Array.from(delayedAntSelects).map((select, index) => {
            const placeholder = select.querySelector('.ant-select-selection-placeholder');
            const selectedItem = select.querySelector('.ant-select-selection-item');
            
            // Try to find a meaningful field name
            let fieldName = select.id || select.getAttribute('name') || select.getAttribute('data-field');
            
            // Check for datastorekey which seems to be the actual field identifier
            const datastorekey = select.getAttribute('datastorekey');
            if (datastorekey) {
                console.log(`🔍 Found datastorekey: ${datastorekey}`);
                // Extract the last part of the datastorekey as the field name
                const parts = datastorekey.split(',');
                if (parts.length > 0) {
                    fieldName = parts[parts.length - 1]; // Get the last part (the actual field ID)
                    console.log(`🔍 Using datastorekey field name: ${fieldName}`);
                }
            }
            
            // If no meaningful name, try to find a label
            if (!fieldName || fieldName.startsWith('ant_select_')) {
                // Look for a label element
                const label = select.closest('.ant-form-item')?.querySelector('.ant-form-item-label label');
                if (label) {
                    fieldName = label.textContent.trim().toLowerCase().replace(/\s+/g, '_');
                }
                
                // Look for aria-label
                if (!fieldName || fieldName.startsWith('ant_select_')) {
                    const ariaLabel = select.getAttribute('aria-label');
                    if (ariaLabel) {
                        fieldName = ariaLabel.toLowerCase().replace(/\s+/g, '_');
                    }
                }
                
                // Look for title attribute
                if (!fieldName || fieldName.startsWith('ant_select_')) {
                    const title = select.getAttribute('title');
                    if (title) {
                        fieldName = title.toLowerCase().replace(/\s+/g, '_');
                    }
                }
                
                // Look for surrounding text context
                if (!fieldName || fieldName.startsWith('ant_select_')) {
                    const parent = select.closest('.ant-form-item');
                    if (parent) {
                        const text = parent.textContent.trim();
                        // Extract meaningful words from the context
                        const words = text.split(/\s+/).filter(word => word.length > 3);
                        if (words.length > 0) {
                            fieldName = words.slice(0, 3).join('_').toLowerCase();
                        }
                    }
                }
                
                // Fallback to generic name
                if (!fieldName || fieldName.startsWith('ant_select_')) {
                    fieldName = `ant_select_${index}`;
                }
            }
            
            return {
                name: fieldName,
                id: select.id || fieldName,
                type: 'ant_select',
                placeholder: placeholder ? placeholder.textContent.trim() : '',
                className: select.className || '',
                currentValue: selectedItem ? selectedItem.textContent.trim() : '',
                isAntDesign: true
            };
        });
        
        console.log('🔍 Delayed Ant Design select fields:', delayedAntSelectFields);
        
        // Log detailed field information
        delayedAntSelectFields.forEach((field, index) => {
            console.log(`🔍 Ant Design Select ${index + 1}:`, {
                name: field.name,
                id: field.id,
                placeholder: field.placeholder,
                className: field.className,
                currentValue: field.currentValue
            });
        });
        
        // No auto-testing - only fill values from AI responses
        
        // Update the form data with the delayed Ant Design selects
        const updatedFormData = {
            ...formData,
            fields: [...formData.fields, ...delayedAntSelectFields]
        };
        
                     // Send updated form data to background script
             safeSendMessage({
                 action: 'storePageInfo',
                 data: updatedFormData
             });
             
             console.log('🔍 Updated form data sent with Ant Design selects:', updatedFormData);
             console.log('🔍 Total fields being sent to AI:', updatedFormData.fields.length);
             console.log('🔍 Ant Design fields being sent to AI:', delayedAntSelectFields.length);
             
                             // Log summary of fields being sent to AI
                console.log(`🔍 Sending ${updatedFormData.fields.length} fields to AI (${delayedAntSelectFields.length} Ant Design fields)`);
        
                                 // No auto-testing - only fill values from AI responses
    }, 3000);
}

// Main autofill function (enhanced version)
function autofillFormAdvanced(data) {
    // Reduced logging to avoid console spam
    if (Object.keys(data).length > 0) {
        console.log('Advanced autofill starting with data:', data);
        
        // Log all non-empty values for debugging
        const nonEmptyValues = Object.entries(data).filter(([key, value]) => value && value.trim() !== '');
        console.log(`📊 Found ${nonEmptyValues.length} non-empty values:`, nonEmptyValues.map(([key, value]) => `${key}: "${value}"`));
        
        // Log all empty values for debugging
        const emptyValues = Object.entries(data).filter(([key, value]) => !value || value.trim() === '');
        console.log(`📊 Found ${emptyValues.length} empty values:`, emptyValues.map(([key, value]) => `${key}: "${value}"`));
    }
    
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
                // Check if this is a radio input or radio group container
                const isRadioInput = element.type === 'radio';
                const isRadioContainer = element.tagName.toLowerCase() === 'div' && 
                    (element.classList.contains('ant-radio-group') || element.querySelector('input[type="radio"]'));
                
                if (isRadioInput || isRadioContainer) {
                    // For radio inputs, we need to find the container for proper sequential processing
                    let radioContainer = element;
                    if (isRadioInput) {
                        radioContainer = element.closest('.ant-radio-group') || 
                                       document.getElementById(fieldId) ||
                                       element.parentElement;
                    }
                    radioFields.push({ fieldId, value, element: radioContainer });
                    console.log(`📻 Categorized ${fieldId} as RADIO field`);
                } else {
                    nonRadioFields.push({ fieldId, value, element });
                    console.log(`📝 Categorized ${fieldId} as NON-RADIO field`);
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
                        
                        // Additional trigger for Ant Design form recognition
                        setTimeout(() => {
                            const radioArray = Array.from(radioInputs);
                            const checkedRadio = radioArray.find(r => r.checked);
                            if (checkedRadio) {
                                // Trigger additional form events that Ant Design may be listening for
                                checkedRadio.dispatchEvent(new Event('blur', { bubbles: true }));
                                checkedRadio.dispatchEvent(new Event('focus', { bubbles: true }));
                                
                                // Trigger on the parent container as well (Ant Design pattern)
                                const radioGroup = checkedRadio.closest('.ant-radio-group');
                                if (radioGroup) {
                                    radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        }, 500);
                        // Note: filledFields count will be updated in the final summary
                    }
                 } else {
                     console.log(`No radio inputs found in container ${fieldId}`);
                 }
                         }, index * 1000); // 300ms between each radio button selection
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
                // Check if this is a radio input or radio group container
                const isRadioInput = element.type === 'radio';
                const isRadioContainer = element.tagName.toLowerCase() === 'div' && 
                    (element.classList.contains('ant-radio-group') || element.querySelector('input[type="radio"]'));
                
                if (isRadioInput || isRadioContainer) {
                    // For radio inputs, we need to find the container for proper sequential processing
                    let radioContainer = element;
                    if (isRadioInput) {
                        radioContainer = element.closest('.ant-radio-group') || 
                                       document.getElementById(key) ||
                                       element.parentElement;
                    }
                    legacyRadioFields.push({ key, value, element: radioContainer });
                    // Reduced logging for radio fields
                } else {
                    legacyNonRadioFields.push({ key, value, element });
                    // Reduced logging for non-radio fields
                }
            } else {
                console.log(`No element found for legacy field: ${key}`);
            }
        }
        
        // Process non-radio fields immediately (legacy)
        for (const { key, value, element } of legacyNonRadioFields) {
            console.log(`Processing legacy non-radio field: ${key}`);
            console.log(`Found element for ${key}:`, element ? (element.name || element.id || element.placeholder || element.className) : 'undefined');
            if (element && fillField(element, value)) {
                filledFields++;
            } else {
                console.log(`❌ Failed to fill field ${key} - element is ${element ? 'invalid' : 'undefined'}`);
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
                        
                        // Additional trigger for Ant Design form recognition
                        setTimeout(() => {
                            const radioArray = Array.from(radioInputs);
                            const checkedRadio = radioArray.find(r => r.checked);
                            if (checkedRadio) {
                                // Trigger additional form events that Ant Design may be listening for
                                checkedRadio.dispatchEvent(new Event('blur', { bubbles: true }));
                                checkedRadio.dispatchEvent(new Event('focus', { bubbles: true }));
                                
                                // Trigger on the parent container as well (Ant Design pattern)
                                const radioGroup = checkedRadio.closest('.ant-radio-group');
                                if (radioGroup) {
                                    radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        }, 150);
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
    
    // If no fields were filled and we have Ant Design selects, test with sample data
    if (filledFields === 0) {
        const antSelects = document.querySelectorAll('.ant-select');
        if (antSelects.length > 0) {
            console.log(`🧪 Testing with sample data since AI returned empty values...`);
            setTimeout(() => {
                testWithSampleData();
            }, 1000);
        }
    }
    
    return filledFields;
}

// Test function to verify Ant Design select filling works
function testWithSampleData() {
    console.log(`🧪 Testing Ant Design select filling with sample data...`);
    
    const sampleData = {
        'application_BIBERK_QN-43255ad9-9ec4-45ec-a0b0-1d66c9a95a40': 'I lease a space from others',
        'application_BIBERK_QN-c4c51f44-194a-4529-a749-2c77ae21f02b': 'Yes',
        'application_BIBERK_QN-ee3bcf50-31e2-471c-9fa7-b9dadd4aa51d': 'No'
    };
    
    console.log(`🧪 Sample data:`, sampleData);
    autofillFormAdvanced(sampleData);
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
    
    // 1. Try Ant Design select components FIRST (prioritize over regular inputs)
    const antSelects = document.querySelectorAll('.ant-select');
    // Reduced logging to avoid console spam
    if (antSelects.length > 0) {
        console.log(`🔍 Searching for Ant Design selects for key "${key}". Found ${antSelects.length} total ant-select elements`);
    }
    
            // Log summary of ant-select elements found
        console.log(`  Found ${antSelects.length} ant-select elements`);

    for (const antSelect of antSelects) {
        if (!isExtensionElement(antSelect)) {
            // Check datastorekey first (most reliable)
            const datastorekey = antSelect.getAttribute('datastorekey');
            if (datastorekey) {
                const fieldId = datastorekey.split(',').pop();
                const fullFieldName = `application_BIBERK_${fieldId}`;
                
                console.log(`  Checking ant-select datastorekey: "${datastorekey}" -> fieldId: "${fieldId}" -> fullFieldName: "${fullFieldName}"`);
                
                if (fullFieldName === key || fieldId === key) {
                    console.log(`🎯 Found Ant Design select for ${key} via datastorekey`);
                    return antSelect;
                }
            }
            
            // Fallback to other checks
            const selectId = antSelect.id || antSelect.getAttribute('data-field') || antSelect.getAttribute('name');
            const selectText = antSelect.textContent.toLowerCase();
            const keyLower = key.toLowerCase();
            
            // Also check for common select field patterns
            const hasPlaceholder = antSelect.querySelector('.ant-select-selection-placeholder');
            const hasSelectionItem = antSelect.querySelector('.ant-select-selection-item');
            const placeholderText = hasPlaceholder ? hasPlaceholder.textContent.toLowerCase() : '';
            
            console.log(`  Checking ant-select: id="${selectId}", placeholder="${placeholderText}", text="${selectText.substring(0, 50)}..."`);
            
            if (selectId === key || selectText.includes(keyLower) || placeholderText.includes(keyLower)) {
                console.log(`🎯 Found Ant Design select for ${key}`);
                return antSelect;
            }
        }
    }
    
    // 2. Try exact matches for regular inputs (only if no Ant Design select found)
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
    
    // 4. Try broader search for any ant-select that might match
    if (antSelects.length > 0) {
        console.log(`⚠️ No exact match found for key "${key}", but ${antSelects.length} ant-select elements exist. Checking for partial matches...`);
        for (const antSelect of antSelects) {
            if (!isExtensionElement(antSelect)) {
                const selectText = antSelect.textContent.toLowerCase();
                const keyWords = keyLower.split(/[-_\s]/);
                
                for (const word of keyWords) {
                    if (word.length > 2 && selectText.includes(word)) {
                        console.log(`🎯 Found Ant Design select via partial match: "${word}" in "${selectText.substring(0, 50)}..."`);
                        return antSelect;
                    }
                }
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
                        const radioInputs = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
                        if (Array.isArray(radioInputs) || radioInputs.length > 0) {
                            const checkedRadio = Array.from(radioInputs).find(r => r.checked);
                            if (checkedRadio) {
                                element = checkedRadio; // Update element reference to the checked radio
                            }
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
                } else if (element.classList.contains('ant-select') || element.querySelector('.ant-select')) {
                    // Handle Ant Design select components
                    const antSelect = element.classList.contains('ant-select') ? element : element.querySelector('.ant-select');
                    if (antSelect) {
                        console.log(`🎯 Found Ant Design select element, calling fillAntDesignSelect`);
                        success = fillAntDesignSelect(antSelect, value);
                    } else {
                        console.log(`❌ Ant Design select element not found for:`, element);
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
            
            console.log(`🛡️ Starting protection for ${element.tagName.toLowerCase()} ${element.name || element.id} with value: "${filledValue}"`);
            
            // For select elements, use simple value restoration
            if (element.tagName.toLowerCase() === 'select') {
                console.log(`🛡️ Select element protection handled by simple restoration`);
            }
            
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
            
            // Simple protection for select elements
            const protectValue = () => {
                if (!element.dataset.intellifillValue) return; // No value to protect
                
                const isSelectElement = element.tagName.toLowerCase() === 'select';
                const currentValue = element.value;
                const expectedValue = element.dataset.intellifillValue;
                
                // Check if value was cleared or reset
                const isCleared = currentValue === '' || currentValue === null || 
                                 (isSelectElement && (element.selectedIndex === -1 || element.selectedIndex === 0));
                
                if (isCleared && expectedValue !== '') {
                    console.log(`🛡️ Protecting ${element.tagName.toLowerCase()} ${element.name || element.id} - restoring value: "${expectedValue}"`);
                    
                    // Restore the value
                    element.value = expectedValue;
                    
                    // For select elements, ensure the correct option is selected
                    if (isSelectElement) {
                        const options = Array.from(element.options);
                        const targetOption = options.find(opt => opt.value === expectedValue);
                        if (targetOption) {
                            targetOption.selected = true;
                            element.selectedIndex = targetOption.index;
                        }
                    }
                }
            };
            
                        // Simple monitoring for value clearing
            const isSelectElement = element.tagName.toLowerCase() === 'select';
            const monitorInterval = isSelectElement ? 100 : 200; // Check select elements frequently
            const protectionDuration = isSelectElement ? 10000 : 5000; // Protect select elements longer
            
            const protectionInterval = setInterval(() => {
                protectValue();
            }, monitorInterval);
            
            // For select elements, use simple value restoration
            if (isSelectElement) {
                console.log(`🛡️ Select element protection handled by simple restoration`);
            }
            
            // For select elements, custom wrappers handle all protection automatically
            if (isSelectElement) {
                console.log(`🛡️ Select element protection handled by custom wrapper`);
            }
            
            // Add user interaction handlers to stop protection
            let mutationObserver = null;
            
            const stopProtection = () => {
                clearInterval(protectionInterval);
                if (mutationObserver) {
                    mutationObserver.disconnect();
                }
                element.removeAttribute('data-intellifill-value');
                element.removeEventListener('focus', stopProtection);
                element.removeEventListener('mousedown', stopProtection);
                element.removeEventListener('keydown', stopProtection);
                if (isSelectElement) {
                    element.removeEventListener('change', userChangeHandler);
                    
                    // Clean up debug observers
                    const debugObserver = element.dataset.debugObserver;
                    const debugInterval = element.dataset.debugInterval;
                    if (debugObserver) {
                        debugObserver.disconnect();
                        element.removeAttribute('data-debug-observer');
                    }
                    if (debugInterval) {
                        clearInterval(debugInterval);
                        element.removeAttribute('data-debug-interval');
                    }
                    
                    // Clean up click handler
                    const clickHandler = element.dataset.intellifillClickHandler;
                    if (clickHandler) {
                        element.removeEventListener('click', clickHandler);
                        element.removeAttribute('data-intellifill-click-handler');
                    }
                    
                    // Clean up target value
                    element.removeAttribute('data-intellifill-target-value');
                }
                
                        // Clean up Ant Design select components
        if (element.classList.contains('ant-select') || element.querySelector('.ant-select')) {
            const antSelect = element.classList.contains('ant-select') ? element : element.querySelector('.ant-select');
            if (antSelect) {
                // Clean up click handler using new handler management
                const clickHandlerId = antSelect.dataset.intellifillClickHandlerId;
                if (clickHandlerId) {
                    removeHandler(clickHandlerId);
                }
                
                // Clear protection interval
                const protectionInterval = antSelect.dataset.intellifillProtectionInterval;
                if (protectionInterval) {
                    clearInterval(parseInt(protectionInterval));
                    antSelect.removeAttribute('data-intellifill-protection-interval');
                }
                
                // Disconnect MutationObserver
                const observerId = antSelect.dataset.intellifillObserverId;
                if (observerId) {
                    const observer = observerMap.get(observerId);
                    if (observer && typeof observer.disconnect === 'function') {
                        observer.disconnect();
                        observerMap.delete(observerId);
                    }
                    antSelect.removeAttribute('data-intellifill-observer-id');
                }
                
                antSelect.removeAttribute('data-intellifill-target-value');
            }
        }
            };
            
            // Simple user change handler for select elements
            const userChangeHandler = (e) => {
                const expectedValue = element.dataset.intellifillValue;
                const currentValue = element.value;
                
                // Check if this is a genuine user change
                const isUserChange = e.isTrusted && 
                                   currentValue !== expectedValue && 
                                   currentValue !== '' && 
                                   currentValue !== null &&
                                   e.target === element;
                
                if (isUserChange) {
                    console.log(`👤 User manually changed select value from "${expectedValue}" to "${currentValue}", stopping protection`);
                    stopProtection();
                }
            };
            
            // Only stop protection when user directly interacts with THIS specific element
            if (isSelectElement) {
                // For select elements, be very conservative about stopping protection
                element.addEventListener('change', userChangeHandler);
                // Only stop on direct keyboard interaction with THIS select
                element.addEventListener('keydown', (e) => {
                    if (e.target === element) {
                        console.log(`Direct keyboard interaction with select ${element.name || element.id}, stopping protection`);
                        stopProtection();
                    }
                }, { once: true });
            } else {
                // For non-select elements, stop on direct interaction
                element.addEventListener('focus', (e) => {
                    if (e.target === element) {
                        stopProtection();
                    }
                }, { once: true });
                element.addEventListener('mousedown', (e) => {
                    if (e.target === element) {
                        stopProtection();
                    }
                }, { once: true });
                element.addEventListener('keydown', (e) => {
                    if (e.target === element) {
                        stopProtection();
                    }
                }, { once: true });
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
                    // Enhanced event sequence for Ant Design compatibility
                    radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    
                    // Trigger on the radio group container as well
                    const radioGroup = radio.closest('.ant-radio-group');
                    if (radioGroup) {
                        radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    console.log(`Triggered enhanced event sequence for exact match radio`);
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
                    // Enhanced event sequence for Ant Design compatibility
                    radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    
                    // Trigger on the radio group container as well
                    const radioGroup = radio.closest('.ant-radio-group');
                    if (radioGroup) {
                        radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    console.log(`Triggered enhanced event sequence for YES radio`);
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
                    // Enhanced event sequence for Ant Design compatibility
                    radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    
                    // Trigger on the radio group container as well
                    const radioGroup = radio.closest('.ant-radio-group');
                    if (radioGroup) {
                        radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    console.log(`Triggered enhanced event sequence for NO radio`);
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
                // Enhanced event sequence for Ant Design compatibility
                radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                radio.dispatchEvent(new Event('click', { bubbles: true }));
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));
                radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                
                // Trigger on the radio group container as well
                const radioGroup = radio.closest('.ant-radio-group');
                if (radioGroup) {
                    radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                console.log(`Triggered enhanced event sequence for partial match radio`);
            }, 100);
            return true;
        }
        
        // Strategy 4: Label text matching
        if (radioLabel && (radioLabel.includes(valueStr) || valueStr.includes(radioLabel))) {
            console.log(`✓ Label match found for: ${radioLabel}`);
            radio.checked = true;
            
            // Trigger events to notify the framework
            setTimeout(() => {
                // Enhanced event sequence for Ant Design compatibility
                radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                radio.dispatchEvent(new Event('click', { bubbles: true }));
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));
                radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                
                // Trigger on the radio group container as well
                const radioGroup = radio.closest('.ant-radio-group');
                if (radioGroup) {
                    radioGroup.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                console.log(`Triggered enhanced event sequence for label match radio`);
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
    
    let matchedOption = null;
    let matchedIndex = -1;
    
    // First try exact matches
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const optionValue = option.value.toLowerCase();
        const optionText = option.textContent.toLowerCase().trim();
        
        if (optionValue === valueStr || optionText === valueStr) {
            console.log(`✓ Exact match found: ${option.value} = "${option.textContent.trim()}"`);
            matchedOption = option;
            matchedIndex = i;
            break;
        }
    }
    
    // Then try partial matches for business entity types
    if (!matchedOption) {
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const optionValue = option.value.toLowerCase();
            const optionText = option.textContent.toLowerCase().trim();
            
            // Special handling for legal entity types
            if (valueStr === 'association') {
                if (optionValue.includes('association') || optionText.includes('association') ||
                    optionValue.includes('assoc') || optionText.includes('assoc')) {
                    console.log(`✓ Association match found: ${option.value} = "${option.textContent.trim()}"`);
                    matchedOption = option;
                    matchedIndex = i;
                    break;
                }
            }
            
            // General partial matching
            if (optionValue.includes(valueStr) || optionText.includes(valueStr) ||
                valueStr.includes(optionValue) || valueStr.includes(optionText)) {
                console.log(`✓ Partial match found: ${option.value} = "${option.textContent.trim()}"`);
                matchedOption = option;
                matchedIndex = i;
                break;
            }
        }
    }
    
    if (matchedOption) {
        // Set the value on the original select
        element.value = matchedOption.value;
        element.selectedIndex = matchedIndex;
        matchedOption.selected = true;
        
        // Store the target value for restoration
        element.dataset.intellifillTargetValue = matchedOption.value;
        
        // Debug the select behavior
        debugSelectBehavior(element);
        
        // Add a simple click handler that restores the value
        const clickHandler = (e) => {
            console.log('Select clicked, restoring value...');
            restoreSelectValue(element, element.dataset.intellifillTargetValue);
        };
        
        element.addEventListener('click', clickHandler);
        element.dataset.intellifillClickHandler = clickHandler;
        
        console.log(`✅ Set up simple protection for select element with value: "${matchedOption.value}"`);
        return true;
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

// Clean up all custom select wrappers
function cleanupSelectWrappers() {
    document.querySelectorAll('[data-intellifill-wrapper="true"]').forEach(wrapper => {
        restoreOriginalSelect(wrapper);
    });
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    stopPolling();
    cleanupHighlights();
    cleanupSelectWrappers();
});

// Clean up highlights when navigating away (for single-page apps)
window.addEventListener('pagehide', () => {
    cleanupHighlights();
    cleanupSelectWrappers();
});

// Additional cleanup - check extension context periodically
setInterval(() => {
    if (!isExtensionContextValid() && isPolling) {
        console.log('Extension context lost, cleaning up polling');
        stopPolling();
    }
}, 5000); // Check every 5 seconds

console.log('N8N Form Autofiller content script loaded'); 

// Custom select wrapper to prevent value clearing
function createSelectWrapper(originalSelect) {
    // Store original properties
    const originalValue = originalSelect.value;
    const originalSelectedIndex = originalSelect.selectedIndex;
    const originalOptions = Array.from(originalSelect.options);
    
    // Create a hidden input to store the actual value
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.value = originalValue;
    hiddenInput.name = originalSelect.name;
    hiddenInput.id = originalSelect.id;
    
    // Create a custom dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.style.cssText = `
        position: relative;
        display: inline-block;
        width: 100%;
        max-width: ${originalSelect.offsetWidth}px;
    `;
    
    // Create the custom select button
    const customSelect = document.createElement('div');
    customSelect.style.cssText = `
        border: 1px solid #ccc;
        padding: 8px 12px;
        background: white;
        cursor: pointer;
        user-select: none;
        position: relative;
        min-height: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    
    // Create the dropdown arrow
    const arrow = document.createElement('span');
    arrow.innerHTML = '▼';
    arrow.style.cssText = `
        font-size: 12px;
        color: #666;
        transition: transform 0.2s;
    `;
    
    // Create the selected value display
    const selectedDisplay = document.createElement('span');
    selectedDisplay.textContent = originalSelect.options[originalSelect.selectedIndex]?.textContent || '';
    selectedDisplay.style.cssText = `
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;
    
    customSelect.appendChild(selectedDisplay);
    customSelect.appendChild(arrow);
    
    // Create the dropdown options
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ccc;
        border-top: none;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
    `;
    
    // Add options
    originalOptions.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.textContent = option.textContent;
        optionDiv.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            ${index === originalSelectedIndex ? 'background: #e3f2fd;' : ''}
        `;
        
        optionDiv.addEventListener('click', () => {
            // Update the hidden input
            hiddenInput.value = option.value;
            
            // Update the display
            selectedDisplay.textContent = option.textContent;
            
            // Update the original select (for compatibility)
            originalSelect.value = option.value;
            originalSelect.selectedIndex = index;
            
            // Trigger change events
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Close dropdown
            optionsContainer.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
            
            // Remove highlight from all options
            optionsContainer.querySelectorAll('div').forEach(opt => {
                opt.style.background = '';
            });
            
            // Highlight selected option
            optionDiv.style.background = '#e3f2fd';
        });
        
        optionDiv.addEventListener('mouseenter', () => {
            optionDiv.style.background = '#f5f5f5';
        });
        
        optionDiv.addEventListener('mouseleave', () => {
            if (index !== originalSelectedIndex) {
                optionDiv.style.background = '';
            }
        });
        
        optionsContainer.appendChild(optionDiv);
    });
    
    // Add click handler to toggle dropdown
    customSelect.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isOpen = optionsContainer.style.display === 'block';
        
        if (isOpen) {
            optionsContainer.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        } else {
            optionsContainer.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            optionsContainer.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        }
    });
    
    // Close dropdown on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            optionsContainer.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        }
    });
    
    // Assemble the wrapper
    dropdownContainer.appendChild(customSelect);
    dropdownContainer.appendChild(optionsContainer);
    
    // Replace the original select with our wrapper
    originalSelect.style.display = 'none';
    originalSelect.parentNode.insertBefore(dropdownContainer, originalSelect);
    originalSelect.parentNode.insertBefore(hiddenInput, originalSelect);
    
    // Store references for cleanup
    dropdownContainer.dataset.intellifillWrapper = 'true';
    dropdownContainer.dataset.intellifillOriginalSelect = originalSelect.id || originalSelect.name;
    
    return {
        wrapper: dropdownContainer,
        hiddenInput: hiddenInput,
        originalSelect: originalSelect
    };
}

// Function to restore original select element
function restoreOriginalSelect(wrapper) {
    if (!wrapper) return;
    
    const originalSelect = wrapper.querySelector('select') || 
                          document.getElementById(wrapper.dataset.intellifillOriginalSelect);
    
    if (originalSelect) {
        originalSelect.style.display = '';
        wrapper.remove();
    }
}

// Debug function to understand select element behavior
function debugSelectBehavior(selectElement) {
    console.log('=== SELECT DEBUG START ===');
    console.log('Original select:', selectElement);
    console.log('Original value:', selectElement.value);
    console.log('Original selectedIndex:', selectElement.selectedIndex);
    
    // Monitor all property changes
    const originalValue = selectElement.value;
    const originalSelectedIndex = selectElement.selectedIndex;
    
    // Create a simple observer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            console.log('Mutation detected:', mutation.type, mutation.attributeName);
            console.log('Current value:', selectElement.value);
            console.log('Current selectedIndex:', selectElement.selectedIndex);
        });
    });
    
    observer.observe(selectElement, {
        attributes: true,
        childList: true,
        subtree: true
    });
    
    // Monitor property changes
    let valueCheckInterval = setInterval(() => {
        if (selectElement.value !== originalValue) {
            console.log('VALUE CHANGED from', originalValue, 'to', selectElement.value);
        }
        if (selectElement.selectedIndex !== originalSelectedIndex) {
            console.log('SELECTEDINDEX CHANGED from', originalSelectedIndex, 'to', selectElement.selectedIndex);
        }
    }, 10);
    
    // Store for cleanup
    selectElement.dataset.debugObserver = observer;
    selectElement.dataset.debugInterval = valueCheckInterval;
    
    console.log('=== SELECT DEBUG SETUP COMPLETE ===');
}

// Simple function to restore select value
function restoreSelectValue(selectElement, targetValue) {
    console.log('Restoring select value to:', targetValue);
    
    // Try multiple approaches
    selectElement.value = targetValue;
    
    // Also set selectedIndex
    const options = Array.from(selectElement.options);
    const targetIndex = options.findIndex(opt => opt.value === targetValue);
    if (targetIndex !== -1) {
        selectElement.selectedIndex = targetIndex;
        options[targetIndex].selected = true;
    }
    
    // Force a change event
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log('Restored value:', selectElement.value);
    console.log('Restored selectedIndex:', selectElement.selectedIndex);
}

// Test function to check for select elements on the page
function testForSelectElements() {
    const selectElements = document.querySelectorAll('select');
    console.log(`🔍 Found ${selectElements.length} select elements on the page`);
    
    selectElements.forEach((select, index) => {
        console.log(`Select ${index + 1}:`, {
            id: select.id,
            name: select.name,
            value: select.value,
            options: Array.from(select.options).map(opt => ({
                value: opt.value,
                text: opt.textContent.trim()
            }))
        });
    });
    
    return selectElements.length > 0;
}

// Call this function when the page loads
testForSelectElements();

// Test function to check for custom dropdown implementations
function testForCustomDropdowns() {
    // Look for common custom dropdown patterns
    const customDropdowns = document.querySelectorAll([
        '.ant-select',           // Ant Design
        '.select2',             // Select2
        '.chosen',              // Chosen
        '.dropdown',            // Generic dropdown
        '[role="combobox"]',    // ARIA combobox
        '[data-toggle="dropdown"]', // Bootstrap
        '.select-wrapper',      // Custom select wrapper
        '.dropdown-menu'        // Bootstrap dropdown menu
    ].join(','));
    
    console.log(`🔍 Found ${customDropdowns.length} custom dropdown elements on the page`);
    
    customDropdowns.forEach((dropdown, index) => {
        console.log(`Custom Dropdown ${index + 1}:`, {
            className: dropdown.className,
            id: dropdown.id,
            role: dropdown.getAttribute('role'),
            'data-toggle': dropdown.getAttribute('data-toggle'),
            textContent: dropdown.textContent?.substring(0, 100) + '...'
        });
    });
    
    return customDropdowns.length > 0;
}

    // Call this function when the page loads
    testForCustomDropdowns();
    
    // Function to extract Ant Design select field data
    function extractAntDesignSelectData() {
        console.log('🔍 Extracting Ant Design select field data...');
        
        const antSelects = document.querySelectorAll('.ant-select');
        const selectData = {};
        
        antSelects.forEach((select, index) => {
            // Get the field identifier
            const fieldId = select.id || 
                           select.getAttribute('name') || 
                           select.getAttribute('data-field') ||
                           `ant_select_${index}`;
            
            // Get placeholder text
            const placeholder = select.querySelector('.ant-select-selection-placeholder');
            const placeholderText = placeholder ? placeholder.textContent.trim() : '';
            
            // Get current value
            const selectedItem = select.querySelector('.ant-select-selection-item');
            const currentValue = selectedItem ? selectedItem.textContent.trim() : '';
            
            // Get available options (if dropdown is open)
            const dropdown = document.querySelector('.ant-select-dropdown');
            let options = [];
            if (dropdown) {
                const optionElements = dropdown.querySelectorAll('.ant-select-item-option');
                options = Array.from(optionElements).map(opt => opt.textContent.trim());
            }
            
            console.log(`Ant Select ${index}:`, {
                fieldId,
                placeholder: placeholderText,
                currentValue,
                options: options.length > 0 ? options : 'No options loaded'
            });
            
            // Add to data if it has a meaningful identifier
            if (fieldId && fieldId !== `ant_select_${index}`) {
                selectData[fieldId] = {
                    type: 'ant_select',
                    placeholder: placeholderText,
                    currentValue,
                    options
                };
            }
        });
        
        console.log('Extracted Ant Design select data:', selectData);
        return selectData;
    }
    
    // Run the extraction
    setTimeout(() => {
        extractAntDesignSelectData();
    }, 3000);

// Test functions removed - only fill values from AI responses

// Function to fill Ant Design select components
function fillAntDesignSelect(antSelectElement, value) {
    console.log(`🎯 Filling Ant Design select with value: "${value}"`);
    
    // Check if value is empty or invalid
    if (!value || value.trim() === '') {
        console.log(`❌ Skipping empty value for Ant Design select`);
        return false;
    }
    
    // Store the target value for protection
    antSelectElement.dataset.intellifillTargetValue = value;
    
    // Enhanced function to properly select dropdown options
    const selectDropdownOption = async () => {
        try {
            // Step 1: Open the dropdown by clicking the select
            console.log('📋 Opening Ant Design dropdown...');
            console.log('🎯 Clicking select element:', antSelectElement);
            antSelectElement.click();
            
            // Wait for dropdown to appear
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check if dropdown opened
            const dropdownsAfterClick = document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
            console.log(`🔍 After click: Found ${dropdownsAfterClick.length} open dropdowns`);
            
            // Step 2: Find the dropdown - make sure it's the one for this specific select
            let dropdown = null;
            
            // First, try to find a dropdown that's specifically for this select
            const allDropdowns = document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
            console.log(`🔍 Found ${allDropdowns.length} open dropdowns`);
            
            // Also check for any dropdown containers
            const allDropdownContainers = document.querySelectorAll('.ant-select-dropdown');
            console.log(`🔍 Total dropdown containers: ${allDropdownContainers.length}`);
            
            // Log all dropdown containers for debugging
            allDropdownContainers.forEach((dd, index) => {
                console.log(`🔍 Dropdown ${index}:`, {
                    hidden: dd.classList.contains('ant-select-dropdown-hidden'),
                    visible: !dd.classList.contains('ant-select-dropdown-hidden'),
                    classes: dd.className,
                    children: dd.children.length
                });
            });
            
            // Look for dropdown that's positioned near this select
            for (const dd of allDropdowns) {
                const selectRect = antSelectElement.getBoundingClientRect();
                const dropdownRect = dd.getBoundingClientRect();
                
                // Check if dropdown is positioned near this select
                if (Math.abs(dropdownRect.left - selectRect.left) < 50 && 
                    dropdownRect.top > selectRect.bottom) {
                    dropdown = dd;
                    console.log('✅ Found dropdown positioned for this select');
                    break;
                }
            }
            
            // If no specific dropdown found, try to find by data attributes
            if (!dropdown) {
                const selectId = antSelectElement.id || antSelectElement.getAttribute('data-field');
                if (selectId) {
                    for (const dd of allDropdowns) {
                        const dropdownId = dd.getAttribute('data-select-id') || dd.getAttribute('aria-describedby');
                        if (dropdownId && dropdownId.includes(selectId)) {
                            dropdown = dd;
                            console.log('✅ Found dropdown by data attributes');
                            break;
                        }
                    }
                }
            }
            
            // If still no specific dropdown found, use the first one
            if (!dropdown && allDropdowns.length > 0) {
                dropdown = allDropdowns[0];
                console.log('⚠️ Using first available dropdown');
            }
            
            if (!dropdown) {
                console.log('❌ No dropdown found, falling back to text-only fill');
                return false;
            }
            
            // Log which dropdown we're using
            console.log(`🎯 Using dropdown for select:`, {
                selectId: antSelectElement.id,
                selectName: antSelectElement.getAttribute('name'),
                dropdownElement: dropdown,
                dropdownOptions: dropdown.querySelectorAll('.ant-select-item-option').length
            });
            
            // Step 3: Wait for dynamic options to load (up to 3 seconds)
            console.log('⏳ Waiting for dynamic options to load...');
            let options = [];
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds (30 * 100ms)
            
            while (attempts < maxAttempts) {
                options = dropdown.querySelectorAll('.ant-select-item-option');
                console.log(`🔍 Attempt ${attempts + 1}: Found ${options.length} options`);
                
                // If we have options and they seem stable (not loading), proceed
                if (options.length > 0) {
                    // Check if options are still loading by looking for loading indicators
                    const loadingIndicator = dropdown.querySelector('.ant-select-item-loading, .ant-spin');
                    if (!loadingIndicator) {
                        console.log(`✅ Options loaded: ${options.length} options available`);
                        break;
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (options.length === 0) {
                console.log('❌ No options loaded after waiting, falling back to text-only fill');
                return false;
            }
            
            // Step 4: Find the matching option with enhanced matching logic
            let targetOption = null;
            
            // Helper function to normalize text for comparison
            const normalizeText = (text) => {
                return text.toLowerCase()
                    .replace(/[^\w\s]/g, '') // Remove punctuation
                    .replace(/\s+/g, ' ') // Normalize whitespace
                    .trim();
            };
            
            const normalizedTarget = normalizeText(value);
            console.log(`🎯 Looking for normalized target: "${normalizedTarget}"`);
            console.log(`📋 Available options:`, Array.from(options).map(opt => opt.textContent?.trim()));
            
            for (const option of Array.from(options)) {
                const optionText = option.textContent?.trim();
                const normalizedOption = normalizeText(optionText);
                console.log(`Checking option: "${optionText}" (normalized: "${normalizedOption}")`);
                
                // Exact match (case-insensitive)
                if (normalizedOption === normalizedTarget) {
                    targetOption = option;
                    console.log(`✅ Found exact match: "${optionText}"`);
                    break;
                }
            }
            
            if (!targetOption) {
                console.log(`❌ No exact match found, trying smart matching...`);
                
                // Smart matching strategies
                for (const option of Array.from(options)) {
                    const optionText = option.textContent?.trim();
                    const normalizedOption = normalizeText(optionText);
                    
                    // Strategy 1: Contains match (either direction)
                    if (normalizedOption.includes(normalizedTarget) || normalizedTarget.includes(normalizedOption)) {
                        targetOption = option;
                        console.log(`✅ Found contains match: "${optionText}"`);
                        break;
                    }
                    
                                // Strategy 2: Word-by-word matching
            const targetWords = normalizedTarget.split(' ').filter(word => word.length > 2);
            const optionWords = normalizedOption.split(' ').filter(word => word.length > 2);
            const matchingWords = targetWords.filter(word => optionWords.includes(word));
            
            if (matchingWords.length >= Math.min(2, targetWords.length)) {
                targetOption = option;
                console.log(`✅ Found word match: "${optionText}" (matching words: ${matchingWords.join(', ')})`);
                break;
            }
            
            // Strategy 3: Partial word matching (for cases like "I lease a space" vs "lease")
            for (const targetWord of targetWords) {
                for (const optionWord of optionWords) {
                    if (targetWord.includes(optionWord) || optionWord.includes(targetWord)) {
                        targetOption = option;
                        console.log(`✅ Found partial word match: "${optionText}" (target: "${targetWord}", option: "${optionWord}")`);
                        break;
                    }
                }
                if (targetOption) break;
            }
                }
            }
            
            if (!targetOption) {
                console.log(`❌ No smart match found, trying first available option...`);
                // As a last resort, try the first option
                if (options.length > 0) {
                    targetOption = Array.from(options)[0];
                    console.log(`⚠️ Using first available option: "${targetOption.textContent?.trim()}"`);
                }
            }
            
            if (!targetOption) {
                console.log(`❌ No matching option found for "${value}"`);
                return false;
            }
            
            // Step 5: Click the option to select it
            console.log(`🖱️ Clicking option: "${targetOption.textContent?.trim()}"`);
            targetOption.click();
            
            // Wait for selection to take effect
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Step 6: Close dropdown by clicking outside or pressing Escape
            const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(escapeEvent);
            
            console.log(`✅ Successfully selected dropdown option: "${value}"`);
            return true;
            
        } catch (error) {
            console.log('❌ Error selecting dropdown option:', error);
            console.log('❌ Error stack:', error.stack);
            return false;
        }
    };
    
    // Enhanced protection function with better targeting
    const protectValue = () => {
        // Only log occasionally to reduce noise
        const shouldLog = Math.random() < 0.01; // Only log 1% of the time to reduce console noise
        if (shouldLog) {
            console.log('🛡️ Protecting Ant Design select value...');
        }
        
        // Find all possible elements that could hold the value
        const selector = antSelectElement.querySelector('.ant-select-selector') || antSelectElement;
        const hiddenInput = antSelectElement.querySelector('input[type="hidden"]') || 
                           antSelectElement.querySelector('.ant-select-selection-item') ||
                           antSelectElement.querySelector('.ant-select-selection-search-input');
        const displayElement = antSelectElement.querySelector('.ant-select-selection-item') ||
                              antSelectElement.querySelector('.ant-select-selection-placeholder');
        const searchInput = antSelectElement.querySelector('.ant-select-selection-search-input');
        
        // Set value on all possible elements
        if (hiddenInput) {
            hiddenInput.value = value;
            hiddenInput.setAttribute('value', value);
        }
        
        if (displayElement) {
            displayElement.textContent = value;
            displayElement.setAttribute('title', value);
        }
        
        if (searchInput) {
            searchInput.value = value;
            searchInput.setAttribute('value', value);
        }
        
        // Also set on the main element itself
        antSelectElement.setAttribute('data-value', value);
        antSelectElement.setAttribute('value', value);
        
        // Trigger React events with more sophisticated approach
        try {
            // Create more realistic events
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            const blurEvent = new Event('blur', { bubbles: true, cancelable: true });
            
            // Dispatch events on multiple elements for better coverage
            antSelectElement.dispatchEvent(changeEvent);
            antSelectElement.dispatchEvent(inputEvent);
            antSelectElement.dispatchEvent(blurEvent);
            
            if (hiddenInput) {
                hiddenInput.dispatchEvent(changeEvent);
                hiddenInput.dispatchEvent(inputEvent);
            }
            
            if (searchInput) {
                searchInput.dispatchEvent(changeEvent);
                searchInput.dispatchEvent(inputEvent);
            }
        } catch (e) {
            if (shouldLog) {
                console.log('Error triggering events:', e);
            }
        }
    };
    
    // Set up MutationObserver to detect when React clears values (only when dropdown is closed)
    const observer = new MutationObserver((mutations) => {
        try {
            // Only restore if dropdown is not open
            const dropdown = document.querySelector('.ant-select-dropdown');
            if (dropdown && dropdown.style.display !== 'none') {
                return; // Don't interfere when dropdown is open
            }
            
            let shouldRestore = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    // Check if the value was cleared
                    const displayElement = antSelectElement.querySelector('.ant-select-selection-item');
                    const hiddenInput = antSelectElement.querySelector('input[type="hidden"]');
                    const searchInput = antSelectElement.querySelector('.ant-select-selection-search-input');
                    
                    const currentValue = displayElement?.textContent || hiddenInput?.value || searchInput?.value;
                    
                    if (!currentValue || currentValue.trim() === '') {
                        shouldRestore = true;
                        break;
                    }
                }
            }
            
            if (shouldRestore) {
                console.log('🔄 React cleared value, restoring...');
                protectValue();
            }
        } catch (error) {
            console.log('Error in MutationObserver callback:', error);
        }
    });
    
    // Observe the entire Ant Design select for changes
    observer.observe(antSelectElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value', 'textContent', 'title']
    });
    
    // Store observer reference for cleanup
    const observerId = `observer_${++observerIdCounter}_${Date.now()}`;
    observerMap.set(observerId, observer);
    antSelectElement.dataset.intellifillObserverId = observerId;
    
    // Set up continuous protection with longer intervals to reduce noise
    const protectionInterval = setInterval(protectValue, 5000); // Increased to 5 seconds to be less aggressive
    antSelectElement.dataset.intellifillProtectionInterval = protectionInterval;
    
    // Add click protection using the new handler management (only for value restoration, not dropdown interference)
    const clickHandler = (e) => {
        // Only restore if this is a click outside of dropdown interaction
        const dropdown = document.querySelector('.ant-select-dropdown');
        if (!dropdown || dropdown.style.display === 'none') {
            console.log('Ant Design select clicked, restoring value...');
            protectValue();
        }
    };
    
    antSelectElement.addEventListener('click', clickHandler);
    const handlerId = storeHandler(antSelectElement, clickHandler, 'click');
    antSelectElement.dataset.intellifillClickHandlerId = handlerId;
    
    // Try to properly select the dropdown option first
    selectDropdownOption().then(success => {
        if (!success) {
            console.log('🔄 Dropdown selection failed, falling back to text-only fill');
            protectValue();
        }
    });
    
    console.log(`✅ Set up comprehensive protection for Ant Design select with value: "${value}"`);
    return true;
}

// Function to restore Ant Design select value
function restoreAntDesignSelectValue(antSelectElement, targetValue) {
    console.log(`🛡️ Restoring Ant Design select value to: "${targetValue}"`);
    
    // Find the hidden input
    const hiddenInput = antSelectElement.querySelector('input[type="hidden"]') || 
                       antSelectElement.querySelector('.ant-select-selection-item') ||
                       antSelectElement.querySelector('.ant-select-selection-search-input');
    
    // Find the display element
    const displayElement = antSelectElement.querySelector('.ant-select-selection-item') ||
                          antSelectElement.querySelector('.ant-select-selection-placeholder');
    
    // Restore the value
    if (hiddenInput) {
        hiddenInput.value = targetValue;
        hiddenInput.setAttribute('value', targetValue);
    }
    
    // Restore the display text
    if (displayElement) {
        displayElement.textContent = targetValue;
        displayElement.setAttribute('title', targetValue);
    }
    
    // Trigger events to notify Ant Design
    setTimeout(() => {
        try {
            antSelectElement.dispatchEvent(new Event('change', { bubbles: true }));
            antSelectElement.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {
            console.log('Error triggering events during Ant Design restoration:', e);
        }
    }, 10);
    
    console.log(`✅ Restored Ant Design select value: "${targetValue}"`);
}

// Initialize the extension
initialize();

