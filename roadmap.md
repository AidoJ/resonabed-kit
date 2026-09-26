# Tasks

- [x] Raise storage limits for ~1GB WAV uploads
- [ ] Confirm /audio upload path handles large files
- [x] Redesign client invoice and receipt with ResonaBed branding

## Marketing website rebuild

- [x] Pass 1: rebuild homepage hierarchy, hero, value proposition, how it works, packages, and testimonial-ready practitioner perspective
- [x] Pass 2: create focused research page with the two-view animation experience
- [x] Pass 3: polish FAQs, demo, contact, accessibility, performance, and responsive behaviour
- [x] Acceptance testing on desktop and mobile without live bookings, enquiries, payments, or publishing
- [ ] Owner to supply an approved practitioner testimonial (quote + name) to replace the labelled practitioner-perspective section

## Demo landing page

- [x] Add the supplied therapist landing page at `/demo` without changing existing pages
- [x] Save validated enquiries privately with attribution and duplicate protection
- [x] Notify info@resonabed.com through the existing email setup
- [x] Verify desktop, mobile, direct refresh, validation, saved enquiry access, and delivery in preview
- [x] Leave production unpublished for owner review

## CRM (demo enquiries)
- [x] CRM as its own top-level sidebar tab for super admins (Sales group above Platform)
- [x] Named "CRM" in sidebar and page title
- [x] Lead pipeline (New/Contacted/Demo booked/Won/Lost), owner, follow-up date, notes timeline
- [x] CRM summary card on the platform admin home
- [x] Verified end-to-end as platform admin: list, detail, stage change, owner, note, timeline
- [x] Platform-admin-only permanent deletion with confirmation
- [x] Email full enquiry details to info@resonabed.com for every new CRM enquiry, with safe retry on delivery failure

## VAT science to the fore (done)
- [x] Homepage "What is VAT" section (explainer, BMJ wording, 4 benefit cards, cell poster link to /research)
- [x] "How VAT works in the body" block inside How it works
- [x] Kit tie-in line near packages
- [x] Clinic pages already carry ScienceSection + cell animation (verified, no change needed)
- [x] For home: /for-home redirects to homepage, which now leads with the VAT explainer

## Clinic licence and public branding
- [x] Activate the included 12-month music licence when a paid clinic order is linked to its organisation
- [x] Enlarge clinic logos and place the strapline beneath in smaller text

## Home player music fix (done)
- [x] Home session player: music now joins even when Start is tapped before the track finishes loading (replay effect in src/routes/home.index.tsx); verified as 71tdeeble home user — audio plays and advances, no errors
