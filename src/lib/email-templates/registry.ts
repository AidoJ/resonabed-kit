import type { ComponentType } from 'react'
import { template as adminInviteTemplate } from './admin-invite'
import { template as publicBookingRequestTemplate } from './public-booking-request'
import { template as bookingConfirmedTemplate } from './booking-confirmed'
import { template as bookingDeclinedTemplate } from './booking-declined'
import { template as bookingAlternatesOfferedTemplate } from './booking-alternates-offered'
import { template as bookingAlternatesReminderTemplate } from './booking-alternates-reminder'
import { template as homeAccessCodeTemplate } from './home-access-code'
import { template as clinicOrderReceivedTemplate } from './clinic-order-received'
import { template as contactFormTemplate } from './contact-form'
import { template as orderDepositReceivedTemplate } from './order-deposit-received'
import { template as orderBalanceReminderTemplate } from './order-balance-reminder'
import {
  planPaymentFailed,
  planPaymentRetry,
  planPaymentFinalNotice,
  planFinalWarning,
  planAccessSuspended,
  planRestored,
  planCardExpiring,
} from './plan-dunning'



export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient, overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-invite': adminInviteTemplate,
  'public-booking-request': publicBookingRequestTemplate,
  'booking-confirmed': bookingConfirmedTemplate,
  'booking-declined': bookingDeclinedTemplate,
  'booking-alternates-offered': bookingAlternatesOfferedTemplate,
  'booking-alternates-reminder': bookingAlternatesReminderTemplate,
  'home-access-code': homeAccessCodeTemplate,
  'clinic-order-received': clinicOrderReceivedTemplate,
  'contact-form': contactFormTemplate,
  'order-deposit-received': orderDepositReceivedTemplate,
  'order-balance-reminder': orderBalanceReminderTemplate,
}


