import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  orgName?: string
  clientName?: string
  serviceName?: string
  slots?: string[]
  chooseUrl?: string
  expiresLabel?: string
  note?: string
  contactEmail?: string
  contactPhone?: string
}

const Email = ({
  orgName = 'Your clinic',
  clientName = 'there',
  serviceName = 'your session',
  slots = [],
  chooseUrl = '#',
  expiresLabel = '',
  note = '',
  contactEmail = '',
  contactPhone = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{orgName} has suggested some alternative times</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>A few other times that work</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Thanks for your request with {orgName}. The time you asked for isn&rsquo;t available,
          but these are:
        </Text>

        <Section style={card}>
          {slots.map((s) => (
            <Text key={s} style={slot}>
              {s}
            </Text>
          ))}
          <Text style={muted}>{serviceName}</Text>
        </Section>

        {note ? <Text style={text}>{note}</Text> : null}

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={chooseUrl} style={button}>
            Choose a time
          </Button>
        </Section>

        {expiresLabel ? (
          <Text style={muted}>
            These times are held for you until {expiresLabel}. After that they&rsquo;re released
            and you&rsquo;re welcome to make a fresh request.
          </Text>
        ) : null}

        <Hr style={hr} />
        <Text style={muted}>
          If none of these suit, choose &ldquo;None of these work&rdquo; on that page and the
          clinic will be in touch.
          {contactPhone ? ` You can also call ${contactPhone}.` : ''}
          {contactEmail ? ` Or reply to ${contactEmail}.` : ''}
        </Text>
        <Text style={muted}>{orgName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d.orgName ?? 'Your clinic'} — a few other times for your session`,
  displayName: 'Booking: alternate times offered',
  previewData: {
    orgName: 'Spiral Light Healing',
    clientName: 'Sam',
    serviceName: '45 minute session',
    slots: ['Tuesday, 4 August 10:00 am (AEST)', 'Thursday, 6 August 1:30 pm (AEST)'],
    chooseUrl: 'https://resonabed.com/offer/example',
    expiresLabel: 'Wednesday, 5 August 9:00 am (AEST)',
    contactPhone: '0400 000 000',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', color: '#26106c', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#2b2b34' }
const card = {
  border: '1px solid #e6e2f2',
  borderRadius: '10px',
  padding: '16px 18px',
  backgroundColor: '#faf8ff',
}
const slot = { fontSize: '16px', fontWeight: 600, color: '#26106c', margin: '0 0 8px' }
const muted = { fontSize: '13px', lineHeight: '20px', color: '#6b6880' }
const button = {
  backgroundColor: '#884bc7',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 22px',
  fontSize: '15px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eceaf4', margin: '24px 0 16px' }
