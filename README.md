# Datafi Edge Deployment in AWS

# Steps to Deploy

1. fork the repository.
2. clone newly created repository locally.
3. Make sure node & cdk is installed, and run `npm install`
4. Run `cdk bootstrap`, if not already done.
5. Update config.ts file to match with the parameters required.
6. Run CDK deploy

This is a blank project for CDK development with TypeScript.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template
