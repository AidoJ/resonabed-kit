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

interface BookingDeclinedProps {
  orgName?: string
  clientName?: string
  contactEmail?: string
  contactPhone?: string
}

/**
 * Deliberately neutral and content-free.
 *
 * No address, no service name, no time, no reason, and nothing health
 * related. A decline must never disclose anything, and must never hint at
 * why — the reason lives only in the org's audit trail.
 */
const BookingDeclinedEmail = ({
  orgName = 'the clinic',
  clientName = 'there',
  contactEmail = '',
  contactPhone = '',
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
          {(contactEmail || contactPhone) && (
            <>
              <Hr style={{ borderColor: '#eee', margin: '24px 0' }} />
              <Text style={{ fontSize: '14px', lineHeight: '22px', color: '#555' }}>
                If you&rsquo;d like to talk it through, you can reach us
                {contactPhone ? ` on ${contactPhone}` : ''}
                {contactPhone && contactEmail ? ' or' : ''}
                {contactEmail ? ` at ${contactEmail}` : ''}.
              </Text>
            </>
          )}
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
    contactEmail: 'hello@example.com',
    contactPhone: '0400 000 000',
  },
}

export default BookingDeclinedEmail
