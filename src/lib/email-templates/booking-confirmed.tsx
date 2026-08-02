import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface BookingConfirmedProps {
  orgName?: string
  clientName?: string
  serviceName?: string
  whenLabel?: string
  address?: string
  isHomeBased?: boolean
  contactPhone?: string
  contactEmail?: string
  practitionerName?: string
  rescheduled?: boolean
}


/**
 * ADDRESS DISCLOSURE POINT.
 *
 * This is the only message in the public-booking flow that carries the
 * clinic's full street address, and it is only sent after the operator has
 * actively confirmed the request. Nothing in the pending/request path may
 * include the address.
 */
const BookingConfirmedEmail = ({
  orgName = 'your clinic',
  clientName = 'there',
  serviceName = 'your session',
  whenLabel = '',
  address = '',
  isHomeBased = false,
  contactPhone = '',
  contactEmail = '',
}: BookingConfirmedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your booking with {orgName} is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your booking is confirmed</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          <strong>{orgName}</strong> has confirmed your booking. Here are the details.
        </Text>

        <Section style={panel}>
          <Text style={row}>
            <strong>Session:</strong> {serviceName}
          </Text>
          {whenLabel ? (
            <Text style={row}>
              <strong>When:</strong> {whenLabel}
            </Text>
          ) : null}
          {address ? (
            <Text style={row}>
              <strong>Where:</strong> {address}
            </Text>
          ) : null}
        </Section>

        {!address ? (
          <Text style={note}>
            {orgName} will confirm the exact location with you before your appointment.
          </Text>
        ) : null}

        {address && isHomeBased ? (
          <Text style={note}>
            This is a home-based studio. Please keep this address private and use it only for
            your appointment.
          </Text>
        ) : null}

        {contactPhone || contactEmail ? (
          <Text style={text}>
            Need to change or cancel? Contact {orgName}
            {contactPhone ? ` on ${contactPhone}` : ''}
            {contactEmail ? ` or at ${contactEmail}` : ''}.
          </Text>
        ) : null}

        <Hr style={{ borderColor: '#eeeeee', margin: '24px 0' }} />
        <Text style={footer}>
          Vibroacoustic sessions are provided for relaxation and general wellbeing. They are not a
          medical treatment. ResonaBed · info@resonabed.com
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Helvetica, Arial, sans-serif' }
const container = { margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#26106c', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#333333', margin: '0 0 14px' }
const panel = {
  backgroundColor: '#f6f4fb',
  borderRadius: '10px',
  padding: '16px 18px',
  margin: '18px 0',
}
const row = { fontSize: '15px', lineHeight: '24px', color: '#26106c', margin: '0 0 6px' }
const note = { fontSize: '13px', lineHeight: '21px', color: '#5b5b5b', margin: '0 0 14px' }
const footer = { fontSize: '12px', lineHeight: '18px', color: '#8a8a8a' }

export const template = {
  component: BookingConfirmedEmail,
  subject: (data: Record<string, unknown>) =>
    `Booking confirmed, ${(data.orgName as string) ?? 'your clinic'}`,
  displayName: 'Booking confirmed (client, includes address)',
  previewData: {
    orgName: 'Spiral Light Wellness',
    clientName: 'Alex',
    serviceName: '45 minute vibroacoustic session',
    whenLabel: 'Tue 4 Aug, 10:00 am (AEST)',
    address: '12 Quiet Street, Noosaville QLD 4566',
    isHomeBased: true,
    contactPhone: '07 1234 5678',
    contactEmail: 'hello@spirallight.com.au',
  },
}

export default BookingConfirmedEmail
