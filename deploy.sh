#!/bin/bash

# Build the Next.js application
echo "Building the Next.js application..."
npm run build

# Deploy to Netlify
echo "Deploying to Netlify..."
netlify deploy --prod

echo "Deployment complete! Your app should be available at https://www.shah3d.com/lazy-lifts" 