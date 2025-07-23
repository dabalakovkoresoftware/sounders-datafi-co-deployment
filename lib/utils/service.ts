import * as EC2 from "aws-cdk-lib/aws-ec2";
import * as S3 from "aws-cdk-lib/aws-s3";
import * as ECS from "aws-cdk-lib/aws-ecs";
import * as IAM from "aws-cdk-lib/aws-iam";
import * as SD from "aws-cdk-lib/aws-servicediscovery";
import * as SecretsManager from "aws-cdk-lib/aws-secretsmanager";

import { Construct } from "constructs";
import { ICluster } from "aws-cdk-lib/aws-ecs";

type PortMapping = {
  containerPort: number;
  hostPort?: number;
};

export type ServiceProps = {
  name: string;
  cpu: number;
  memory: number;
  openPorts: PortMapping[];
  arch?: ECS.CpuArchitecture;
  policies?: IAM.PolicyStatementProps[];
  envVars?: { [k: string]: string };
  desiredCount?: number;
  containerImage?: string;
  registryCredentials?: {
    credentialsParameter: string;
  };
};

export const createService = (
  scope: Construct,
  prefix: string,
  cluster: ICluster,
  sg: EC2.ISecurityGroup,
  props: ServiceProps,
  namespace?: SD.INamespace,
  containerTag?: string,
  s3Buckets?: S3.Bucket[]
) => {
  const imageUri =
    props.containerImage || `datafi/es:${containerTag || "latest"}`;

  let image: ECS.ContainerImage;
  if (props.registryCredentials) {
    const secret = SecretsManager.Secret.fromSecretCompleteArn(
      scope,
      `${prefix}-registry-secret`,
      props.registryCredentials.credentialsParameter
    );
    image = ECS.ContainerImage.fromRegistry(imageUri, {
      credentials: secret,
    });
  } else {
    image = ECS.ContainerImage.fromRegistry(imageUri);
  }

  // task definition
  const taskDef = new ECS.FargateTaskDefinition(
    scope,
    `${prefix}-${props.name}-taskDef`,
    {
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
      runtimePlatform: {
        cpuArchitecture: props.arch || ECS.CpuArchitecture.X86_64,
        operatingSystemFamily: ECS.OperatingSystemFamily.LINUX,
      },
    }
  );

  if (Array.isArray(props.policies)) {
    for (const policy of props.policies) {
      taskDef.addToTaskRolePolicy(new IAM.PolicyStatement(policy));
    }
  }

  // Add S3 access for additional buckets
  if (s3Buckets && s3Buckets.length > 0) {
    const bucketArns: string[] = [];
    const bucketObjectArns: string[] = [];

    s3Buckets.forEach((bucket) => {
      bucketArns.push(bucket.bucketArn);
      bucketObjectArns.push(`${bucket.bucketArn}/*`);
    });

    taskDef.addToTaskRolePolicy(
      new IAM.PolicyStatement({
        actions: ["s3:*"],
        resources: [...bucketArns, ...bucketObjectArns],
      })
    );
  }

  const container = taskDef.addContainer(`container-${props.name}`, {
    containerName: `container-${props.name}`,
    image: image,
    memoryLimitMiB: props.memory,
    logging: ECS.LogDriver.awsLogs({ streamPrefix: props.name }),
    environment: props.envVars,
  });

  for (const PortMapping of props.openPorts) {
    container.addPortMappings({
      ...PortMapping,
      protocol: ECS.Protocol.TCP,
    });
  }

  // create service

  const cloudMapOptions: ECS.CloudMapOptions | undefined = namespace
    ? {
        name: props.name,
        cloudMapNamespace: namespace,
        dnsRecordType: SD.DnsRecordType.A,
      }
    : undefined;

  const service = new ECS.FargateService(scope, `service-${props.name}`, {
    cluster: cluster,
    desiredCount: props.desiredCount !== undefined ? props.desiredCount : 1,
    taskDefinition: taskDef,
    serviceName: props.name,
    securityGroups: [sg],
    cloudMapOptions: cloudMapOptions,
  });

  const targets: { [k: number]: ECS.IEcsLoadBalancerTarget } = {};

  for (const portMapping of props.openPorts) {
    const port = portMapping.hostPort || portMapping.containerPort;
    const lbTarget = service.loadBalancerTarget({
      containerName: `container-${props.name}`,
      containerPort: portMapping.containerPort,
    });
    lbTarget.connections.allowFrom(
      sg,
      EC2.Port.tcp(portMapping.containerPort),
      `${props.name} - Allow traffic within security group on ${port}`
    );
    console.log("setting up target for ", port);
    targets[port] = lbTarget;
  }

  const resp = {
    targets,
    CLUSTER_NAME: cluster.clusterName,
    SERVICE_NAME: service.serviceName,
    CONTAINER_NAME: container.containerName,
    taskDef,
  };

  return resp;
};
