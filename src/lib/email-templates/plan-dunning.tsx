import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * The payment-plan comms set. One component, six registered templates, so the
 * tone ladder stays visible in one place: neutral, nudge, firm, final,
 * suspension notice, and the welcome back.
 */

export interface PlanEmailProps {
  recipientName?: string | null;
  orderNumber?: string;
  packageLabel?: string;
  cardUpdateUrl?: string;
  paymentsMade?: number;
  paymentsDue?: number;
  monthlyText?: string;
  outstandingText?: string;
  owedText?: string;
  /** Tier drives the tone: a light-tier customer is never threatened. */
  tier?: "heavy" | "moderate" | "light";
  gentle?: boolean;
  accessLevel?: "full" | "limited" | "suspended";
  windDownAt?: string | null;
  isClinic?: boolean;
  cardBrand?: string;
  cardLast4?: string;
  cardExpiry?: string;
  kind?: Kind;
}

type Kind = "failed" | "retry" | "final" | "warning" | "suspended" | "restored" | "card";

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long" }) : "";

function headline(p: PlanEmailProps): string {
  switch (p.kind) {
    case "failed":
      return "Your payment did not go through";
    case "retry":
      return "We still could not take your payment";
    case "final":
      return "Your payment plan needs attention";
    case "warning":
      return p.gentle ? "A small amount is still outstanding" : "Final notice before we pause your account";
    case "suspended":
      return p.accessLevel === "suspended" ? "Your account has been paused" : "Your account is limited";
    case "restored":
      return "You are all caught up";
    case "card":
      return "Your card is about to expire";
    default:
      return "Your Resonabed payment plan";
  }
}

function bodyCopy(p: PlanEmailProps): string[] {
  const remaining =
    typeof p.paymentsMade === "number" && typeof p.paymentsDue === "number"
      ? `You have made ${p.paymentsMade} of ${p.paymentsDue} payments.`
      : "";
  switch (p.kind) {
    case "failed":
      return [
        `We tried to take your ${p.monthlyText} payment for order ${p.orderNumber} and the card declined. This is almost always an expired or replaced card rather than anything you have done.`,
        "We will try again automatically over the next few days. Updating your card now saves the bother.",
        remaining,
      ];
    case "retry":
      return [
        `We have retried your ${p.monthlyText} payment a couple of times and it is still not going through.`,
        "Updating your card takes about a minute and we will collect the missed payment straight away.",
        remaining,
      ];
    case "final":
      return [
        `Our automatic retries for order ${p.orderNumber} have now run out, and ${p.owedText} is outstanding.`,
        "Nothing has changed with your account or your kit. We would just like to get this sorted with you.",
        remaining,
      ];
    case "warning":
      return p.gentle
        ? [
            `There is ${p.outstandingText} left on your plan for order ${p.orderNumber}, and we have not been able to collect it.`,
            "You have paid nearly all of this off, so there is no rush and nothing will change with your account. Update your card whenever suits, or reply to this email and we will sort it out together.",
            remaining,
          ]
        : [
            `Order ${p.orderNumber} still has ${p.outstandingText} outstanding and we have not been able to reach a payment.`,
            p.isClinic
              ? "If we do not hear from you, new bookings and new sessions will be paused. Your client records, screening history and clearance letters always stay available to you."
              : "If we do not hear from you, app access will be paused. Nothing is deleted and everything returns the moment a payment goes through.",
            remaining,
          ];
    case "suspended":
      return [
        p.isClinic
          ? p.windDownAt
            ? `Order ${p.orderNumber} has ${p.outstandingText} outstanding. From ${day(p.windDownAt)} your clinic account will be paused. Bookings already confirmed before that date will still run as normal.`
            : `Order ${p.orderNumber} has ${p.outstandingText} outstanding, so new bookings and new sessions are paused for now.`
          : `Order ${p.orderNumber} has ${p.outstandingText} outstanding, so app access is paused for now. Your table, kit and account are untouched.`,
        p.isClinic
          ? "Your client records, screening history and clearance letters are never withheld. They stay available to you throughout."
          : "Nothing has been deleted. A single payment restores everything immediately.",
      ];
    case "restored":
      return [
        `Thank you, your payment for order ${p.orderNumber} has gone through and your plan is running again.`,
        "Full access has been restored automatically. Nothing else is needed from you.",
        remaining,
      ];
    case "card":
      return [
        `The ${p.cardBrand ?? "card"} ending ${p.cardLast4 ?? ""} on your Resonabed plan expires ${p.cardExpiry ?? "soon"}.`,
        "Updating it now takes a minute and means your next monthly payment goes through without a hitch.",
        remaining,
      ];
    default:
      return [remaining];
  }
}

