#!/bin/bash

# Script to generate JWT key pair for Datafi coordinator
# Usage: ./scripts/generate-jwt-keys.sh

set -e

echo "Generating JWT key pair for Datafi coordinator..."

# Generate private key
openssl genpkey -algorithm RSA -out jwt-private-key.pem -aes256
echo "Private key generated: jwt-private-key.pem"

# Generate public key
openssl pkey -in jwt-private-key.pem -pubout -out jwt-public-key.pem
echo "Public key generated: jwt-public-key.pem"

# Generate a UUID for JWT_KID
JWT_KID=$(uuidgen)
echo "Generated JWT_KID: $JWT_KID"

echo ""
echo "Add these to your env.sh file:"
echo "export CO_JWT_KID=\"$JWT_KID\""
echo "export CO_JWT_KEY=\"\$(cat jwt-private-key.pem | tr -d '\n')\""
echo "export JWT_JWKS=\"\$(cat jwt-public-key.pem | tr -d '\n')\""

echo ""
echo "IMPORTANT:"
echo "1. Keep jwt-private-key.pem secure and do not commit it to version control"
echo "2. The public key (jwt-public-key.pem) will be shared with edge servers"
echo "3. You'll be prompted for a passphrase - remember it as you'll need it"

echo ""
echo "Example Redis KEYVAL generation:"
echo "echo -n '{\"kind\":\"redis\",\"addr\":\"your-redis-host:6379\",\"username\":\"default\",\"password\":\"your-redis-password\"}' | base64" 