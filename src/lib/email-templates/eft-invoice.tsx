import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { eftInvoiceSubject, type EftInvoiceEmailData } from "../eft-invoice-email";

type Props = Partial<EftInvoiceEmailData>;

const aud = (cents?: number | null) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format((cents ?? 0) / 100);

const day = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Australia/Brisbane",
      })
    : "";

const Email = (p: Props) => {
  const isDeposit = p.stage !== "balance";
  const name = p.recipientName?.trim();
  const seller = p.seller ?? { name: "Resonabed", abn: "", address: "", email: "" };
  const bank = p.bank ?? { accountName: "", bankName: "", bsb: "", accountNumber: "" };
  const buyer = p.buyer;
  const shipping = p.shippingCents ?? 0;

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {`Tax invoice ${p.invoiceNumber ?? ""}: ${aud(p.amountDueCents)} due by bank transfer, reference ${p.reference ?? p.invoiceNumber ?? ""}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {p.copyOfEmailTo ? (
            <Section style={copyBanner}>
              <Text style={copyText}>Copy for Resonabed. This email was sent to {p.copyOfEmailTo}.</Text>
            </Section>
          ) : null}

          <Text style={brand}>Resonabed</Text>
          <Heading style={h1}>
            {isDeposit ? "Your order deposit invoice" : "Your balance invoice"}
          </Heading>
          <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
          {isDeposit ? (
            <Text style={text}>
              Thank you for your order <strong>{p.orderNumber}</strong>, {p.packageLabel}. Your tax
              invoice for the order deposit is below, with the bank details to pay it.
            </Text>
          ) : (
            <Text style={text}>
              Your tax invoice for the balance of order <strong>{p.orderNumber}</strong>,{" "}
              {p.packageLabel}, is below, with the bank details to pay it.
            </Text>
          )}

          <Section style={dueBox}>
            <Text style={dueLabel}>Amount due now</Text>
            <Text style={dueAmount}>{aud(p.amountDueCents)}</Text>
            <Text style={dueSub}>
              AUD incl. GST{p.dueDate ? `, due by ${day(p.dueDate)}` : ""}
            </Text>
          </Section>

          <Section style={bankBox}>
            <Text style={sectionTitle}>Pay by bank transfer</Text>
            <KeyValue label="Account name" value={bank.accountName} />
            <KeyValue label="Bank" value={bank.bankName} />
            <KeyValue label="BSB" value={bank.bsb} />
            <KeyValue label="Account number" value={bank.accountNumber} />
            <KeyValue label="Payment reference" value={p.reference ?? p.invoiceNumber ?? ""} strong />
            <Text style={small}>
              Please use the invoice number as your payment reference so we can match your payment.
            </Text>
          </Section>

          {isDeposit ? (
            <>
              <Text style={text}>
                <strong>Your deposit holds your order for 30 days and is refundable.</strong> The 30
                days start when your deposit is received. If you decide not to go ahead within that
                time, email info@resonabed.com and we will refund your deposit in full.
              </Text>
              <Text style={text}>
                {p.pickup
                  ? "You chose pickup, so no shipping is added to your balance."
                  : `Shipping is quoted and added to your balance: ${aud(shipping)}${p.shippingLabel ? ` (${p.shippingLabel})` : ""}. It is not charged on this deposit.`}
              </Text>
              <Text style={text}>
                Nothing ships on the deposit. Once it clears, we will email you to settle the
                balance of {aud((p.balanceCents ?? 0) + shipping)}
                {shipping > 0 ? " including shipping" : ""}.
              </Text>
            </>
          ) : (
            <>
              <Text style={text}>
                <strong>Your deposit holds your order
                {p.expiresAt ? ` until ${day(p.expiresAt)}` : " for 30 days"} and is refundable.</strong>{" "}
                If you decide not to go ahead before then, email info@resonabed.com and we will
                refund your deposit in full.
              </Text>
              <Text style={text}>
                {p.pickup || shipping === 0
                  ? "You chose pickup, so no shipping is added to your balance."
                  : `Shipping of ${aud(shipping)}${p.shippingLabel ? ` (${p.shippingLabel})` : ""} was quoted with your deposit and is added to this balance invoice.`}
              </Text>
              <Text style={text}>Your kit is released once this invoice clears.</Text>
            </>
          )}

          <Section style={{ textAlign: "center", margin: "26px 0 30px" }}>
            <Button style={button} href={p.orderUrl}>
              View your order
            </Button>
          </Section>

          {/* ---------------------------------------------------- tax invoice */}
          <Section style={invoiceBox}>
            <Row>
              <Column style={{ verticalAlign: "top" }}>
                <Text style={sellerName}>{seller.name}</Text>
                {seller.abn ? <Text style={sellerLine}>ABN {seller.abn}</Text> : null}
                {seller.address ? <Text style={sellerLine}>{seller.address}</Text> : null}
                {seller.email ? <Text style={sellerLine}>{seller.email}</Text> : null}
              </Column>
              <Column style={{ verticalAlign: "top", textAlign: "right" }}>
                <Text style={invoiceTitle}>TAX INVOICE</Text>
                <Text style={invoiceNumber}>{p.invoiceNumber}</Text>
              </Column>
            </Row>

            <Hr style={ruleStrong} />

            <Row>
              <Column style={{ verticalAlign: "top", width: "50%", paddingRight: "10px" }}>
                <Text style={panelTitle}>Bill to</Text>
                <Text style={buyerName}>{buyer?.name}</Text>
                {buyer?.attention ? <Text style={detail}>Attn: {buyer.attention}</Text> : null}
                {buyer?.abn ? <Text style={detail}>ABN {buyer.abn}</Text> : null}
                {buyer?.email ? <Text style={detail}>{buyer.email}</Text> : null}
                {buyer?.phone ? <Text style={detail}>{buyer.phone}</Text> : null}
              </Column>
              <Column style={{ verticalAlign: "top", width: "50%", paddingLeft: "10px" }}>
                <Text style={panelTitle}>{buyer?.shipTo ? "Ship to" : "Delivery"}</Text>
                <Text style={detail}>{buyer?.shipTo ?? "Pickup"}</Text>
              </Column>
            </Row>

            <Hr style={rule} />
            <KeyValue label="Invoice number" value={p.invoiceNumber ?? ""} />
            <KeyValue label="Issue date" value={day(p.issueDate)} />
            {p.dueDate ? <KeyValue label="Payment due" value={day(p.dueDate)} /> : null}
            <KeyValue label="Order number" value={p.orderNumber ?? ""} />
            <KeyValue label="Payment method" value="Bank transfer (EFT)" />
            <Hr style={rule} />

            <Row style={tableHead}>
              <Column style={thCell}>Description</Column>
              <Column style={{ ...thCell, textAlign: "right", width: "130px" }}>Amount (AUD)</Column>
            </Row>
            {(p.lines ?? []).map((line) => (
              <Row key={line.label} style={tableRow}>
                <Column style={tdCell}>
                  <Text style={lineLabel}>{line.label}</Text>
                  {line.note ? <Text style={lineNote}>{line.note}</Text> : null}
                </Column>
                <Column style={{ ...tdCell, textAlign: "right", width: "130px" }}>
                  <Text style={lineAmount}>{aud(line.amountCents)}</Text>
                </Column>
              </Row>
            ))}

            <Section style={{ marginTop: "12px" }}>
              <KeyValue label="Subtotal (ex GST)" value={aud(p.subtotalExGstCents)} />
              <KeyValue label="GST included" value={aud(p.gstCents)} />
              <KeyValue label="Total (incl. GST)" value={aud(p.totalCents)} strong />
              <KeyValue label="Amount due now" value={aud(p.amountDueCents)} strong />
            </Section>

            <Section style={payPanel}>
              <Text style={panelTitle}>Payment by bank transfer</Text>
              <Text style={detail}>Account name: {bank.accountName}</Text>
              <Text style={detail}>Bank: {bank.bankName}</Text>
              <Text style={detail}>BSB: {bank.bsb}</Text>
              <Text style={detail}>Account number: {bank.accountNumber}</Text>
              <Text style={detail}>Reference: {p.reference ?? p.invoiceNumber}</Text>
            </Section>
          </Section>

          <Text style={muted}>
            The link above is private to your order, please do not forward it. Questions? Email
            info@resonabed.com or reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

function KeyValue({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row>
      <Column style={kvLabel}>{label}</Column>
      <Column style={{ ...kvValue, fontWeight: strong ? 700 : 400 }}>{value || "Not set"}</Column>
    </Row>
  );
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => eftInvoiceSubject(String(data.invoiceNumber ?? "")),
  displayName: "Bank transfer tax invoice",
  previewData: {
    stage: "deposit",
    recipientName: "Sam",
    invoiceNumber: "INV-01008",
    orderNumber: "BA00004",
    packageLabel: "Resonabed Basic",
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    seller: { name: "Resonabed", abn: "12 345 678 901", address: "Scarborough QLD", email: "info@resonabed.com" },
    buyer: { name: "Sam Example", attention: null, abn: null, email: "sam@example.com", phone: null, shipTo: "1 Example St\nBrisbane QLD 4000\nAU" },
    lines: [{ label: "Resonabed Basic, order deposit", note: "Deposit towards the $1,399.00 package price.", amountCents: 10000 }],
    subtotalExGstCents: 9091,
    gstCents: 909,
    totalCents: 10000,
    amountDueCents: 10000,
    reference: "INV-01008",
    bank: { accountName: "Example Pty Ltd", bankName: "Example Bank", bsb: "000-000", accountNumber: "00000000" },
    shippingCents: 9900,
    shippingLabel: "Standard delivery",
    pickup: false,
    balanceCents: 129900,
    depositCents: 10000,
    expiresAt: null,
    orderUrl: "https://resonabed.com/order/balance/example",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { margin: "0 auto", padding: "28px 24px", maxWidth: "600px" };
const brand = { color: "#884bc7", fontSize: "13px", letterSpacing: "0.14em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: 700 };
const h1 = { color: "#26106c", fontSize: "24px", margin: "0 0 16px" };
const text = { color: "#1f2937", fontSize: "15px", lineHeight: "24px", margin: "0 0 14px" };
const small = { color: "#4b5563", fontSize: "13px", lineHeight: "20px", margin: "10px 0 0" };
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px", marginTop: "24px" };
const copyBanner = { backgroundColor: "#fff7e6", border: "1px solid #f3d38a", borderRadius: "8px", padding: "8px 14px", marginBottom: "18px" };
const copyText = { color: "#7a5300", fontSize: "13px", margin: 0 };
const dueBox = { backgroundColor: "#26106c", borderRadius: "12px", padding: "18px 20px", margin: "20px 0 14px", textAlign: "center" as const };
const dueLabel = { color: "#d9ccff", fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: 0 };
const dueAmount = { color: "#ffffff", fontSize: "32px", fontWeight: 700, margin: "6px 0 2px" };
const dueSub = { color: "#d9ccff", fontSize: "13px", margin: 0 };
const bankBox = { backgroundColor: "#f4f0ff", borderLeft: "4px solid #884bc7", borderRadius: "8px", padding: "14px 18px", margin: "0 0 20px" };
const sectionTitle = { color: "#26106c", fontSize: "14px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 8px" };
const kvLabel = { color: "#4b5563", fontSize: "14px", padding: "3px 0" };
const kvValue = { color: "#111827", fontSize: "14px", padding: "3px 0", textAlign: "right" as const };
const button = { backgroundColor: "#884bc7", borderRadius: "8px", color: "#ffffff", fontSize: "16px", padding: "14px 28px", textDecoration: "none" };
const invoiceBox = { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px 20px 16px" };
const sellerName = { color: "#111827", fontSize: "14px", fontWeight: 700, margin: 0 };
const sellerLine = { color: "#6b7280", fontSize: "12px", lineHeight: "18px", margin: 0, whiteSpace: "pre-line" as const };
const invoiceTitle = { color: "#26106c", fontSize: "20px", fontWeight: 700, margin: 0, letterSpacing: "0.04em" };
const invoiceNumber = { color: "#884bc7", fontSize: "14px", fontWeight: 700, margin: "4px 0 0" };
const ruleStrong = { borderTop: "3px solid #26106c", margin: "16px 0" };
const rule = { borderTop: "1px solid #e5e7eb", margin: "14px 0" };
const panelTitle = { color: "#26106c", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: "0 0 6px" };
const buyerName = { color: "#111827", fontSize: "14px", fontWeight: 700, margin: "0 0 2px" };
const detail = { color: "#374151", fontSize: "13px", lineHeight: "19px", margin: 0, whiteSpace: "pre-line" as const };
const tableHead = { backgroundColor: "#26106c" };
const thCell = { color: "#ffffff", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, padding: "8px 10px" };
const tableRow = { borderBottom: "1px solid #e5e7eb" };
const tdCell = { padding: "10px", verticalAlign: "top" as const };
const lineLabel = { color: "#111827", fontSize: "14px", fontWeight: 700, margin: 0 };
const lineNote = { color: "#6b7280", fontSize: "12px", lineHeight: "18px", margin: "2px 0 0" };
const lineAmount = { color: "#111827", fontSize: "14px", margin: 0 };
const payPanel = { backgroundColor: "#f4f0ff", borderRadius: "8px", padding: "12px 14px", marginTop: "16px" };
