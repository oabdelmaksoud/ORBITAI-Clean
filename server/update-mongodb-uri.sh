#!/bin/bash

# Helper script to update MongoDB URI in .env file

if [ "$#" -ne 1 ]; then
    echo "Usage: ./update-mongodb-uri.sh 'mongodb+srv://user:pass@cluster.mongodb.net/orbitai'"
    echo ""
    echo "This script updates the MONGODB_URI in the .env file"
    exit 1
fi

NEW_URI="$1"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Creating .env file..."
    touch .env
fi

# Check if MONGODB_URI already exists in .env
if grep -q "^MONGODB_URI=" .env; then
    # Update existing MONGODB_URI
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^MONGODB_URI=.*|MONGODB_URI=$NEW_URI|" .env
    else
        # Linux
        sed -i "s|^MONGODB_URI=.*|MONGODB_URI=$NEW_URI|" .env
    fi
    echo "✅ Updated MONGODB_URI in .env file"
else
    # Add new MONGODB_URI
    echo "MONGODB_URI=$NEW_URI" >> .env
    echo "✅ Added MONGODB_URI to .env file"
fi

echo ""
echo "📝 Current MONGODB_URI:"
grep "^MONGODB_URI=" .env

echo ""
echo "🚀 You can now start the server with: npm run dev"

