# Add the ResonaBed demo landing page

## Build
- Add a new public `/demo` page only, reproducing the supplied warm-white, purple, serif design, exact wording, responsive layout, and attached treatment photograph.
- Keep the homepage and every existing page unchanged by scoping all new presentation styles to the demo page.
- Add the supplied page metadata only to `/demo`.

## Enquiry form
- Add the requested name, email, practice, suburb/city, optional phone, hidden spam field, accessible validation, pending, error, and confirmed-success states.
- Capture `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` from the page URL.
- Save each enquiry privately in Lovable Cloud through a validated server action, using a submission ID to prevent duplicates.
- Restrict stored enquiries to server-side access so anonymous visitors cannot read them.
- Send one fixed new-enquiry notification to `info@resonabed.com` through the existing verified ResonaBed email setup.

## Verification
- Check direct navigation and refresh at `/demo`.
- Check desktop and mobile layout, including horizontal overflow and focus states.
- Check client-side and server-side form errors.
- Submit one clearly labelled preview test enquiry, confirm it was saved once, confirm anonymous reads are blocked, and confirm the notification send was accepted.
- Leave production unpublished and present the completed preview for review.

## Technical details
- Use a dedicated route and scoped stylesheet rather than changing global website styling.
- Add one private `demo_enquiries` table with service-only access, row-level security enabled, and no anonymous or signed-in browser grants.
- Use the existing managed email templates and sender domain; no additional email connection is required.
