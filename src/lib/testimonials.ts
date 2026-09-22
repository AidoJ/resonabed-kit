export type Testimonial = {
  quote: string;
  name: string;
  /** Optional context line, e.g. role, suburb or package. */
  context?: string;
};

/**
 * Real, approved testimonials only — never placeholders or invented quotes.
 * Add approved quotes here and the sections render them automatically.
 */
export const THERAPIST_TESTIMONIALS: Testimonial[] = [];

export const CLIENT_TESTIMONIALS: Testimonial[] = [];
