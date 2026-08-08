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
  name: string;
  email: string;
  phone?: string;
  message: string;
}

const Email = ({ name, email, phone, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New contact form submission from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact form submission</Heading>
        <Text style={text}>
          <strong>Name:</strong> {name}
        </Text>
        <Text style={text}>
          <strong>Email:</strong>{" "}
          <a href={`mailto:${email}`} style={link}>
            {email}
          </a>
        </Text>
        {phone ? (
          <Text style={text}>
            <strong>Phone:</strong> {phone}
          </Text>
        ) : null}
        <Text style={text}>
          <strong>Message:</strong>
        </Text>
        <Text style={{ ...text, whiteSpace: "pre-wrap" }}>{message}</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Contact form: ${data.name}`,
  displayName: "Contact form submission",
  to: "info@resonabed.com",
  previewData: {
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "0494 825 281",
    message: "I would like to know more about the Platinum package for my clinic.",
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
const link = { color: "#26106c", textDecoration: "underline" };
