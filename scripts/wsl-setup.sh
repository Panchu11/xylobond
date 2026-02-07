#!/bin/bash
# XyloBond Agent Setup Script for WSL
# Run this after WSL is installed

set -e

echo "========================================="
echo "XyloBond Agent Setup for OpenClaw"
echo "========================================="

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install OpenClaw
echo ""
echo "Installing OpenClaw..."
npm install -g openclaw

# Set Anthropic API key (replace with your actual key)
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ERROR: ANTHROPIC_API_KEY environment variable not set"
    echo "Run: export ANTHROPIC_API_KEY='your-key-here'"
    exit 1
fi

echo ""
echo "Running OpenClaw onboard..."
openclaw onboard --non-interactive --accept-risk \
    --auth-choice anthropic-api-key \
    --skip-channels \
    --skip-ui

echo ""
echo "Creating XyloBond agent..."
openclaw agents add xylobond-agent

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Start the gateway: openclaw gateway"
echo "2. Connect to Moltbook channel"
echo "3. Submit to m/usdc"
echo ""
