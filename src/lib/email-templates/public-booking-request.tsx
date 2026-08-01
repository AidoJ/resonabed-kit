import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface PublicBookingRequestProps {
  orgName?: string
  loginUrl?: string
}

/**
 * Operator nudge only. Deliberately contains NO client PII, no name, email,
 * phone, requested time, or note. Staff sign in to see the request.
 */
const PublicBookingRequestEmail = ({
  orgName = 'your clinic',
  loginUrl = 'https://resonabed.com/bookings',
}: PublicBookingRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A new booking request is waiting in ResonaBed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New booking request</Heading>
        <Text style={text}>
          Someone has submitted a booking request through the public page for{' '}
          <strong>{orgName}</strong>.
        </Text>
        <Text style={text}>
          The request is pending and has not been confirmed. Sign in to review the details
          and confirm or decline it.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <a href={loginUrl} style={button}>
            Log in to view the request
          </a>
        </Section>
        <Text style={footer}>
          For privacy, request details are never included in this email. ResonaBed ·
          info@resonabed.com
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Helvetica, Arial, sans-serif' }
const container = { margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#26106c', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#333333', margin: '0 0 14px' }
const button = {
  backgroundColor: '#26106c',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 22px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', lineHeight: '18px', color: '#8a8a8a', marginTop: '28px' }

export const template = {
  component: PublicBookingRequestEmail,
  subject: (data: Record<string, unknown>) =>
    `New booking request, ${(data.orgName as string) ?? 'your clinic'}`,
  displayName: 'Public booking request (operator nudge)',
  previewData: { orgName: 'Spiral Light Wellness', loginUrl: 'https://resonabed.com/bookings' },
}

export default PublicBookingRequestEmail
