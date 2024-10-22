#!/bin/bash

# Navigate to the lambda-code-update-api directory and install dependencies and run the build script
cd assets/lambda-code-update-api
npm install
npm run build

# Navigate to the lambda-code-update-api-base/nodejs directory and install dependencies
cd ../lambda-code-update-api-base/nodejs
npm install

echo "Building lambda assets complete"