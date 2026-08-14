# Phase 3 design: failed payments, graduated arrears, and the arrears view

Design only. Nothing gets built until you say so.

## 0. The shape of the risk

A 10-month plan order looks like this by the time the plan starts:

| Package | Deposit | Deposit balance | Upfront cushion | 10 monthlies | Plan total |
|---|---|---|---|---|---|
| Basic | $100 | $299 | $399 | 10 x $90 | $1,299 |
| Pro | $100 | $299 | $399 | 10 x $110 | $1,499 |
| Platinum | $100 | $499 | $599 | 10 x $130 | $1,899 |
| Home | $100 | $399 | $499 | 10 x $110 | $1,599 |

Plus shipping, charged with the balance step. The upfront cushion is the only money you are guaranteed. Everything after it is credit you have extended against hardware you cannot get back. That single fact drives the whole design: the response has to be sharpest early, when exposure is near the full monthly stack, and soft late, when it is a rounding error.

**Outstanding** is the number the whole phase turns on:

```text
outstanding_cents = plan_monthly_cents * (plan_months - payments_made)
```

Pro defaulting after payment 1 owes $990. Pro defaulting after payment 9 owes $110. Same event, ninefold difference in loss. Treating them identically is the mistake this design exists to avoid.

## 1. Retries and dunning (the automatic layer)

Most failures are dead cards, not dead customers. This layer should recover the majority with zero involvement from you.

**Stripe Smart Retries** on the subscription, cadence set in Stripe billing settings, retry on days 3, 5, 7 and a final attempt on day 10 (4 attempts over 10 days). After the final failure Stripe marks the invoice `uncollectible` and we take over. We do **not** let Stripe cancel the subscription on failure; the retry policy is set to leave it alone so we control the lifecycle.

