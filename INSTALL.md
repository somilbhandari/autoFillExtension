# Quick Installation Guide

## Before Installing

⚠️ **Important**: Generate icon files using the included tool:

1. Open `create-icons.html` in your browser
2. Download the three generated PNG files:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels) 
   - `icon128.png` (128x128 pixels)
3. Move them to the `icons/` folder

Alternatively, download icons from:
- https://icons8.com
- https://feathericons.com
- https://heroicons.com

## Installation Steps

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/` in your Chrome browser
   - Or click the three dots menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select the `autofillExtension` folder
   - Click "Select Folder"

4. **Verify Installation**
   - The extension should appear in your extensions list
   - You should see the extension icon in your Chrome toolbar
   - Click the icon to open the popup

## Setup n8n Webhook Response

✅ **Your current setup works!** The extension sends data to:
`https://somil.app.n8n.cloud/webhook/14591d83-e679-486d-a00e-1ab2e05e9894`

**Configure your n8n workflow to:**

1. **Set Webhook method to GET** in your Webhook node
2. **Receive the URL** as a query parameter: `{{ $request.query.url }}`
3. **Process the URL** (scrape, analyze, extract data, etc.)
4. **Return the processed data** directly in your "Respond to Webhook" node

**⚠️ Troubleshooting:**
- If you get "Authorization data is wrong!", check your webhook authentication settings in n8n
- Make sure the webhook is set to GET method, not POST
- Verify the webhook is active and published

**Response format should be:**
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
  "First Name": "Jessica",
  "Last Name": "Carpenter",
  "Phone Number": "+1-512-555-8923",
  "Email": "jessica.carpenter@horizonfoods.com",
  "Annual revenue": 1250000
}
```

No polling endpoint needed! 🎉

## Testing

1. Click the extension icon
2. Enter a test URL (e.g., https://google.com)
3. Click "Process URL"
4. Navigate to any form page
5. Click "Autofill Form" when data is ready

## Troubleshooting

- **Extension icon not showing**: Check if icons were added to the `icons/` folder
- **Can't load extension**: Make sure Developer mode is enabled
- **Autofill not working**: Check browser console for errors
- **No data from n8n**: Verify your polling endpoint is set up correctly 