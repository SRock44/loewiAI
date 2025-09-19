# Switch to Real Google OAuth

## Quick Setup Steps

1. **Get Google Client ID**
   - Go to https://console.cloud.google.com/
   - Create OAuth 2.0 credentials
   - Copy your Client ID

2. **Create .env file**
   ```bash
   echo "VITE_GOOGLE_CLIENT_ID=your_client_id_here" > .env
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Switch to real auth service**
   
   In `src/services/authService.ts`, change the last line from:
   ```typescript
   export const authService = new MockAuthService();
   ```
   
   To:
   ```typescript
   export const authService = new RealGoogleAuthService();
   ```

5. **Restart dev server**
   ```bash
   npm run dev
   ```

## What's Already Done

✅ Google Identity Services script added to index.html
✅ Real OAuth service implementation created
✅ Environment variable support added
✅ TypeScript types defined
✅ Error handling implemented

## Testing

1. Click "Sign In" button
2. Google OAuth popup should appear
3. Sign in with your Google account
4. User profile should appear in header

## Troubleshooting

- Make sure your Client ID is correct
- Check that your domain is authorized in Google Cloud Console
- Verify the .env file is in the project root
- Check browser console for errors
