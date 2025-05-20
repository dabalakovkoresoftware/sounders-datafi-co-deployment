import * as R53 from "aws-cdk-lib/aws-route53";
import * as R53Targets from "aws-cdk-lib/aws-route53-targets";
import * as cdk from "aws-cdk-lib";
import * as ACM from "aws-cdk-lib/aws-certificatemanager";
import * as ELB from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

// a function takes stack and hostedZoneName create a hostedzone and return , this function should be then called from  DatafiEdgeStack constructor
export function createHostedZone(
  stack: Construct,
  rootDomain: string,
  prefix: string,
  hostedZoneId?: string,
  certificateArn?: string
): { zone: R53.IHostedZone; cert: ACM.ICertificate } {
  let zone: R53.IHostedZone;
  if (hostedZoneId) {
    zone = R53.HostedZone.fromHostedZoneAttributes(stack, `hz-${rootDomain}`, {
      hostedZoneId: hostedZoneId,
      zoneName: rootDomain,
    });
  } else {
    zone = new R53.PublicHostedZone(stack, `hz-${rootDomain}`, {
      zoneName: rootDomain,
    });
  }

  let cert: ACM.ICertificate;
  if( certificateArn ) {
    cert = ACM.Certificate.fromCertificateArn(stack, `${prefix}-cert`, certificateArn);
  }
  else {
    cert = new ACM.Certificate(stack, `${prefix}-cert`, {
      domainName: `${rootDomain}`,
      subjectAlternativeNames: [`*.${rootDomain}`],
      validation: ACM.CertificateValidation.fromDns(zone),
    });
  }

  return {
    zone,
    cert,
  };
}

export function addALBToZone(
  stack: Construct,
  zone: R53.IHostedZone,
  rootDomain: string,
  alb: ELB.ApplicationLoadBalancer
) {
  // create DNS record to point to the load balancer
  new R53.ARecord(stack, "datafi-edge-alb-root", {
    zone,
    recordName: rootDomain,
    target: R53.RecordTarget.fromAlias(new R53Targets.LoadBalancerTarget(alb)),
    ttl: cdk.Duration.seconds(300),
    comment: `Datafi Edge Root Domain`,
  });

  new R53.ARecord(stack, "datafi-edge-alb-subdomains", {
    zone,
    recordName: `*.${rootDomain}`,
    target: R53.RecordTarget.fromAlias(new R53Targets.LoadBalancerTarget(alb)),
    ttl: cdk.Duration.seconds(300),
    comment: `Datafi Edge Subdomains`,
  });
}

export function getCertificateFromArn(
  stack: Construct,
  certificateArn: string
): ACM.ICertificate {
  return ACM.Certificate.fromCertificateArn(
    stack,
    "imported-cert",
    certificateArn
  );
}
