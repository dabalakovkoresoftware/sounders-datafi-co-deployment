import * as EC2 from "aws-cdk-lib/aws-ec2";
import * as S3 from "aws-cdk-lib/aws-s3";
import * as ECS from "aws-cdk-lib/aws-ecs";
import * as IAM from "aws-cdk-lib/aws-iam";
import * as SD from "aws-cdk-lib/aws-servicediscovery";

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
};

export const createService = (
  scope: Construct,
  prefix: string,
  cluster: ICluster,
  sg: EC2.ISecurityGroup,
  props: ServiceProps,
  namespace?: SD.INamespace,
  containerTag?: string,
  s3bucket?: S3.Bucket
) => {
  const image = ECS.ContainerImage.fromRegistry(
    `datafi/es:${containerTag || "latest"}`
  );

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

  // Add S3 read/write access policy if s3bucket is provided
  if (s3bucket) {
    taskDef.addToTaskRolePolicy(
      new IAM.PolicyStatement({
        actions: ["s3:*"],
        resources: [s3bucket.bucketArn, `${s3bucket.bucketArn}/*`],
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
