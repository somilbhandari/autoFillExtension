# N8N Form Autofiller Chrome Extension

A Chrome extension that integrates with n8n workflows to automatically fill web forms with processed data.

## Features

- 🚀 Send URLs to your n8n workflow via webhook
- 🔄 Poll n8n for processed results
- 📝 Intelligent form detection and autofilling
- 🎯 Smart field mapping with multiple strategies
- 🎨 Beautiful, modern UI with visual feedback
- 📱 Works on any website with forms
- 🗂️ **Handles nested JSON data** (flattens complex objects)
- ✅ **Enhanced data type support** (booleans, dates, numbers)
- 🔍 **Advanced field matching** (handles spaces and special characters)
- 📞 **Smart formatting** (phone numbers, dates, URLs)

## How It Works

### Direct Response Mode (Current)
1. **Input URL**: Enter any URL in the extension popup
2. **Process**: URL is sent to your n8n webhook for processing
3. **Receive**: n8n processes and returns data immediately
4. **Autofill**: Use the returned data to autofill any form on any website

### Polling Mode (Optional)
1. **Input URL**: Enter any URL in the extension popup
2. **Process**: URL is sent to your n8n webhook for processing
3. **Poll**: Extension polls n8n every 10 seconds for results
4. **Autofill**: Once data is received, autofill any form on any website

## Setup Instructions

### 1. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension folder
4. The extension icon should appear in your toolbar

### 2. Configure n8n Workflow

You need to set up two endpoints in your n8n workflow:

#### Option 1: Direct Webhook Response (Current Setup)
- URL: `https://somil.app.n8n.cloud/webhook/14591d83-e679-486d-a00e-1ab2e05e9894`
- Method: GET
- Receives: URL as query parameter `?url=https://example.com`
- **Directly returns**: JSON object with form field data

#### Option 2: Polling Endpoint (Optional - for complex processing)
- URL: `https://somil.app.n8n.cloud/webhook/get-data` 
- Method: GET
- Returns: JSON object with form field data
- Use this if your processing takes longer than 30 seconds

**Example n8n polling endpoint response:**
```json
{
  "Name of Business": "Blue Horizon Ventures LLC",
  "DBA Name": "Horizon Foods",
  "Website URL": "https://www.horizonfoods.com",
  "Primary Address": {
    "Street": "742 Elmwood Drive",
    "City": "Austin",
    "State": "TX",
    "ZIP": "73301"
  },
  "Mailing address is same as Primary address?": true,
  "First Name": "Jessica",
  "Last Name": "Carpenter",
  "Phone Number": "+1-512-555-8923",
  "Email": "jessica.carpenter@horizonfoods.com",
  "Business entity type": "LLC",
  "Is the Business non-profit?": false,
  "Year the Business was started": 2016,
  "Description of Business operations": "We specialize in manufacturing and distributing organic packaged food products to grocery stores and online retailers.",
  "Years of management experience in industry": 9,
  "Annual revenue": 1250000,
  "Total Number of Full-Time Employees": 18,
  "Total Number of Part-Time Employees": 5,
  "Total Payroll": 735000,
  "Policy Effective Date": "2025-08-01",
  "Policy Expiration Date": "2026-08-01"
}
```

### 3. Update Configuration (Optional)

If you need to change the webhook URLs, edit the `popup.js` file:

```javascript
const N8N_WEBHOOK_URL = 'your-webhook-url-here';
const N8N_POLL_URL = 'your-polling-url-here';
```

## Usage

1. **Click the extension icon** in your Chrome toolbar
2. **Enter a URL** you want to process
3. **Click "Process URL"** - this sends the URL to n8n
4. **Wait for processing** - the extension will poll for results
5. **Navigate to any form** on any website
6. **Click "Autofill Form"** to automatically fill the form

## Field Mapping

The extension uses intelligent field mapping to match n8n data with form fields:

### Exact Matches
- Looks for form fields with exact name/id matches

