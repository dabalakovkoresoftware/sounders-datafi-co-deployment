import { Construct } from "constructs";
import { EdgeServerConfig } from "../../types";
import { createS3Bucket } from "./s3";
import { createService, ServiceProps } from "./service";
import { setGrpcTarget, setHttpsTarget } from "./targets";
import * as cdk from "aws-cdk-lib";
import { config } from "../../config";
import { setupESUpdateAPI } from "./update-api";

const defaultEnvVars = {
  LOG_LEVEL: "INFO",
  DISABLE_SSL: "true",
};

const conf = {
  name: "es",
  s3Enabled: true,
  s3BucketSuffix: "",
  memroy: 512,
  cpu: 256,
  envVars: {
    MEMORY: "768",
    LOG_LEVEL: "INFO",
    KEY: ``,
  },
};

export function createLongRunningEdgeServer(
  stack: Construct,
  esConfig: EdgeServerConfig,
  cluster: cdk.aws_ecs.Cluster,
  sg: cdk.aws_ec2.SecurityGroup,
  listener: cdk.aws_elasticloadbalancingv2.ApplicationListener,
  gRPCListener: cdk.aws_elasticloadbalancingv2.ApplicationListener,
  namespace?: cdk.aws_servicediscovery.PrivateDnsNamespace
) {
  let s3bucket: cdk.aws_s3.Bucket | undefined = undefined;

  const prefix = `datafi-es-${esConfig.name}`;

  // Container Envitonment Variables

  const envVars = { ...defaultEnvVars, ...esConfig.envVars };

  if (!envVars.MEMORY) {
    envVars.MEMORY = `${Math.round(esConfig.memory / 2)}`; // limit data caching to half of the memory
  }

  if (esConfig.s3Enabled) {
    s3bucket = createS3Bucket(
      stack,
      `datafi-edge-${esConfig.name}${
        esConfig.s3BucketSuffix ? `-${esConfig.s3BucketSuffix}` : ""
      }`
    );
  }

  const esProps: ServiceProps = {
    name: esConfig.name,
    cpu: esConfig.cpu,
    desiredCount: esConfig.desiredCount || 1,
    memory: esConfig.memory,
    openPorts: [
      {
        containerPort: 80,
      },
      {
        containerPort: 50051,
        hostPort: 50051,
      },
    ],
    envVars,
  };

  const { targets, CLUSTER_NAME, SERVICE_NAME, CONTAINER_NAME, taskDef } =
    createService(
      stack,
      prefix,
      cluster,
      sg,
      esProps,
      namespace,
      undefined,
      s3bucket
    );

  // add target group to container

  let domain, httpsPriority, grpcPriority;

  if (config.dns.rootDomain) {
    domain = `${esConfig.name}.${config.dns.rootDomain}`;
    grpcPriority = 1000 + (esConfig.priority || 0);
    httpsPriority = 1000 + (esConfig.priority || 0);
  }

  const domainPriority = setGrpcTarget(
    `datafi-es-${esConfig.name}`,
    gRPCListener,
    50051,
    targets[50051],
    undefined,
    domain,
    grpcPriority
  );

  setHttpsTarget(
    `datafi-es-${esConfig.name}`,
    listener,
    targets[80],
    80,
    undefined,
    domain,
    httpsPriority
  );

  // setup update stack
  const updateTarget = setupESUpdateAPI(
    stack,
    CLUSTER_NAME,
    CONTAINER_NAME,
    SERVICE_NAME,
    taskDef,
    esConfig.updateApiSecret
  );
  setHttpsTarget(
    `datafi-edge-update-api-target`,
    listener,
    updateTarget,
    undefined,
    undefined,
    `df-update.${config.dns.rootDomain}`,
    100,
    true
  );
}
