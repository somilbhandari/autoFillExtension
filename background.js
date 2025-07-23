// Background service worker for N8N Form Autofiller extension

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('N8N Form Autofiller extension installed/updated:', details.reason);
    
    // Clear any existing data on fresh install
    if (details.reason === 'install') {
        chrome.storage.local.clear();
        console.log('Extension storage cleared on fresh install');
    }
    
    // Clean up old data on startup (older than 7 days)
    cleanupOldData();
});

// Simple cleanup function (no alarms needed)
function cleanupOldData() {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        for (const key in items) {
            if (items[key] && items[key].timestamp) {
                if (now - items[key].timestamp > oneWeek) {
                    chrome.storage.local.remove(key);
                    console.log('Removed old data:', key);
                }
            }
        }
    });
}

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    
    switch (request.action) {
        case 'storeData':
            // Store processed data from n8n
            chrome.storage.local.set({ processedData: request.data }, () => {
                console.log('Data stored in background:', request.data);
                sendResponse({ success: true });
            });
            return true; // Keep the message channel open for async response
            
        case 'getData':
            // Retrieve stored data
            chrome.storage.local.get(['processedData'], (result) => {
                sendResponse({ data: result.processedData || null });
            });
            return true;
            
        case 'clearData':
            // Clear stored data
            chrome.storage.local.remove(['processedData'], () => {
                console.log('Processed data cleared');
                sendResponse({ success: true });
            });
            return true;
            
        case 'logError':
            // Log errors from content scripts
            console.error('Error from content script:', request.error);
            break;
            
        default:
            console.log('Unknown action:', request.action);
    }
});

// Handle tab updates to potentially refresh data
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only act when the page has fully loaded
    if (changeInfo.status === 'complete' && tab.url) {
        // You could add logic here to detect specific pages and trigger actions
        console.log('Tab updated:', tab.url);
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This won't be called if we have a popup, but keeping it for potential future use
    console.log('Extension icon clicked on tab:', tab.url);
});

// Note: Alarm functionality removed to avoid permission issues
// Data cleanup will happen on extension startup if needed

// Utility function to validate URLs
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isValidUrl
    };
} 