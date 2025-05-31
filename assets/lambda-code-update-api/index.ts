import {
  ECSClient,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  RegisterTaskDefinitionCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

const ecsClient = new ECSClient({ region: process.env.AWS_REGION });
console.log("Lambda function update-api is starting");

// Environment variables required
const API_SECRET = process.env.API_SECRET as string;
const REGION = process.env.AWS_REGION as string;

// For backward compatibility with single service mode
const CLUSTER_NAME = process.env.CLUSTER_NAME as string;
const SERVICE_NAME = process.env.SERVICE_NAME as string;
const CONTAINER_NAME = process.env.CONTAINER_NAME as string;
const SERVICE_TYPE = process.env.SERVICE_TYPE as string; // "ES" or "CO"

// For unified multi-service mode
const SERVICES_CONFIG = process.env.SERVICES_CONFIG;

interface ServiceConfig {
  serviceType: "ES" | "CO";
  clusterName: string;
  serviceName: string;
  containerName: string;
}

const validateApiKey = (headers: {
  [key: string]: string | undefined;
}): void => {
  const providedApiKey = headers["x-api-key"];
  if (!providedApiKey || providedApiKey !== API_SECRET) {
    throw new Error("Invalid or missing API key");
  }
};

const getServiceConfig = (target: string): ServiceConfig => {
  // If we're in unified mode with multiple services
  if (SERVICES_CONFIG) {
    const services: ServiceConfig[] = JSON.parse(SERVICES_CONFIG);
    const targetService = services.find(
      (service) => service.serviceType.toUpperCase() === target.toUpperCase()
    );

    if (!targetService) {
      throw new Error(
        `Service type '${target}' not found. Available types: ${services
          .map((s) => s.serviceType)
          .join(", ")}`
      );
    }

    return targetService;
  }

  // Backward compatibility mode - single service
  if (!CLUSTER_NAME || !SERVICE_NAME || !CONTAINER_NAME || !SERVICE_TYPE) {
    throw new Error("Service configuration not found");
  }

  if (target.toUpperCase() !== SERVICE_TYPE.toUpperCase()) {
    throw new Error(
      `This endpoint only supports ${SERVICE_TYPE} updates. Requested: ${target}`
    );
  }

  return {
    serviceType: SERVICE_TYPE as "ES" | "CO",
    clusterName: CLUSTER_NAME,
    serviceName: SERVICE_NAME,
    containerName: CONTAINER_NAME,
  };
};

const updateServiceImage = async (
  imageTag: string,
  serviceConfig: ServiceConfig
): Promise<{ newTaskDefinitionArn: string; serviceArn: string }> => {
  try {
    // Get current task definition
    const service = await ecsClient.send(
      new DescribeServicesCommand({
        cluster: serviceConfig.clusterName,
        services: [serviceConfig.serviceName],
      })
    );

    if (!service.services || service.services.length === 0) {
      throw new Error(`Service '${serviceConfig.serviceName}' not found`);
    }
    console.log("Service found:", service.services[0]);

    const taskDefinitionArn = service.services[0].taskDefinition || "";
    if (!taskDefinitionArn) {
      throw new Error("Task definition not found");
    }
    const taskDef = await ecsClient.send(
      new DescribeTaskDefinitionCommand({
        taskDefinition: taskDefinitionArn,
      })
    );

    if (!taskDef.taskDefinition) {
      throw new Error("Task definition not found");
    }
    console.log("Task definition found:", taskDef.taskDefinition);

    // Create new task definition with updated image
    const containerDefinitions =
      taskDef.taskDefinition.containerDefinitions?.map((container) => {
        if (container.name === serviceConfig.containerName && container.image) {
          // Preserve the repository URL but update the tag
          const currentImage = container.image;
          const repository = currentImage.split(":")[0];
          container.image = `${repository}:${imageTag}`;
        }
        return container;
      });

    // Register new task definition
    const newTaskDef = await ecsClient.send(
      new RegisterTaskDefinitionCommand({
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
    );

    if (!newTaskDef.taskDefinition) {
      throw new Error("Failed to register new task definition");
    }

    console.log("New task definition created:", newTaskDef.taskDefinition);

    // Update service with new task definition
    const updatedService = await ecsClient.send(
      new UpdateServiceCommand({
        cluster: serviceConfig.clusterName,
        service: serviceConfig.serviceName,
        taskDefinition: newTaskDef.taskDefinition.taskDefinitionArn,
        forceNewDeployment: true,
      })
    );
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
    let body: { imageTag: string; target: string };
    try {
      body = JSON.parse(event.body || "{}") as {
        imageTag: string;
        target: string;
      };
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

    if (!body.target) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "target is required in request body. Must be 'ES' or 'CO'",
        }),
      };
    }

    // Get service configuration based on target
    let serviceConfig: ServiceConfig;
    try {
      serviceConfig = getServiceConfig(body.target);
    } catch (error) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Invalid target",
          message: (error as Error).message,
        }),
      };
    }

    // Update the service with new image
    const result = await updateServiceImage(body.imageTag, serviceConfig);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": context.awsRequestId,
      },
      body: JSON.stringify({
        message: `${serviceConfig.serviceType} service update initiated successfully`,
        serviceType: serviceConfig.serviceType,
        serviceName: serviceConfig.serviceName,
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
