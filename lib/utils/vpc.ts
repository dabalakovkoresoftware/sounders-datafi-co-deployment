import * as EC2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

// a function takes stack and hostedZoneName create a hostedzone and return , this function should be then called from  DatafiEdgeStack constructor
export function createVPC(
  stack: Construct,
  vpcId?: string
): EC2.IVpc {
  let vpc: EC2.IVpc;
  if (vpcId) {
    vpc = EC2.Vpc.fromLookup(stack, `vpc-${vpcId}`, {
      vpcId: vpcId,
    });
  } else {
    vpc = new EC2.Vpc(stack, `vpc-${vpcId}`, {
      maxAzs: 2
    });
  }

  return vpc;
}