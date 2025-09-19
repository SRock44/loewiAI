# Google OAuth Setup Guide

## Step 1: Google Cloud Console Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing one

2. **Enable APIs**
   - Go to "APIs & Services" → "Library"
   - Enable "Google Identity" API
   - Enable "Google+ API" (if available)

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:3001`
     - `http://localhost:3002`
     - Your production domain
   - Copy your Client ID

## Step 2: Install Dependencies

```bash
npm install @google-cloud/oauth2 react-google-login
```

## Step 3: Environment Variables

Create a `.env` file in your project root:

```env
VITE_GOOGLE_CLIENT_ID=your_actual_client_id_here
```

## Step 4: Update HTML

Add Google Identity Services script to your `index.html`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

## Step 5: Replace Auth Service

Replace the mock auth service with real Google OAuth implementation.

## Step 6: Update Components

Update the Header component to use the real Google OAuth flow.

## Security Notes

- Never expose your Client Secret in frontend code
- Use HTTPS in production
- Validate tokens on your backend
- Implement proper error handling
