import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { config } from "../../config";

export function createS3Bucket(stack: Construct, prefix: string): s3.Bucket {
  const bucketName = `${prefix}-storage`;

  const bucket = new s3.Bucket(stack, bucketName, {
    bucketName: bucketName,
    versioned: true,
    removalPolicy: config.allowDeleteResources
      ? cdk.RemovalPolicy.DESTROY
      : cdk.RemovalPolicy.RETAIN,
    autoDeleteObjects: !!config.allowDeleteResources,
  });

  return bucket;
}
