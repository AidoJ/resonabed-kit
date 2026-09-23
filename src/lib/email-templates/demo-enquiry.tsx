import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface DemoEnquiryProps {
  reference?: string;
  name?: string;
  email?: string;
  practice?: string;
  suburb?: string;
  phone?: string;
  attribution?: string;
}

const DemoEnquiryEmail = ({
  reference = "RB-EXAMPLE1",
  name = "Jane Smith",
  email = "jane@example.com",
  practice = "Example Wellness",
  suburb = "Brisbane",
  phone,
  attribution,
}: DemoEnquiryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New ResonaBed demo enquiry from {practice}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>New demo enquiry</Heading>
        <Text style={referenceStyle}>Reference: {reference}</Text>
        <Section style={details}>
          <Text style={row}><strong>Name:</strong> {name}</Text>
          <Text style={row}><strong>Email:</strong> {email}</Text>
          <Text style={row}><strong>Practice:</strong> {practice}</Text>
          <Text style={row}><strong>Suburb / city:</strong> {suburb}</Text>
          {phone ? <Text style={row}><strong>Phone:</strong> {phone}</Text> : null}
          {attribution ? <Text style={row}><strong>Attribution:</strong> {attribution}</Text> : null}
        </Section>
        <Text style={footer}>This enquiry was saved securely in ResonaBed.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: DemoEnquiryEmail,
  subject: (data: Record<string, unknown>) =>
    `New ResonaBed demo enquiry, ${(data.practice as string) || "new practice"}`,
  displayName: "Demo enquiry notification",
  to: "info@resonabed.com",
  previewData: {
    reference: "RB-EXAMPLE1",
    name: "Jane Smith",
    email: "jane@example.com",
    practice: "Example Wellness",
    suburb: "Brisbane",
    phone: "0400 000 000",
    attribution: "google / paid / clinic-demo",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px" };
const heading = { color: "#26106c", fontSize: "24px", fontWeight: 600, margin: "0 0 8px" };
const referenceStyle = { color: "#6b6580", fontSize: "13px", margin: "0 0 24px" };
const details = { borderTop: "1px solid #ece7f2", paddingTop: "18px" };
const row = { color: "#333333", fontSize: "15px", lineHeight: "23px", margin: "0 0 10px" };
const footer = { color: "#777077", fontSize: "12px", lineHeight: "18px", marginTop: "26px" };
