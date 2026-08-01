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

interface BookingDeclinedProps {
  orgName?: string
  clientName?: string
}

/**
 * Deliberately neutral and content-free.
 *
 * No address, no service name, no time, no reason, and nothing health
 * related. A decline must never disclose anything, and must never hint at
 * why, the reason lives only in the org's audit trail.
 *
 * It also carries NO invitation to make contact. A decline is sometimes a soft
 * no to someone the operator deliberately vetted out; the email must not push
 * that person to ring or email them.
 */
const BookingDeclinedEmail = ({
  orgName = 'the clinic',
  clientName = 'there',
}: BookingDeclinedProps) => (
  <Html>
    <Head />
    <Preview>About your booking request</Preview>
    <Body style={{ backgroundColor: '#f6f5fb', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <Container style={{ margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }}>
        <Section
          style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px' }}
        >
          <Heading style={{ fontSize: '20px', color: '#26106c', margin: '0 0 16px' }}>
            About your booking request
          </Heading>
          <Text style={{ fontSize: '15px', lineHeight: '24px', color: '#333' }}>
            Hi {clientName},
          </Text>
          <Text style={{ fontSize: '15px', lineHeight: '24px', color: '#333' }}>
            Thank you for your interest in {orgName}. Unfortunately this request
            couldn&rsquo;t be accommodated.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingDeclinedEmail,
  subject: 'About your booking request',
  displayName: 'Booking request declined',
  previewData: {
    orgName: 'Spiral Light Healing',
    clientName: 'Sam',
  },
}

export default BookingDeclinedEmail
