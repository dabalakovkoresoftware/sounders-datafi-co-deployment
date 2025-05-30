export ES1_KEY=your_edge_server_key # this identifies the edge server and got private keys used for encryption. to create a new key, use the command: docker run --rm -e ENDPOINT=https://es.datafi-edge.yourdomain.com datafi/es for latest version or  docker run --rm datafi/es:next --init --endpoint https://<es-endpoint> for next version
export UPDATE_API_SECRET=your_shared_update_api_secret # create a new unique secret with the command: openssl rand -base64 32

# Coordinator Configuration
export ACR_USERNAME=your_azure_container_registry_username # Azure Container Registry username
export ACR_PASSWORD=your_azure_container_registry_password # Azure Container Registry password/token

export CO_KEYVAL=your_base64_encoded_redis_credentials # Base64 encoded Redis credentials. Example: echo -n '{"kind":"redis","addr":"20.3.178.122:6379","username":"default","password":"ktjxak3koarbru"}' | base64
export CO_JWT_KID=your_jwt_key_id # JWT Key ID (generate a UUID)
export CO_JWT_KEY=your_jwt_private_key # JWT private key for signing tokens (generate RSA or ECDSA key)
export JWT_JWKS=your_jwt_public_key # JWT public key for token validation (should be shared with edge servers)