import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as IAM from "aws-cdk-lib/aws-iam";
import * as ECS from "aws-cdk-lib/aws-ecs";
import * as Targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";

export interface ServiceInfo {
  serviceType: "ES" | "CO";
  clusterName: string;
  serviceName: string;
  containerName: string;
  taskDef: ECS.FargateTaskDefinition;
}

export function setupUnifiedUpdateAPI(
  scope: Construct,
  services: ServiceInfo[],
  API_SECRET: string
) {
  // Create Lambda layer
  const updateApiBaseLayer = new lambda.LayerVersion(
    scope,
    "UnifiedUpdateApiBaseLayer",
    {
      code: lambda.Code.fromAsset("assets/lambda-code-update-api-base"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Lambda layer for update API base functionality",
    }
  );

  // Create environment variables for all services
  const envVars: { [key: string]: string } = {
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
    API_SECRET,
    SERVICES_CONFIG: JSON.stringify(
      services.map((service) => ({
        serviceType: service.serviceType,
        clusterName: service.clusterName,
        serviceName: service.serviceName,
        containerName: service.containerName,
      }))
    ),
  };

  const unifiedUpdateLambda = new lambda.Function(
    scope,
    "UnifiedUpdateLambda",
    {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("assets/lambda-code-update-api/dist"),
      environment: envVars,
      layers: [updateApiBaseLayer],
    }
  );

  unifiedUpdateLambda.addToRolePolicy(
    new IAM.PolicyStatement({
      actions: [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
      ],
      resources: ["*"],
    })
  );

  // Add PassRole permissions for all task roles and execution roles
  const roleArns: string[] = [];
  services.forEach((service) => {
    roleArns.push(service.taskDef.taskRole.roleArn);
    if (service.taskDef.executionRole?.roleArn) {
      roleArns.push(service.taskDef.executionRole.roleArn);
    }
  });

  unifiedUpdateLambda.addToRolePolicy(
    new IAM.PolicyStatement({
      actions: ["iam:PassRole"],
      resources: roleArns,
    })
  );

  return new Targets.LambdaTarget(unifiedUpdateLambda);
}

export function setupUpdateAPI(
  scope: Construct,
  CLUSTER_NAME: string,
  CONTAINER_NAME: string,
  SERVICE_NAME: string,
  taskDef: ECS.FargateTaskDefinition,
  API_SECRET: string,
  SERVICE_TYPE: "ES" | "CO",
  functionNameSuffix: string
) {
  // Create Lambda layer
  const updateApiBaseLayer = new lambda.LayerVersion(
    scope,
    `UpdateApiBaseLayer-${functionNameSuffix}`,
    {
      code: lambda.Code.fromAsset("assets/lambda-code-update-api-base"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: `Lambda layer for ${SERVICE_TYPE} update API base functionality`,
    }
  );

  const updateImageLambda = new lambda.Function(
    scope,
    `UpdateImageLambda-${functionNameSuffix}`,
    {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("assets/lambda-code-update-api/dist"),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        CLUSTER_NAME,
        CONTAINER_NAME,
        SERVICE_NAME,
        SERVICE_TYPE,
        API_SECRET,
      },
      layers: [updateApiBaseLayer], // Add the layer to the Lambda function
    }
  );

  updateImageLambda.addToRolePolicy(
    new IAM.PolicyStatement({
      actions: [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
      ],
      resources: ["*"],
    })
  );

  // Add PassRole permissions for task role and execution role
  updateImageLambda.addToRolePolicy(
    new IAM.PolicyStatement({
      actions: ["iam:PassRole"],
      resources: [
        taskDef.taskRole.roleArn, // Add the task role ARN
        taskDef.executionRole?.roleArn ?? "", // Add the execution role ARN
      ],
    })
  );

  return new Targets.LambdaTarget(updateImageLambda);
}

// Legacy function for backward compatibility
export function setupESUpdateAPI(
  scope: Construct,
  CLUSTER_NAME: string,
  CONTAINER_NAME: string,
  SERVICE_NAME: string,
  taskDef: ECS.FargateTaskDefinition,
  API_SECRET: string
) {
  return setupUpdateAPI(
    scope,
    CLUSTER_NAME,
    CONTAINER_NAME,
    SERVICE_NAME,
    taskDef,
    API_SECRET,
    "ES",
    "ES"
  );
}
