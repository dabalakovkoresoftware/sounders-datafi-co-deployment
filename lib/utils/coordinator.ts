import { Construct } from "constructs";
import { CoordinatorConfig } from "../../types";
import { createService, ServiceProps } from "./service";
import { setHttpsTarget } from "./targets";
import { ServiceInfo } from "./update-api";
import * as cdk from "aws-cdk-lib";
import { config } from "../../config";

const defaultEnvVars = {
  LOG_LEVEL: "INFO",
  DISABLE_SSL: "true",
};

export function createCoordinator(
  stack: Construct,
  coordinatorConfig: CoordinatorConfig,
  cluster: cdk.aws_ecs.Cluster,
  sg: cdk.aws_ec2.SecurityGroup,
  listener: cdk.aws_elasticloadbalancingv2.ApplicationListener,
  namespace?: cdk.aws_servicediscovery.PrivateDnsNamespace
): ServiceInfo {
  const prefix = `datafi-co-${coordinatorConfig.name}`;

  // Container Environment Variables
  const envVars = { ...defaultEnvVars, ...coordinatorConfig.envVars };

  // Create a secret for Azure Container Registry credentials
  const acrSecret = new cdk.aws_secretsmanager.Secret(
    stack,
    `${prefix}-acr-secret`,
    {
      secretName: `${prefix}-acr-credentials`,
      description: "Azure Container Registry credentials for coordinator",
      secretObjectValue: {
        username: cdk.SecretValue.unsafePlainText(
          coordinatorConfig.azureContainerRegistry.username
        ),
        password: cdk.SecretValue.unsafePlainText(
          coordinatorConfig.azureContainerRegistry.password
        ),
      },
    }
  );

  const coordinatorProps: ServiceProps = {
    name: coordinatorConfig.name,
    cpu: coordinatorConfig.cpu,
    desiredCount: coordinatorConfig.desiredCount || 1,
    memory: coordinatorConfig.memory,
    openPorts: [
      {
        containerPort: 8001,
      },
    ],
    envVars,
    containerImage: `${
      coordinatorConfig.azureContainerRegistry.registryUrl
    }/co:${coordinatorConfig.containerTag || "latest"}`,
    registryCredentials: {
      credentialsParameter: acrSecret.secretArn,
    },
  };

  const { targets, CLUSTER_NAME, SERVICE_NAME, CONTAINER_NAME, taskDef } =
    createService(stack, prefix, cluster, sg, coordinatorProps, namespace);

  // Add target group to load balancer
  let domain, httpsPriority;

  if (config.dns.rootDomain) {
    domain = `${coordinatorConfig.name}.${config.dns.rootDomain}`;
    httpsPriority = 2000 + (coordinatorConfig.priority || 0); // Higher priority than edge servers
  }

  setHttpsTarget(
    `datafi-co-${coordinatorConfig.name}`,
    listener,
    targets[8001],
    8001,
    undefined,
    domain,
    httpsPriority
  );

  // Return service info for update API
  return {
    serviceType: "CO",
    clusterName: CLUSTER_NAME,
    serviceName: SERVICE_NAME,
    containerName: CONTAINER_NAME,
    taskDef: taskDef,
  };
}
