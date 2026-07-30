import type { ComponentType } from 'react'
import { template as adminInviteTemplate } from './admin-invite'
import { template as publicBookingRequestTemplate } from './public-booking-request'
import { template as bookingConfirmedTemplate } from './booking-confirmed'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-invite': adminInviteTemplate,
  'public-booking-request': publicBookingRequestTemplate,
}

