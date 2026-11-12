<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Promo discounts

- Store fixed promo amounts in integer cents; a non-null fixed amount overrides the legacy percentage field so existing percentage codes remain compatible. Orders freeze the monetary discount, and percentage is null for fixed codes to avoid misreporting.

## Session audio

- Session music and the session-end sequence are scheduled on the device audio clock (Web Audio) rather than page timers, so the ending still fires when the screen locks or the tab is backgrounded; page timers only mirror the display.
- The closing recording is started only by the booked ending and never during start-up unlock, because a muted pre-play of it has leaked audible sound at the beginning of sessions on some devices.
- Any change to session playback must keep working for every access mode (clinic, home user, support and admin) and must not rely on a single clinic's licence or signed URL being the only source of the track.

## Flyer editor

- Keep flyer preferences separate from website themes in organisations.flyer_design, validated by the strict shared schema, so flyer changes cannot alter the clinic website or editable content scope.
- Generate the Marketing preview and printable export through the same panel renderer using the supplied artwork; leave the public flyer pipeline independent until explicitly requested.
- The brochure artwork is flattened, so panels are recoloured per pixel (tint the paper, pull dark ink to the text colour) with protect masks keeping photos untouched, and Resonabed logos are drawn as separate images at true proportions because baked-in logos stretched.

- Each frequency has up to four recordings as separate audio_files rows keyed by `variant` (one active per library/frequency/variant, enforced by a unique index); playback resolves by variant and falls back to `original` with a visible note, so a comfort switch never hides a frequency.
- Switching variant mid-session changes only the `src` of the same mounted <audio> element (never remount it), because the Web Audio routing and the booked ending live on that element.
- Shared (global) music is reachable only through server-signed links (src/lib/music-access.server.ts) issued after the pure, tested checks in src/lib/music-access.ts; storage rules deny direct reads of the global folder to everyone but super admins, so a signed-in account can't bypass the licence.
- Clinic sessions can't start on an expired music licence: the new-session wizard blocks before the screening step, and submitScreening, createDraftSession and startSessionFromBooking re-check on the server so no screening is written for a session that can't run.
- A mid-session Deep Feel/Ambient change saves the choice and loads the new recording and its link before the player switches, so a failure leaves the current recording playing.

## Search and structured data

- The sitemap is router-derived: every route declares `staticData.sitemap`, and clinic pages come from the `get_public_directory` function, so only directory-listed clinics appear. Only clinic pages carry <lastmod> (from the clinic record); hand-set dates are not allowed, so static pages omit it.
- Public page text, prices and JSON-LD must be server-rendered (route loaders + head()); heavy visuals may start client-side in effects but their copy stays in the first HTML.
- Canonicals, og:url and JSON-LD URLs are built from `SITE_URL` in src/lib/seo.ts (apex domain) so they never drift between www and non-www.
- Directory listing data (suburb, state, postcode, phone only if the clinic shows it) is exposed only through `get_public_directory`, gated by the clinic's own opt-in switch.
- AI crawler visits are logged from src/server.ts after the response is built (handed to the worker's waitUntil, never awaited) so logging can't slow pages; bot/path rules live in the pure, tested src/lib/crawler-log.ts, inserts use the server-only admin client, only super admins can read rows, and a daily database job deletes rows older than 90 days.
- Package kit contents, fitting time and install wording live only in src/lib/kit-contents.ts; package cards, the Home panel, the compare table, the kit showcase and the bed pages' shared KitList read from it so every kit list stays identical.
- The two bed pages target different searches (sound bed: own table/home; therapy bed: clinics) and must not share prose beyond the shared KitList and ClosingDisclaimer; the full science section and study references live only on /research (and clinic pages).
- The Stage B device storage test (src/lib/storage-test.ts, hidden /admin/storage-test, super admins only) writes Cache Storage in 16 MB parts so large tests never hold the whole file in memory; it stays browser-only and sends nothing to the server.
- Business settings: only super admins read or change them; signed-in accounts can read only the music renewal price and order deposit, and visitors only the deposit. Buyers get bank details from server code using the admin client, never from a browser read.
- EFT tax invoice emails (buyer plus an admin copy) are sent from server code right after the deposit or balance invoice row is created, built by the pure, tested src/lib/eft-invoice-email.ts; the balance email goes only when that call created the invoice, and a send failure never undoes the invoice. The invoice is in the email body because app emails can't carry attachments.
