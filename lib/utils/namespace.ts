import * as SD from "aws-cdk-lib/aws-servicediscovery";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export function createNamespace(
  stack: Construct,
  vpc: IVpc,
  prefix: string
): SD.PrivateDnsNamespace {
  return new SD.PrivateDnsNamespace(stack, `${prefix}-DiscoveryNamespace`, {
    name: "datafi-edge",
    vpc,
  });
}
