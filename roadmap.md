# Tasks

## Revised DL flyer editor
- [x] Build the approved six-panel colour editor and live flyer preview in Marketing
- [x] Restrict client editing to logo upload, phone number and panel colours; lock all content and layout
- [x] Implement clinic-specific saving; verify panel changes, desktop/mobile preview and two-page printable export
- [ ] Verify logo upload and save/reopen in a clinic account — current preview account is platform-only with no active clinic support grant
- [x] Leave public flyer downloads and production unchanged for owner review

- [x] Add fixed-dollar promo codes alongside percentages and verify administration and checkout
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

## Wellbeing check slider polarity
- [x] Show Pain first and Stress second on every wellbeing check
- [x] Reverse Pain to None (left, green) → Severe (right, red)
- [x] Reverse Stress to Calm (left, green) → Very stressed (right, red)
- [x] Keep the remaining scales negative-left → positive-right
- [x] Preserve existing saved score meanings and frequency matching
- [x] Pain/Stress numbers run 0 (left) → 10 (right); stored scores are now severity (10 = Severe/Very stressed), colours inverted for those two
- [x] Verified live in preview: Pain dragged right = 10/red/Severe; Stress dragged left = 0/green/Calm; before and after checks share the same logic

## Search and AI visibility (owner plan, Nov 2026)
- [x] Part 1: Research page text server-rendered
- [x] Part 2: www→apex (hosting forces 302; canonicals point to apex), canonicals, robots.txt bots, sitemap (demo, directory clinics, lastmod)
- [x] Part 3: lang en-AU, homepage canonical/title/description, audit all public pages
- [x] Part 4: JSON-LD (Organization, Product+Offer, FAQPage, BreadcrumbList)
- [x] Part 5: frequency wording, tone card line, new FAQ, health-wording list
- [x] Part 6: clinic directory switch, /practitioners, clinic H1 + LocalBusiness
- [x] Part 7: AI crawler log (8 AI bots, public pages only, background insert, 90-day cleanup, AI crawlers admin page)
- [x] Part 8: SEO review, sound-bed vs therapy-bed overlap report, final change list
- [ ] Publish — waiting for owner's go-ahead
- [x] Package stock status for search data (all four InStock)

## Owner follow-up on Parts 1–6 (Nov 2026)
- [x] All four packages InStock; add Home ("Resonabed for Home", $1,699) Product+Offer; full prices incl. GST flagged; no shipping in search data
- [x] Sitemap lastmod: no hand-set dates; only real content-change dates (clinic pages)
- [x] Wording changes 3a, 3c–3i (3b flyer unchanged; 3f with visible [LINKS TODO])
- [x] Re-run frequency/health wording check; report search data per package
- [ ] Therapy bed FAQ study links — waiting for owner's links (visible [LINKS TODO] until then)
- [x] List every place the kit 'Wiring, fittings…' wording appears (reported; no changes)
- [ ] Owner's Parts 1–8 note: kit wording (awaiting replacement text), separate the two bed pages, final checks
