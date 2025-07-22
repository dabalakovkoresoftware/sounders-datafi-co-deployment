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

export function createSharedS3Buckets(stack: Construct): {
  datafilesBucket: s3.Bucket;
  documentsBucket: s3.Bucket;
} {
  const suffix = config.sharedS3BucketSuffix
    ? `-${config.sharedS3BucketSuffix}`
    : "";

  const datafilesBucket = new s3.Bucket(stack, "datafi-datafiles-bucket", {
    bucketName: `datafi-${config.deploymentName}-datafiles${suffix}`,
    versioned: true,
    removalPolicy: config.allowDeleteResources
      ? cdk.RemovalPolicy.DESTROY
      : cdk.RemovalPolicy.RETAIN,
    autoDeleteObjects: !!config.allowDeleteResources,
  });

  const documentsBucket = new s3.Bucket(stack, "datafi-documents-bucket", {
    bucketName: `datafi-${config.deploymentName}-documents${suffix}`,
    versioned: true,
    removalPolicy: config.allowDeleteResources
      ? cdk.RemovalPolicy.DESTROY
      : cdk.RemovalPolicy.RETAIN,
    autoDeleteObjects: !!config.allowDeleteResources,
  });

  return { datafilesBucket, documentsBucket };
}
