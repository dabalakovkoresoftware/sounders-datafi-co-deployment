#!/usr/bin/env python3

"""
Script to generate JWT key pair for Datafi coordinator
Usage: python scripts/generate-jwt-keys.py
"""

import base64
import json
import uuid
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk

def generate_key_pair():
    """Generate RSA key pair and return private key object and public key PEM."""
    # Generate a private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )
    
    # Get the public key
    public_key = private_key.public_key()
    
    # Serialize private key to PEM format
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Serialize public key to PEM format
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return private_key, private_pem, public_pem

def create_jwks(public_key_pem, kid):
    """Create JWKS from public key."""
    # Convert PEM to JWK
    jwk_key = jwk.RSAKey(
        algorithm="RS256",
        key=public_key_pem.decode('utf-8')
    ).to_dict()
    
    # Create JWKS structure
    jwks = {
        "keys": [
            {
                "kty": jwk_key["kty"],
                "kid": kid,  # Key ID for reference
                "use": "sig",  # For signing
                "alg": "RS256",  # Algorithm
                "n": jwk_key["n"],  # Modulus
                "e": jwk_key["e"],  # Exponent
            }
        ]
    }
    return jwks

def main():
    print("Generating JWT key pair for Datafi coordinator...")
    
    # Generate key pair
    private_key, private_pem, public_pem = generate_key_pair()
    
    # Save keys to files
    with open('jwt-private-key.pem', 'wb') as f:
        f.write(private_pem)
    print("Private key generated: jwt-private-key.pem")
    
    with open('jwt-public-key.pem', 'wb') as f:
        f.write(public_pem)
    print("Public key generated: jwt-public-key.pem")
    
    # Generate UUID for JWT_KID
    jwt_kid = str(uuid.uuid4())
    print(f"Generated JWT_KID: {jwt_kid}")
    
    # Create JWKS
    jwks = create_jwks(public_pem, jwt_kid)
    
    # Base64 encode the private key and JWKS
    co_jwt_key = base64.b64encode(private_pem).decode('utf-8')
    jwt_jwks = base64.b64encode(json.dumps(jwks).encode('utf-8')).decode('utf-8')
    
    print()
    print("Add these to your env.sh file:")
    print(f'export CO_JWT_KID="{jwt_kid}"')
    print(f'export CO_JWT_KEY="{co_jwt_key}"')
    print(f'export JWT_JWKS="{jwt_jwks}"')
    
    print()
    print("IMPORTANT:")
    print("1. Keep jwt-private-key.pem secure and do not commit it to version control")
    print("2. The public key (jwt-public-key.pem) will be shared with edge servers")
    print("3. The private key is unencrypted, so keep it secure")
    
    print()
    print("Example Redis KEYVAL generation:")
    print('echo -n \'{"kind":"redis","addr":"your-redis-host:6379","username":"default","password":"your-redis-password"}\' | base64')

if __name__ == "__main__":
    main() 