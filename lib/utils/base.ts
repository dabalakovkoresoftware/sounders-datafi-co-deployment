import * as EC2 from "aws-cdk-lib/aws-ec2";
import * as ECS from "aws-cdk-lib/aws-ecs";
import * as ELB from "aws-cdk-lib/aws-elasticloadbalancingv2";

import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { config } from "../../config";
import {
  createHostedZone,
  getCertificateFromArn,
  addALBToZone,
} from "./hosted-zone";
import { createVPC } from "./vpc";
import { createNamespace } from "./namespace";

export const setupBaseResources = (scope: Construct) => {
  const rootDomain = config.dns.rootDomain;
  const prefix = "datafi-edge";
  let zone, cert, namespace;

  // create or get hosted zone
  if (config.dns.enableHostedZone) {
    ({ zone, cert } = createHostedZone(
      scope,
      rootDomain,
      prefix,
      config.dns.hostedZoneId,
      config.dns.certificateArn
    ));
  }

  // VPC and ECS cluster
  const vpc = createVPC(scope, config.vpc.vpcId);
  const cluster = new ECS.Cluster(scope, `${prefix}-cluster`, {
    clusterName: `${prefix}-cluster`,
    vpc: vpc,
  });

  // Application Load Balancer
  const alb = new ELB.ApplicationLoadBalancer(scope, `${prefix}-alb`, {
    vpc: vpc,
    internetFacing: true,
    http2Enabled: true,
    loadBalancerName: `${prefix}-alb`,
    idleTimeout: Duration.seconds(config.loadBalancer?.timeout || 180),
  });

  // APIs security group
  const sg = new EC2.SecurityGroup(scope, `${prefix}-sg`, {
    vpc,
    allowAllOutbound: true,
  });

  // create namespace if zone is present and namespace is enabled
  if (zone && config.dns.enableNameSpace) {
    namespace = createNamespace(scope, vpc, prefix);
  }

  // if the certificate is not created as part of zone creation and certificate ARN is provided in config then use the provided certificate
  if (!cert && config.dns.certificateArn) {
    cert = getCertificateFromArn(scope, config.dns.certificateArn);
  }

  // add ALB to zone if zone is present
  if (zone && alb) {
    addALBToZone(scope, zone, rootDomain, alb);
  }

  const certificates = cert ? [cert] : [];

  /* CONFIGURE ALB DEFAULT LISTENERS */
  // port 80 listener redirect to port 443
  const port80Listener = alb.addListener("port80Listener", { port: 80 });
  const gRPCListener = alb.addListener("gRPCListener", {
    open: true,
    port: 50051,
    certificates,
    protocol: ELB.ApplicationProtocol.HTTPS,
  });

  port80Listener.addAction("80to443Redirect", {
    action: ELB.ListenerAction.redirect({
      port: "443",
      protocol: ELB.Protocol.HTTPS,
      permanent: true,
    }),
  });

  const listener = alb.addListener("Listener", {
    open: true,
    port: 443,
    certificates,
  });

  listener.addAction("default-action", {
    action: ELB.ListenerAction.fixedResponse(401, {
      contentType: "text/plain",
      messageBody: "No Allowed",
    }),
  });
  gRPCListener.addAction("default-action", {
    action: ELB.ListenerAction.fixedResponse(401, {
      contentType: "text/plain",
      messageBody: "No Allowed RPC",
    }),
  });

  return { cluster, namespace, sg, listener, gRPCListener };
};
