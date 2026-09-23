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
export const THERAPIST_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I started using my Resonabed VAT setup after I had my table upgraded using the Pro Kit. It was quick and easy to fit and I was up and running using the app within a couple of hours. It's easy to use as a standalone service and I also add it to my Bowen and Reiki services as an addition to my treatments. My clients just love it and I get on there regularly myself too :)",
    name: "Clare L.",
    context: "09/08/2026",
  },
];

export const CLIENT_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "The resonabed experience is unlike anything else I have tried. There is something very grounding about 'feeling' the sound. I noticed my entire body fully relaxing within a short period of time and the time passed so quickly - I could have stayed there for hours! I felt a deep, almost cellular, level of calm once it was over and I noticed that I actually slept so well that night. Having tried the relaxation session, I'm keen to try one of the rejuvenating options too. I will definitely be doing it again.",
    name: "Letitia D.",
    context: "18/09/2026",
  },
];