**Dunning emails**, sent by us (not Stripe's built-in ones, so they carry your branding and the tokenised link):

| When | Email | Tone |
|---|---|---|
| Failure day 0 | "Your payment didn't go through" | Neutral, assume a card problem. Update-card button. |
| Day 5 (after 2 failed retries) | "We still can't take your payment" | Warmer nudge, states the amount and next retry date. |
| Day 10 (retries exhausted) | "Your payment plan needs attention" | Names the outstanding amount, states what happens if nothing changes, gives a date. |
| Day 17, arrears only | "Final notice before your plan is suspended" | Firm, but tone still scales by tier (see section 3). |

The update-card link reuses the Phase 2 tokenised order URL pattern: `/order/card/<token>` opens a Stripe billing-portal session scoped to that customer, `payment_method_update` only. No login, no guessable order number, token hashed at rest exactly like the balance token.

All four emails suppress once a payment succeeds. Each is idempotency-keyed on order + invoice + step so a webhook replay never double-sends.

## 2. The two states, and where the line falls

```text
plan_active
   |  invoice.payment_failed (attempt 1)
   v
plan_active + arrears_since set        <- flagged to you, dunning running
   |  10 days of retries exhausted, still unpaid
   v
arrears (real state)                   <- consequence NOT yet applied
   |  +14 more days unpaid, and outstanding above the floor
   v
defaulted                              <- graduated consequence applies
   |  pays what is owed, at any point
   v
back to plan_active (auto-restore)
```

- **arrears_since** is stamped on the very first failure, so your view lights up on day 0. That is a flag, not a state change.
- **`arrears`** state is entered when Stripe's retries are exhausted (day 10) and the invoice is still unpaid. Dunning continues, access untouched.
- **`defaulted`** is entered at **day 24 from first failure** (14 days in arrears), and only if the proportionate gate below allows it.

24 days is deliberate: it is longer than any card reissue cycle, longer than a pay cycle, and short enough that a genuine walk-away is caught inside a month.

### The proportionate gate

Default is not automatic. At the day-24 check the order is graded on **outstanding amount**, and the grade decides both whether default is entered and what it does:

| Tier | Outstanding | Roughly | Enters `defaulted`? |
|---|---|---|---|
| **A. Heavy** | >= $700 | fails on payments 1-3 | Yes, automatically |
| **B. Moderate** | $250 - $699 | payments 4-7 | Yes, automatically |
| **C. Light** | < $250 (about 2 monthlies) | payments 8-10 | **No.** Stays in `arrears`, flagged as "write-off candidate", never auto-defaults |

Tier C is the point of the whole design. Chasing a customer hard over $110 costs more in goodwill than the $110 is worth, and you already hold $1,489 of a $1,599 order. Those orders sit in a **Soft arrears** bucket in your view with a one-click "Close as settled (write off $X)" action. Human decision, never automatic.

There is also a **grace exemption**: an order with a clean history (no prior failure in the plan) gets +7 days before default, on the reasoning that a first-time miss from an otherwise perfect payer is almost always a card, not a decision.

## 3. What actually happens on default

Being honest first: **you cannot repossess a table.** No consequence here recovers hardware. The upfront cushion ($399-$599) is the actual loss floor, and some default risk is simply the cost of offering plans. Everything below is about (a) stopping further loss, (b) creating enough friction that a recoverable customer comes back, and (c) not pretending to leverage you do not have.

### Home buyers

They own the hardware. The kit plays through the app; without the app they have a table and headphones and nothing to drive them. So access suspension is *real* leverage, but only as long as the app is the only playback route. That is true today.

| Tier | Consequence |
|---|---|
| A. Heavy | `home_accounts` access suspended: sign-in blocked with a payment-required screen and a pay-now link. Access code marked `suspended`, not revoked. |
| B. Moderate | Access limited: sign-in works, global library locked (the same gate the music licence already uses), banner on every screen. They keep any org/uploaded content. |
| C. Light | Nothing. Email only. |

Suspension is a **soft lock, never a delete.** No account removal, no data loss, everything comes back intact on payment.

### Clinic buyers

Stronger leverage, because their business runs on it, and correspondingly more care needed: suspending a clinic mid-session harms *their* clients, who owe you nothing.

| Tier | Consequence |
|---|---|
| A. Heavy | Org moved to `suspended` after a **7-day notified wind-down** (email to org admin naming the date). Existing confirmed bookings inside the window still run; new bookings and new sessions blocked. Never an instant cut. |
| B. Moderate | Org stays active. Public booking page unpublished, new-session creation blocked, admin can still see records and complete existing bookings. |
| C. Light | Nothing. Email only. |

**Never suspended in any tier:** access to their own client records, screening history, and clearance letters. That is clinical/legal record-keeping and withholding it over a billing dispute is indefensible.

The whole enforcement layer reads from one function, `planAccessLevel(order) -> 'full' | 'limited' | 'suspended'`, so there is exactly one place the rule lives and one place to audit it.

## 4. Auto-restore

Recovery must be instant and unattended, because a customer who has just paid and still can't log in is a support ticket and a refund request.

On `invoice.paid` for a plan order in `arrears` or `defaulted`:

1. `payments_made` increments, `collected_cents` rises (existing Phase 2 code, unchanged).
2. `arrears_since` cleared, state returns to `plan_active`.
3. Access restored in the same transaction path: home account unsuspended, code back to `redeemed`, org back to `active` (only if this default suspended it, tracked via a `suspended_by_order_id` marker so we never un-suspend an org you suspended for another reason).
4. "Welcome back, your plan is running again" email, stating payments remaining.
5. Event logged.

Restore is also available as a manual admin action for EFT/bank payers, taking a reference and an amount, writing the same events.

The subscription itself is never cancelled during arrears or default, only paused (`pause_collection`) at tier A. Pausing rather than cancelling means resuming is one API call and the customer never re-enters card details.

## 5. The arrears view (super admin)

This is the part you will actually use daily, so it is a working surface, not a status column. New tab at `/admin/arrears`, and a red count badge on Kit sales whenever anything is in arrears.

**Top strip, four figures:**
- Total outstanding across all plans (the real credit book)
- At-risk today (outstanding on arrears + defaulted orders only)
- Recovered this month (arrears that returned to active)
- Written off this year

**Three buckets, in priority order:**
1. **Action needed** — default candidates and tier A/B defaults
2. **Chasing** — in dunning, retries still running
3. **Soft arrears** — tier C, write-off candidates

**Each row shows:** order number and package, buyer name and type (clinic/home badge), a payments bar (`6 of 10` rendered visually), collected vs outstanding in dollars, **owed today** (the failed invoices' total, which is the number you actually chase, distinct from remaining contract), days in arrears, current access level, and last dunning email sent.

**Row actions:** resend dunning email, send card-update link, pause dunning for 14 days (customer promised to pay), restore access manually, record an off-platform payment, close as settled/write off, and open the full order event log.

**Sorting defaults to outstanding descending**, so the money is at the top of the page, not the oldest complaint.

## 6. What this touches

**Changes:**
- **Webhook** — `invoice.payment_failed` stops being a log line and drives dunning + state. `invoice.paid` gains the restore path. New: `customer.subscription.paused/resumed` handled for consistency.
- **`orders.server.ts`** — `recordPlanPaymentFailure` rewritten; new `enterArrears`, `evaluateDefault`, `restorePlan`, `writeOffOrder`, and `planAccessLevel`.
- **`order-tick` cron** — gains the daily arrears sweep: escalate day-10 to arrears, evaluate day-24 defaults through the proportionate gate, send the day-17 notice, and run clinic wind-down expiries. The existing draft/expiry/reminder sweeps are untouched.
- **Schema** — `kit_orders` gains `dunning_stage`, `last_dunning_at`, `defaulted_at`, `access_level`, `write_off_cents`, `dunning_paused_until`; `kit_access_codes.status` gains `suspended`; `organisations` gains `suspended_by_order_id`. New event types only, no new tables.
- **Access control** — home sign-in gate, home global-library gate (reuses the music-licence pattern), clinic org-suspension gate, public booking page gate.
- **Reporting** — `sales.server.ts` gains arrears/default/write-off awareness so collected vs contract stays honest; a written-off order should not read as owing forever.
- **Emails** — 5 new templates: `plan-payment-failed`, `plan-payment-retry`, `plan-payment-final-notice`, `plan-access-suspended` (with home/clinic variants), `plan-restored`.
- **New route** — `/order/card/<token>` for the tokenised billing-portal card update.

**Carries over unchanged:** the deposit-first checkout, fulfilment gating, the exact-10-payment stop rule, shipping-at-balance, promo redemption, invoicing/receipt numbering, the buyer-type fork, GST maths, and the whole Phase 2 order/event schema and RLS approach.

## 7. What worries me

1. **Home enforcement is weaker than it looks, and it degrades.** Today the app is the only way to drive the hardware. The moment a buyer discovers they can play tones from anywhere, suspension is worth nothing. Treat it as friction that prompts payment, not as a lock. It works because most defaulters are disorganised, not adversarial.
2. **Clinic suspension has an innocent third party.** Their clients booked in good faith. That is why tier A is a notified 7-day wind-down and never touches clinical records. I would rather lose a month of leverage than strand someone's patient.
3. **Tier C is a deliberate write-off policy, not a loophole.** You will lose small amounts on late defaulters, on purpose. If that sits badly, the alternative is a single flat rule and worse customer relations, which I would advise against.
4. **The biggest real protection is not in this phase.** It is the upfront cushion. If plan defaults ever exceed a few percent, the fix is raising the deposit balance, not sharpening the dunning.
5. **I'd add one thing you didn't ask for:** a card-expiry pre-warning. Stripe tells us when a card on file expires next month. One email before the failure prevents more arrears than the entire dunning chain recovers, at a fraction of the cost.
6. **Testing default paths safely.** Stripe test clocks let us simulate 10 months of billing in seconds. I'd build against them rather than trust reasoning about date arithmetic, given this touches both money and access.

## 8. Size and risk

| Part | Size | Risk |
|---|---|---|
| Schema, event types, columns | Small | Low |
| Smart Retries config + dunning emails (5 templates) | Medium | Low |
| Webhook: act on failure, restore on paid | Medium | **High** (money and access correctness) |
| Arrears/default state machine + proportionate gate | Medium | Medium |
| `planAccessLevel` + home access gates | Medium | **High** (wrongly locking a paying customer) |
| Clinic wind-down + org suspension gate | Medium | **High** (third-party harm if wrong) |
| Auto-restore path | Small | **High** (must be instant and total) |
| Tokenised card-update route | Small | Medium |
| Arrears view + row actions | Large | Low |
| Reporting write-off awareness | Small | Low |
| Card-expiry pre-warning (optional) | Small | Low |

The three genuinely dangerous items are all "a paying customer gets locked out" or "a defaulted customer keeps everything". Both fail loudly and both are covered by test-clock simulation before anything goes live.