const Email = (props: PlanEmailProps) => {
  const lines = bodyCopy(props).filter(Boolean);
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline(props)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{headline(props)}</Heading>
          <Text style={text}>{props.recipientName ? `Hi ${props.recipientName},` : "Hi there,"}</Text>
          {lines.map((line, i) => (
            <Text key={i} style={text}>
              {line}
            </Text>
          ))}
          <Section style={box}>
            <Text style={boxLine}>
              Order {props.orderNumber}
              {props.packageLabel ? `, ${props.packageLabel}` : ""}
            </Text>
            {props.outstandingText ? (
              <Text style={boxLine}>Remaining on your plan: {props.outstandingText}</Text>
            ) : null}
          </Section>
          {props.kind !== "restored" && props.cardUpdateUrl ? (
            <Section style={{ textAlign: "center", margin: "28px 0" }}>
              <Button style={button} href={props.cardUpdateUrl}>
                Update your card
              </Button>
            </Section>
          ) : null}
          <Text style={muted}>
            Anything not right, or want to arrange something different? Reply to this email and a
            person will read it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

function make(kind: Kind, subject: string, displayName: string) {
  const Component = (props: PlanEmailProps) => <Email {...props} kind={kind} />;
  return {
    component: Component,
    subject,
    displayName,
    previewData: {
      recipientName: "Sam",
      orderNumber: "ORD-00001",
      packageLabel: "Resonabed Pro",
      cardUpdateUrl: "https://resonabed.com/order/card/example",
      paymentsMade: 3,
      paymentsDue: 10,
      monthlyText: "$110",
      outstandingText: "$770",
      owedText: "$110",
      tier: "heavy" as const,
      isClinic: true,
      cardBrand: "Visa",
      cardLast4: "4242",
      cardExpiry: "09/2026",
    },
  };
}

export const planPaymentFailed = make(
  "failed",
  "Your Resonabed payment did not go through",
  "Plan payment failed",
);
export const planPaymentRetry = make(
  "retry",
  "We still cannot take your Resonabed payment",
  "Plan payment retry",
);
export const planPaymentFinalNotice = make(
  "final",
  "Your Resonabed payment plan needs attention",
  "Plan payment final notice",
);
export const planFinalWarning = make(
  "warning",
  "About your Resonabed payment plan",
  "Plan final warning",
);
export const planAccessSuspended = make(
  "suspended",
  "Your Resonabed account has been paused",
  "Plan access suspended",
);
export const planRestored = make(
  "restored",
  "Your Resonabed plan is running again",
  "Plan restored",
);
export const planCardExpiring = make(
  "card",
  "Your Resonabed payment card expires soon",
  "Plan card expiring",
);

const main = { backgroundColor: "#f6f5fb", fontFamily: "Helvetica, Arial, sans-serif" };
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "560px",
  borderRadius: "12px",
};
const h1 = { color: "#26106c", fontSize: "24px", margin: "0 0 16px" };
const text = { color: "#1f2937", fontSize: "15px", lineHeight: "24px" };
const box = {
  backgroundColor: "#f4f0ff",
  borderRadius: "10px",
  padding: "16px 18px",
  margin: "20px 0",
};
const boxLine = { color: "#26106c", fontSize: "15px", lineHeight: "24px", margin: "4px 0" };
const button = {
  backgroundColor: "#884bc7",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  padding: "14px 28px",
  textDecoration: "none",
};
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px" };
