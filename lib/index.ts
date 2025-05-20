import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { setupBaseResources } from "./utils/base";
import { createHostedZone } from "./utils/hosted-zone";
import { createLongRunningEdgeServer } from "./utils/edge-server-lr";
import { config } from "../config";

export class DatafiEdgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // If the stack is disabled. do not create any resources
    if (config.disableStack) return;

    this.tags.setTag("Stack", "DatafiEdge");//, 1, true);

    // Setup base resources
    const { cluster, namespace, sg, listener, gRPCListener } =
      setupBaseResources(this);

    // Setup Long running Edge Servers
    config.edgeServers.longRunning.forEach((esConfig) => {
      createLongRunningEdgeServer(
        this,
        esConfig,
        cluster,
        sg,
        listener,
        gRPCListener,
        namespace
      );
    });
  }
}
