import { StackConfig } from "./types";

export const config: StackConfig = {
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
        esContainerTag: "latest",
        s3BucketSuffix: "",
        memory: 2048,
        cpu: 1024,
        desiredCount: 1, // Number of instance of the same container you want to run in parallel , default is 1
        updateApiSecret: process.env.ES1_UPDATE_API_SECRET || "",
        envVars: {
          LOG_LEVEL: "INFO",
          TIMEOUT: "1200",
          CACHE_LIFE: "1800",
          KEY: process.env.ES1_KEY || "",
        },
      },
    ],
    serverless: [],
  },
  allowDeleteResources: false,
};
