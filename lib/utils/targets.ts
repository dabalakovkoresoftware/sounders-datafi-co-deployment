import * as ELB from "aws-cdk-lib/aws-elasticloadbalancingv2";

import { Duration } from "aws-cdk-lib";

export const setGrpcTarget = (
  prefix: string,
  listener: ELB.ApplicationListener,
  port: number,
  target: ELB.IApplicationLoadBalancerTarget,
  healthCheckPath?: string,
  domain?: string,
  priority?: number
) => {
  let conditions = {};

  if (domain) {
    conditions = {
      conditions: [ELB.ListenerCondition.hostHeaders([domain])],
      priority: priority || 1,
    };
  }

  const targetGroup = listener.addTargets(`tg-${prefix}-grpc`, {
    port,
    targets: [target],
    protocol: ELB.ApplicationProtocol.HTTP,
    protocolVersion: ELB.ApplicationProtocolVersion.GRPC,
    healthCheck: healthCheckPath
      ? {
          enabled: true,
          protocol: ELB.Protocol.HTTP,
          port: port.toString(),
          path: healthCheckPath,
          healthyGrpcCodes: "0",
          interval: Duration.seconds(15),
          timeout: Duration.seconds(5),
          healthyThresholdCount: 2,
        }
      : undefined,
    ...conditions,
  });
  targetGroup.setAttribute("deregistration_delay.timeout_seconds", "5");
};

export const setHttpsTarget = (
  prefix: string,
  listener: ELB.ApplicationListener,
  target: ELB.IApplicationLoadBalancerTarget,
  port?: number,
  healthCheckPath?: string,
  domain?: string,
  priority?: number,
  isLambda?: boolean
) => {
  let conditions = {};

  if (domain) {
    conditions = {
      conditions: [ELB.ListenerCondition.hostHeaders([domain])],
      priority: priority || 1,
    };
  }
  const targetGroup = listener.addTargets(`tg-${prefix}-https`, {
    protocol: isLambda ? undefined : ELB.ApplicationProtocol.HTTP,
    port: isLambda ? undefined : port,
    targets: [target],
    healthCheck: healthCheckPath
      ? {
          interval: Duration.seconds(15),
          path: healthCheckPath,
          timeout: Duration.seconds(5),
        }
      : undefined,
    ...conditions,
  });
  if (!isLambda) {
    targetGroup.setAttribute("deregistration_delay.timeout_seconds", "5");
  }
};
