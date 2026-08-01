import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  businessName?: string;
}

const Email = ({ recipientName, businessName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Resonabed clinic account is being set up</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your clinic account is being set up</Heading>
        <Text style={text}>{recipientName ? `Hi ${recipientName},` : "Hi there,"}</Text>
        <Text style={text}>
          Thanks for your order{businessName ? ` for ${businessName}` : ""}. Your payment is
          confirmed and we are setting up your clinic account now.
        </Text>
        <Text style={text}>
          We set each clinic up by hand so your public web address, ABN and clinic type (home-based
          or retail premises) are correct from day one. Clinic type controls whether your street
          address is ever shown publicly, so we never guess it.
        </Text>
        <Text style={text}>
          You will receive a second email with your login details and a temporary password, usually
          within one business day. There is nothing you need to do in the meantime.
        </Text>
        <Text style={muted}>
          Questions about your order? Just reply to this email and we will help.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your Resonabed clinic account is being set up",
  displayName: "Clinic order received",
  previewData: {
    recipientName: "Alex",
    businessName: "Spiral Light Healing",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px" };
const h1 = {
  color: "#26106c",
  fontSize: "22px",
  fontWeight: 600 as const,
  margin: "0 0 20px",
};
const text = { color: "#333333", fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" };
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px", margin: "24px 0 0" };
