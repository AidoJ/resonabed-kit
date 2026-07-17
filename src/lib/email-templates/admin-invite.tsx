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
import type { TemplateEntry } from './registry'

interface AdminInviteProps {
  recipientName?: string
  orgName?: string
  email?: string
  tempPassword?: string
  loginUrl?: string
  isReset?: boolean
}

const AdminInviteEmail = ({
  recipientName,
  orgName = 'your clinic',
  email = '',
  tempPassword = '',
  loginUrl = 'https://resonabed.com',
  isReset = false,
}: AdminInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {isReset
        ? `Your ResonaBed password has been reset`
        : `Welcome to ResonaBed — your ${orgName} admin account`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {isReset ? 'Your password has been reset' : 'Welcome to ResonaBed'}
        </Heading>
        <Text style={text}>
          Hi{recipientName ? ` ${recipientName}` : ''},
        </Text>
        <Text style={text}>
          {isReset
            ? `A new temporary password has been issued for your ResonaBed admin account for `
            : `An organisation admin account has been created for you on ResonaBed for `}
          <strong>{orgName}</strong>. Sign in below with the temporary password and
          you'll be asked to set a new one straight away.
        </Text>

        <Section style={credBox}>
          <Text style={credLabel}>Email</Text>
          <Text style={credValue}>{email}</Text>
          <Text style={credLabel}>Temporary password</Text>
          <Text style={credValueMono}>{tempPassword}</Text>
        </Section>

        <Text style={text}>
          Sign in at{' '}
          <a href={loginUrl} style={link}>
            {loginUrl}
          </a>
          .
        </Text>

        <Text style={footer}>
          For your security, please change this password on first sign-in. If you
          weren't expecting this email, contact us at info@resonabed.com.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminInviteEmail,
  subject: (data: Record<string, unknown>) =>
    (data as AdminInviteProps).isReset
      ? 'Your ResonaBed password has been reset'
      : `Welcome to ResonaBed — ${(data as AdminInviteProps).orgName ?? 'your clinic'}`,
  displayName: 'Admin invite / password reset',
  previewData: {
    recipientName: 'Alex',
    orgName: 'Sound Wellness Clinic',
    email: 'alex@example.com',
    tempPassword: 'Xk7$aB9!qLmN2pQrS3wZ',
    loginUrl: 'https://resonabed.com',
    isReset: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#26106c',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#3f3f46',
  lineHeight: '1.55',
  margin: '0 0 16px',
}
const credBox = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px 18px',
  margin: '16px 0 24px',
  backgroundColor: '#faf9ff',
}
const credLabel = {
  fontSize: '11px',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  margin: '4px 0 2px',
}
const credValue = {
  fontSize: '14px',
  color: '#111827',
  margin: '0 0 8px',
  fontWeight: 600 as const,
}
const credValueMono = {
  fontSize: '15px',
  color: '#26106c',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  margin: '0 0 4px',
  fontWeight: 700 as const,
  letterSpacing: '0.02em',
}
const link = { color: '#884bc7', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '24px 0 0' }

export default AdminInviteEmail
