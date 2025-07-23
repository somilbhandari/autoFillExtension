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

        console.log('Attempting to autofill on tab:', tab.url);
        
        // Check if it's a special page where content scripts can't run
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('about:') || tab.url.startsWith('moz-extension://') ||
            tab.url.startsWith('file://')) {
            showStatus('Cannot autofill on this type of page. Try a regular website.', 'error');
            return;
        }

        let response;
        try {
            // First try to send message to existing content script
            response = await chrome.tabs.sendMessage(tab.id, {
                action: 'autofill',
                data: processedData
            });
        } catch (connectionError) {
            console.log('Content script not found, injecting manually...');
            
            try {
                // Inject content script manually if not present
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                
                // Wait a moment for the script to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try sending message again
                response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'autofill',
                    data: processedData
                });
            } catch (injectionError) {
                console.error('Failed to inject content script:', injectionError);
                showStatus('Cannot autofill on this page. Try refreshing the page.', 'error');
                return;
            }
        }

        if (response && response.success) {
            showStatus(`Form autofilled successfully! Filled ${response.filledFields} fields.`, 'success');
            
            // Optional: Close popup after successful autofill
            setTimeout(() => {
                window.close();
            }, 2000);
        } else {
            showStatus('No fields were filled. Check if the page has compatible forms.', 'error');
        }

    } catch (error) {
        console.error('Error autofilling form:', error);
        showStatus(`Error autofilling: ${error.message}`, 'error');
    }
}

// Note: Autofill functionality moved to content script for better compatibility

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