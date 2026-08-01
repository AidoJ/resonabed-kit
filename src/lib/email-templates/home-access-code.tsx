import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  code?: string;
  signupUrl?: string;
  isResend?: boolean;
}

const Email = ({ recipientName, code, signupUrl, isResend }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {isResend ? "Your replacement Resonabed access code" : "Your Resonabed access code"}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {isResend ? "Your replacement access code" : "Your Resonabed access code"}
        </Heading>
        <Text style={text}>{recipientName ? `Hi ${recipientName},` : "Hi there,"}</Text>
        <Text style={text}>
          {isResend
            ? "Here is your new access code. Any earlier code is no longer valid."
            : "Thanks for your order. Use the code below to set up your personal Resonabed app."}
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code ?? "RB-XXXX-XXXX"}</Text>
        </Section>
        <Text style={text}>
          Set up your account at{" "}
          <Link href={signupUrl ?? "https://resonabed.com/home/signup"} style={link}>
            {signupUrl ?? "https://resonabed.com/home/signup"}
          </Link>
          . The code works once, and your account then stays with you for good.
        </Text>
        <Text style={muted}>
          Use the same email address this message was sent to. If it needs correcting, reply to this
          email and we will reissue your code.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your Resonabed access code",
  displayName: "Home access code",
  previewData: {
    recipientName: "Alex",
    code: "RB-K4TQ-9WRM",
    signupUrl: "https://resonabed.com/home/signup",
    isResend: false,
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", fontWeight: 400, color: "#26106c", margin: "0 0 20px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333" };
const muted = { fontSize: "13px", lineHeight: "20px", color: "#6b7280", marginTop: "24px" };
const link = { color: "#884bc7" };
const codeBox = {
  backgroundColor: "#f5f2fb",
  borderRadius: "12px",
  padding: "18px",
  textAlign: "center" as const,
  margin: "24px 0",
};
const codeText = {
  fontSize: "28px",
  letterSpacing: "3px",
  fontWeight: 700,
  color: "#26106c",
  margin: 0,
};
