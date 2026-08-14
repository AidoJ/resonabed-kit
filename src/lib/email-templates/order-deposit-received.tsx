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

interface Props {
  recipientName?: string | null;
  orderNumber?: string;
  packageLabel?: string;
  balanceUrl?: string;
  balanceAmount?: number;
  planDepositBalance?: number | null;
  planMonthly?: number | null;
  planMonths?: number | null;
  expiresAt?: string | null;
}

const money = (cents?: number | null) =>
  typeof cents === "number" ? `$${(cents / 100).toLocaleString("en-AU")}` : "";

const Email = ({
  recipientName,
  orderNumber,
  packageLabel,
  balanceUrl,
  balanceAmount,
  planDepositBalance,
  planMonthly,
  planMonths,
  expiresAt,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Resonabed order is secured. Choose how to pay the balance.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your order is secured</Heading>
        <Text style={text}>{recipientName ? `Hi ${recipientName},` : "Hi there,"}</Text>
        <Text style={text}>
          Thank you. We have received your $100 order deposit and shipping for order{" "}
          <strong>{orderNumber}</strong>, {packageLabel}. Your order is now held for you.
        </Text>
        <Text style={text}>
          Nothing ships yet. Your kit is built and dispatched once the balance is settled, and you
          can choose either way below.
        </Text>
        <Section style={box}>
          <Text style={boxLine}>
            <strong>Pay the balance in full:</strong> {money(balanceAmount)}
          </Text>
          {planMonthly ? (
            <Text style={boxLine}>
              <strong>Or start a payment plan:</strong> {money(planDepositBalance)} now, then{" "}
              {planMonths ?? 10} monthly payments of {money(planMonthly)}
            </Text>
          ) : null}
        </Section>
        <Section style={{ textAlign: "center", margin: "28px 0" }}>
          <Button style={button} href={balanceUrl}>
            Choose how to pay
          </Button>
        </Section>
        <Text style={muted}>
          This link is private to your order, please do not forward it. Your deposit holds your
          order until {expiresAt ? new Date(expiresAt).toLocaleDateString("en-AU") : "30 days"}. If
          you decide not to go ahead before then, reply to this email and we will refund your
          deposit and shipping in full.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your Resonabed order is secured, choose how to pay the balance",
  displayName: "Order deposit received",
  previewData: {
    recipientName: "Sam",
    orderNumber: "ORD-00001",
    packageLabel: "Resonabed Pro",
    balanceUrl: "https://resonabed.com/order/balance/example",
    balanceAmount: 129900,
    planDepositBalance: 29900,
    planMonthly: 11000,
    planMonths: 10,
    expiresAt: new Date().toISOString(),
  },
};

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
