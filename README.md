# Lazy Lifts

A workout tracking application that allows users to track their lifting progress.

## Features

- Track workout progress across multiple cycles
- Anonymous workout tracking with local storage
- User authentication with Google
- Ability to undo recent workout completions
- Mobile-friendly UI

## Deployment to Netlify as a Subdirectory

This application is configured to be deployed to a subdirectory of a domain (e.g., www.shah3d.com/lazy-lifts) using Netlify.

### Prerequisites

1. A Netlify account
2. The Netlify CLI installed: `npm install -g netlify-cli`
3. A domain already set up on Netlify (e.g., www.shah3d.com)

### Deployment Steps

1. **Login to Netlify CLI**:
   ```
   netlify login
   ```

2. **Initialize Netlify in your project** (if not already done):
   ```
   netlify init
   ```

3. **Deploy to Netlify**:
   ```
   npm run deploy
   ```
   
   Or manually:
   ```
   netlify deploy --prod
   ```

4. **Configure Netlify Site Settings**:
   - Go to your Netlify site dashboard
   - Navigate to Site settings > Domain management
   - Add your custom domain if not already added
   - Set up the subdirectory path in the "Deploy to a subdirectory" section

### Important Configuration Files

- **next.config.mjs**: Contains the `basePath` and `assetPrefix` settings for subdirectory deployment
- **netlify.toml**: Contains build settings and redirect rules for Netlify

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open [http://localhost:3000/lazy-lifts](http://localhost:3000/lazy-lifts) in your browser

## Environment Variables

Create a `.env.local` file with the following Firebase configuration:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## License

MIT