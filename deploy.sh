#!/bin/bash

echo "======================================"
echo "Heat Analyzer — Auto Deploy"
echo "======================================"

echo ""
echo "Step 1: Installing dependencies..."
npm install

echo ""
echo "Step 2: Building app..."
npm run build

if [ $? -ne 0 ]; then
  echo "BUILD FAILED. Fix errors above."
  exit 1
fi

echo ""
echo "Step 3: Build successful!"
echo "Deploying to Vercel..."

if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

vercel --prod

echo ""
echo "======================================"
echo "DEPLOYMENT COMPLETE!"
echo "Your app is live at the URL above." 
echo "======================================"