### Smart Mapping
- `Name of Business` → businessname, business_name, company_name, name
- `DBA Name` → dba, dba_name, doing_business_as, trade_name
- `First Name` → firstname, first_name, fname, given_name
- `Last Name` → lastname, last_name, lname, surname
- `Email` → email, emailaddress, email_address, user_email
- `Phone Number` → phone, telephone, phonenumber, contact_phone
- `Street` → address, street, address1, street_address
- `City` → city, town, locality
- `State` → state, province, region
- `ZIP` → zip, zipcode, postal, postalcode
- `Website URL` → website, url, website_url, site
- `Business entity type` → entity_type, business_type, entity
- `Annual revenue` → revenue, annual_revenue, income
- `Policy Effective Date` → effective_date, start_date, policy_start

### Fuzzy Matching
- Searches field names, IDs, placeholders, and labels
- Case-insensitive partial matching

## Supported Form Elements

- ✅ Text inputs
- ✅ Email inputs  
- ✅ Phone inputs
- ✅ URL inputs
- ✅ Number inputs
- ✅ Textareas
- ✅ Select dropdowns
- ✅ Radio buttons (with smart boolean mapping)
- ✅ Checkboxes (with smart boolean mapping)
- ✅ Date inputs (with automatic date formatting)

## Advanced Data Processing

### Nested Object Handling
The extension automatically flattens nested JSON objects:
```json
{
  "Primary Address": {
    "Street": "123 Main St",
    "City": "Austin"
  }
}
```
Becomes accessible as both `Primary Address.Street` and `Street` for form matching.

### Boolean Value Processing
- `true`/`false` values automatically map to Yes/No radio buttons
- `"Is the Business non-profit?": false` → selects "No" radio button
- Checkbox states are set based on boolean values

### Date Formatting
- Date strings are automatically converted to YYYY-MM-DD format
- `"2025-08-01"` → properly formatted for HTML date inputs

### Smart Type Conversion
- Numbers are converted to strings for text inputs
- Phone numbers are formatted: `+1-512-555-8923` → `(512) 555-8923`
- URLs are validated before filling

## Visual Features

- 🎨 Modern gradient UI design
- 🤖 Robot indicator on every page
- ✨ Field highlighting when filled
- 📱 Toast notifications
- 🔄 Loading animations
- 📊 Progress tracking

## Technical Details

### File Structure
```
autofillExtension/
├── manifest.json       # Extension configuration
├── popup.html          # Extension popup interface
├── popup.js           # Popup functionality
├── background.js      # Service worker
├── content.js         # Page interaction script
├── README.md          # This file
└── icons/             # Extension icons (add your own)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Permissions
- `activeTab` - Access current tab for autofilling
- `storage` - Store URLs and processed data
- `scripting` - Inject content scripts

## Troubleshooting

### Extension Not Working
1. Check Chrome Developer Tools console for errors
2. Verify n8n webhook URLs are accessible
3. Ensure extension has necessary permissions

### Forms Not Autofilling
1. Check if form fields have recognizable names/IDs
2. Verify JSON data format from n8n
3. Look for JavaScript errors in console

### n8n Connection Issues
1. Verify webhook URLs are correct
2. Check CORS settings in n8n
3. Test endpoints manually with curl/Postman

## Development

### Local Development
1. Make changes to files
2. Go to `chrome://extensions/`
3. Click refresh button on the extension
4. Test your changes

### Adding New Field Mappings
Edit the `fieldMappings` object in `content.js`:

```javascript
const fieldMappings = {
    'yourField': ['field1', 'field2', 'field3'],
    // Add more mappings here
};
```

## Security Notes

- Extension only accesses current tab when autofilling
- Data is stored locally in Chrome storage
- All communication is over HTTPS
- No sensitive data is logged

## Testing

### Manual Testing
For testing without n8n setup:
1. Use browser console on any form page
2. Copy the test data from `test-data.json`
3. Run: `autofillFormOnPage(testData)` where `testData` is the JSON object

### Testing with Forms
Test the extension on forms like:
- Contact forms
- Registration forms  
- Insurance applications
- Business forms

The extension will automatically detect and fill matching fields.

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify your n8n workflow is returning correct data format
3. Test the webhook endpoints manually
4. Use the test data file for debugging

## License

This extension is provided as-is for educational and business use. 