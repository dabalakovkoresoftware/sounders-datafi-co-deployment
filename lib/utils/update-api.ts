import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as IAM from "aws-cdk-lib/aws-iam";
import * as ECS from "aws-cdk-lib/aws-ecs";
import * as Targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";

export function setupESUpdateAPI(
  scope: Construct,
  CLUSTER_NAME: string,
  CONTAINER_NAME: string,
  SERVICE_NAME: string,
  taskDef: ECS.FargateTaskDefinition,
  API_SECRET: string
) {
  // Create Lambda layer
  const updateApiBaseLayer = new lambda.LayerVersion(
    scope,
    "UpdateApiBaseLayer",
    {
      code: lambda.Code.fromAsset("assets/lambda-code-update-api-base"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Lambda layer for update API base functionality",
    }
  );

  const updateImageLambda = new lambda.Function(scope, "UpdateImageLambda", {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: "index.handler",
    code: lambda.Code.fromAsset("assets/lambda-code-update-api/dist"),
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      CLUSTER_NAME,
      CONTAINER_NAME,
      SERVICE_NAME,
      API_SECRET,
    },
    layers: [updateApiBaseLayer], // Add the layer to the Lambda function
  });

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
