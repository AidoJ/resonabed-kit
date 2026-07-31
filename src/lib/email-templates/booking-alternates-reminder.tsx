import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  orgName?: string
  clientName?: string
  expiresLabel?: string
  contactEmail?: string
}

const Email = ({
  orgName = 'Your clinic',
  clientName = 'there',
  expiresLabel = '',
  contactEmail = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A reminder about the times {orgName} suggested</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Still holding those times</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          {orgName} suggested a few alternative times for your session and hasn&rsquo;t heard
          back yet. The original email has the link to choose one.
        </Text>
        {expiresLabel ? (
          <Text style={text}>They&rsquo;re held until {expiresLabel}.</Text>
        ) : null}
        <Text style={muted}>
          If none of them suit, no problem — just make a fresh request, or get in touch.
          {contactEmail ? ` You can reply to ${contactEmail}.` : ''}
        </Text>
        <Text style={muted}>{orgName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d.orgName ?? 'Your clinic'} — a reminder about your session times`,
  displayName: 'Booking: alternate times reminder',
  previewData: {
    orgName: 'Spiral Light Healing',
    clientName: 'Sam',
    expiresLabel: 'Wednesday, 5 August 9:00 am (AEST)',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', color: '#26106c', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#2b2b34' }
const muted = { fontSize: '13px', lineHeight: '20px', color: '#6b6880' }
