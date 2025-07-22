import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { setupBaseResources } from "./utils/base";
import { createHostedZone } from "./utils/hosted-zone";
import { createLongRunningEdgeServer } from "./utils/edge-server-lr";
import { createCoordinator } from "./utils/coordinator";
import { setupUnifiedUpdateAPI, ServiceInfo } from "./utils/update-api";
import { setHttpsTarget } from "./utils/targets";
import { createSharedS3Buckets } from "./utils/s3";
import { config } from "../config";

export class DatafiEdgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // If the stack is disabled. do not create any resources
    if (config.disableStack) return;

    // Setup base resources
    const { cluster, namespace, sg, listener, gRPCListener } =
      setupBaseResources(this);

    // Create shared S3 buckets for datafiles and documents
    const { datafilesBucket, documentsBucket } = createSharedS3Buckets(this);

    // Collect all services for update API
    const services: ServiceInfo[] = [];

    // Setup Long running Edge Servers
    config.edgeServers.longRunning.forEach((esConfig) => {
      const serviceInfo = createLongRunningEdgeServer(
        this,
        esConfig,
        cluster,
        sg,
        listener,
        gRPCListener,
        namespace,
        { datafilesBucket, documentsBucket }
      );

      if (serviceInfo) {
        services.push(serviceInfo);
      }
    });

    // Setup Coordinator (if configured)
    if (config.coordinator) {
      const coordinatorInfo = createCoordinator(
        this,
        config.coordinator,
        cluster,
        sg,
        listener,
        gRPCListener,
        namespace,
        { datafilesBucket, documentsBucket }
      );

      if (coordinatorInfo) {
        services.push(coordinatorInfo);
      }
    }

    // Setup update API if we have any services
    if (services.length > 0) {
      const unifiedUpdateTarget = setupUnifiedUpdateAPI(
        this,
        services,
        config.updateApiSecret
      );

      // Add update API target to load balancer
      setHttpsTarget(
        "datafi-unified-update-api-target",
        listener,
        unifiedUpdateTarget,
        undefined,
        undefined,
        `update.${config.dns.rootDomain}`,
        50, // High priority for update API
        true
      );
    }
  }
}
