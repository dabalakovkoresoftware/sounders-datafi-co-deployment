import { ECS } from "aws-sdk";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

const ecs = new ECS();
console.log("Lambda function update-api is starting");

// Environment variables required
const API_SECRET = process.env.API_SECRET as string;
const CLUSTER_NAME = process.env.CLUSTER_NAME as string;
const SERVICE_NAME = process.env.SERVICE_NAME as string;
const CONTAINER_NAME = process.env.CONTAINER_NAME as string;
const REGION = process.env.AWS_REGION as string;

const validateApiKey = (headers: {
  [key: string]: string | undefined;
}): void => {
  const providedApiKey = headers["x-api-key"];
  if (!providedApiKey || providedApiKey !== API_SECRET) {
    throw new Error("Invalid or missing API key");
  }
};

const updateServiceImage = async (
  imageTag: string
): Promise<{ newTaskDefinitionArn: string; serviceArn: string }> => {
  try {
    // Get current task definition
    const service = await ecs
      .describeServices({
        cluster: CLUSTER_NAME,
        services: [SERVICE_NAME],
      })
      .promise();

    if (!service.services || service.services.length === 0) {
      throw new Error("Service not found");
    }
    console.log("Service found:", service.services[0]);

    const taskDefinitionArn = service.services[0].taskDefinition || "";
    if (!taskDefinitionArn) {
      throw new Error("Task definition not found");
    }
    const taskDef = await ecs
      .describeTaskDefinition({
        taskDefinition: taskDefinitionArn,
      })
      .promise();

    if (!taskDef.taskDefinition) {
      throw new Error("Task definition not found");
    }
    console.log("Task definition found:", taskDef.taskDefinition);

    // Create new task definition with updated image
    const containerDefinitions =
      taskDef.taskDefinition.containerDefinitions?.map((container) => {
        if (container.name === CONTAINER_NAME && container.image) {
          // Preserve the repository URL but update the tag
          const currentImage = container.image;
          const repository = currentImage.split(":")[0];
          container.image = `${repository}:${imageTag}`;
        }
        return container;
      });

    // Register new task definition
    const newTaskDef = await ecs
      .registerTaskDefinition({
        family: taskDef.taskDefinition.family,
        taskRoleArn: taskDef.taskDefinition.taskRoleArn,
        executionRoleArn: taskDef.taskDefinition.executionRoleArn,
        networkMode: taskDef.taskDefinition.networkMode,
        containerDefinitions: containerDefinitions,
        volumes: taskDef.taskDefinition.volumes,
        placementConstraints: taskDef.taskDefinition.placementConstraints,
        requiresCompatibilities: taskDef.taskDefinition.requiresCompatibilities,
        cpu: taskDef.taskDefinition.cpu,
        memory: taskDef.taskDefinition.memory,
        runtimePlatform: taskDef.taskDefinition.runtimePlatform,
      })
      .promise();

    if (!newTaskDef.taskDefinition) {
      throw new Error("Failed to register new task definition");
    }

    console.log("New task definition created:", newTaskDef.taskDefinition);

    // Update service with new task definition
    const updatedService = await ecs
      .updateService({
        cluster: CLUSTER_NAME,
        service: SERVICE_NAME,
        taskDefinition: newTaskDef.taskDefinition.taskDefinitionArn,
        forceNewDeployment: true,
      })
      .promise();
    console.log("Service updated:", updatedService.service);

    if (!updatedService.service) {
      throw new Error("Failed to update service");
    }

    return {
      newTaskDefinitionArn: newTaskDef.taskDefinition
        .taskDefinitionArn as string,
      serviceArn: updatedService.service.serviceArn as string,
    };
  } catch (error) {
    console.error("Error updating service:", error);
    throw error;
  }
};

const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify HTTP method
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    // Validate API key
    try {
      validateApiKey(event.headers);
    } catch (error) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Unauthorized",
          message: (error as Error).message,
        }),
      };
    }

    // Parse and validate request body
    let body: { imageTag: string };
    try {
      body = JSON.parse(event.body || "{}") as { imageTag: string };
    } catch (error) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    if (!body.imageTag) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "imageTag is required in request body" }),
      };
    }

    // Update the service with new image
    const result = await updateServiceImage(body.imageTag);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": context.awsRequestId,
      },
      body: JSON.stringify({
        message: "Service update initiated successfully",
        details: result,
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal Server Error",
        message: (error as Error).message,
        requestId: context.awsRequestId,
      }),
    };
  }
};

export { handler };
