#!/bin/bash

# Plant Watering App - OpenAI Configuration Script
# This script helps you switch between mock and production OpenAI modes

echo "🌱 Plant Watering App - OpenAI Configuration"
echo "============================================"
echo

if [ -f .env ]; then
    echo "📋 Current configuration:"
    if grep -q "USE_MOCK_OPENAI=false" .env; then
        echo "   Mode: Production (Real OpenAI API)"
    elif grep -q "USE_MOCK_OPENAI=true" .env; then
        echo "   Mode: Development (Mock responses)"
    else
        echo "   Mode: Development (Mock responses - default)"
    fi
    echo
fi

echo "Select OpenAI mode:"
echo "1) Development (Mock responses - no API calls)"
echo "2) Production (Real OpenAI API - requires OPENAI_API_KEY)"
echo "3) Show current .env file"
echo "4) Exit"
echo

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "Setting to Development mode (Mock responses)..."
        if [ -f .env ]; then
            # Remove any existing USE_MOCK_OPENAI lines
            sed -i '/USE_MOCK_OPENAI=/d' .env
        fi
        echo "USE_MOCK_OPENAI=true" >> .env
        echo "✅ Set to Development mode"
        echo "   - Plant identification will return mock data"
        echo "   - Health analysis will return mock results"
        echo "   - No OpenAI API calls will be made"
        ;;
    2)
        echo "Setting to Production mode (Real OpenAI API)..."
        if [ -f .env ]; then
            # Remove any existing USE_MOCK_OPENAI lines
            sed -i '/USE_MOCK_OPENAI=/d' .env
        fi
        echo "USE_MOCK_OPENAI=false" >> .env
        echo "✅ Set to Production mode"
        echo "   - Requires valid OPENAI_API_KEY in .env"
        echo "   - Will make real API calls to OpenAI"
        echo "   ⚠️  API calls will consume OpenAI credits"
        ;;
    3)
        if [ -f .env ]; then
            echo "📄 Current .env file contents:"
            echo "─────────────────────────────"
            cat .env
        else
            echo "❌ No .env file found"
            echo "💡 Copy .env.example to .env to get started"
        fi
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo
echo "🔄 Restart the development server to apply changes:"
echo "   npm run dev"
