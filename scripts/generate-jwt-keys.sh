#!/bin/bash

# Script to generate JWT key pair for Datafi coordinator
# Usage: ./scripts/generate-jwt-keys.sh

echo "This script has been migrated to Python for better functionality."
echo "Please use the Python version instead:"
echo ""
echo "Usage: python scripts/generate-jwt-keys.py"
echo ""
echo "Required dependencies:"
echo "pip install cryptography python-jose"
echo ""
echo "Or if you have a requirements file, add:"
echo "cryptography>=3.0.0"
echo "python-jose>=3.0.0"
echo ""
echo "Running Python version..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed or not in PATH"
    exit 1
fi

# Check if required packages are installed
python3 -c "import cryptography, jose" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Error: Required Python packages are not installed."
    echo "Please install them with: pip install cryptography python-jose"
    exit 1
fi

# Run the Python script
exec python3 scripts/generate-jwt-keys.py 