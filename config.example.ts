import { StackConfig } from "./types";

export const config: StackConfig = {
  deploymentName: "mydeployment", // Name of this deployment
  aws: {
    accountId: "12xxx", // your aws account id
    region: "us-east-1", // your aws region
  },
  loadBalancer: {
    timeout: 3600,
  },
  dns: {
    rootDomain: "datafi-edge.yourdomain.com",
    certificateArn: "", // "arn:aws:acm:ap-south-1:111:certificate/xxx",
    enableHostedZone: true, // If this is true, the stack will create a new hosted zone if not provided and manage certificates
    enableNameSpace: false, // If this is true, the stack will create a new namespace in the service discovery, this is required only if you are hosting additional Datafi services which interacts each other.
    hostedZoneId: "xxx", // If useHostedZone is true and you want to use an existing hosted zone, provide the ARN here
  },
  vpc: {
    vpcId: "vpc-xxx", // If this is provided, the stack will use the existing VPC
  },
  edgeServers: {
    longRunning: [
      {
        name: "es",
        s3Enabled: true,
        // To deploy the next version of ES instead of latest:
        // 1. Change esContainerTag to "next"
        // 2. Replace KEY with EDGE_KEY in envVars
        // 3. Get EDGE_KEY by running: docker run --rm datafi/es:next --init --endpoint https://<es-endpoint>
        esContainerTag: "next", // Change to "next" for next version
        s3BucketSuffix: "",
        memory: 2048,
        cpu: 1024,
        desiredCount: 1, // Number of instance of the same container you want to run in parallel , default is 1
        envVars: {
          LOG_LEVEL: "INFO",
          TIMEOUT: "1200",
          CACHE_LIFE: "1800",
          EDGE_KEY: process.env.ES1_KEY || "", // For next version, use EDGE_KEY instead of KEY
          JWT_JWKS: process.env.JWT_JWKS || "", // JWT public key for token validation
        },
      },
    ],
    serverless: [],
  },
  coordinator: {
    name: "co",
    memory: 2048,
    cpu: 1024,
    desiredCount: 1,
    containerTag: "latest",
    azureContainerRegistry: {
      registryUrl: "datafi.azurecr.io",
      username: process.env.ACR_USERNAME || "",
      password: process.env.ACR_PASSWORD || "",
    },
    envVars: {
      GLOBAL_COORDINATOR: "https://co-global.api.home.datafi.us",
      KEYVAL: process.env.CO_KEYVAL || "", // Base64 encoded Redis credentials
      JWT_KID: process.env.CO_JWT_KID || "",
      JWT_ISS: "https://co.datafi-edge.yourdomain.com/", // update this to your domain
      JWT_KEY: process.env.CO_JWT_KEY || "", // JWT private key for signing tokens
      TOKEN_ISSUER:
        "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_FDV8RBt3G",
      MODE: "prod",
    },
  },
  updateApiSecret: process.env.UPDATE_API_SECRET || "",
  sharedS3BucketSuffix: "v1", // Optional suffix for shared S3 buckets to ensure uniqueness
  allowDeleteResources: false,
};
