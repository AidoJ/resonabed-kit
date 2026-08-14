# Phase 2 design: deposit-first order model

Design document only. Nothing built until you green-light it.

## 0. The money, restated

| Package | Pay in full | Deposit | Balance | Plan: deposit balance | Monthlies | Plan total |
|---|---|---|---|---|---|---|
| Basic | $1,199 | $100 | $1,099 | $299 | 10 x $90 | $1,299 |
| Pro | $1,399 | $100 | $1,299 | $299 | 10 x $110 | $1,499 |
| Platinum | $1,799 | $100 | $1,699 | $499 | 10 x $130 | $1,899 |
| Home | $1,499 | $100 | $1,399 | $399 | 10 x $110 | $1,599 |

Shipping is charged once, with the $100 deposit. GST is 1/11 of every GST-inclusive line.

## 1. Order state machine

A new local table `kit_orders` becomes the source of truth. Stripe stops being the record and goes back to being the payment rail.

Columns (shape, not SQL): order number, package key, buyer type, buyer contact, business details, shipping address or pickup, shipping region/label/cents/gst flag, promo code, chosen path (`full` or `plan`), all money fields (deposit, shipping, balance due, plan deposit balance, monthly, months), Stripe references (deposit session/payment intent, balance session/payment intent, subscription id, customer id), state, timestamps for each transition, `fulfilled_at`, `expires_at`, `notes`.

States:

```text
draft -> deposit_paid -> balance_paid  -> fulfilled
                      -> plan_active   -> fulfilled -> plan_completed
      -> expired (30 days at deposit_paid, no balance)
      -> cancelled / refunded (deposit returned)
      -> defaulted   (Phase 3 only, hook left in place)
```

- `draft`: order row written before the deposit checkout opens, so a webhook always has a row to land on.
- `deposit_paid`: $100 + shipping cleared. Order secured, `expires_at` = +30 days. Nothing ships.
- `balance_paid`: remaining balance cleared in a second one-off checkout.
- `plan_active`: deposit balance cleared and the 10-month subscription is live.
- `fulfilled`: written by the single fulfilment routine once it has succeeded (code issued / onboarding row created / shipping flagged). Separate from `balance_paid` so a failed email never loses the order.
- `plan_completed`: 10th invoice paid, subscription ended.
- `expired`, `refunded`, `cancelled`, `defaulted` as terminal/admin states.

Event mapping (webhook, signature verified, idempotent on Stripe object id):

| Stripe event | Effect |
|---|---|
| `checkout.session.completed` with `order_step=deposit` | draft -> deposit_paid, stamp expiry |
| `checkout.session.completed` with `order_step=balance` | deposit_paid -> balance_paid, then fulfil |
| `checkout.session.completed` with `order_step=plan` (subscription mode) | deposit_paid -> plan_active, set the plan end, then fulfil |
| `invoice.paid` on the plan subscription | increment payments made; on the 10th, plan_completed |
| `invoice.payment_failed` | Phase 3 hook: record only, no action now |
| `charge.refunded` on the deposit | -> refunded |

Every state change is appended to a `kit_order_events` log (event type, Stripe ref, payload snippet) so money movement is auditable and replays are safe.

## 2. Stripe mechanics

Two checkouts per order, never one.

1. **Deposit checkout** (`mode: payment`): $100 line + shipping line. Metadata carries the order id and `order_step=deposit`. Customer is created up front (name, address, shipping) and reused, so the balance step and the plan bill the same customer.
2. **Balance step**, chosen after the deposit clears, from a returning-buyer page at `/order/<order-number>`:
   - **Pay in full**: second `mode: payment` checkout for the balance only. No shipping line.
   - **Plan**: `mode: subscription` checkout with a one-off deposit-balance line plus the monthly recurring line. No shipping line.

**Stopping after exactly 10 payments.** Drop the `cancel_at` 30-day arithmetic. Use `subscription_data.cancel_at_period_end` logic driven by the invoice count instead: on each `invoice.paid`, count paid invoices carrying the monthly line; when the count hits 10, call `subscriptions.update(..., { cancel_at_period_end: true })` (or cancel immediately, since the last payment is collected). That is exact by construction and immune to month-length drift, DST and retries. Belt and braces: also set `cancel_at` to the real calendar date 10 months + 2 days out at creation as a backstop, computed with proper date maths, not 30-day blocks.

## 3. Shipping charged once

Shipping only ever exists as a line item on the deposit checkout. The balance and plan checkouts are built from the order row's balance figures, which exclude shipping by definition. The order row stores `shipping_cents` and `shipping_charged_at`; the balance builder asserts shipping is already charged and never adds a line. Pickup orders store zero and behave identically.

## 4. Fulfilment fork

One entry point, `fulfilOrder(orderId)`, replaces `fulfilCheckoutSession(session)` as the caller-facing function. It is called only from `balance_paid` and `plan_active`, never from the deposit.

It reuses the existing paths unchanged underneath:
- record the sale/invoice (`kit-invoicing.server`)
- business -> `recordOnboardingOrder` (clinic onboarding queue)
- personal/home -> `issueAccessCode` (existing home access email)
- physical flags on the order row: `ships_kit` always, `ships_table` for Platinum and Home, surfaced in the admin fulfilment list.

Idempotency keys move from the Stripe session id to the order number, so a plan order and a pay-in-full order fulfil identically and only once.

## 5. Deposit hold, expiry, refund

- `expires_at` = deposit paid + 30 days.
- A daily sweep (existing `/api/public/hooks/offer-tick` style cron endpoint) moves stale `deposit_paid` orders to `expired` and flags them to admin. It does **not** auto-refund: money leaves only on a human action.
- Reminder emails at day 7 and day 25 while still at `deposit_paid`.
- Admin refund action on the order refunds the deposit (and shipping) through the stored payment intent, writes `refunded`, logs who and why. Refunds are blocked once the order is `fulfilled`.

## 6. Platinum plan

Un-hidden: $100 deposit + $499 deposit balance + 10 x $130 = $1,899. Table freight scope stays. Removes the current `installments: null` guard and the hidden plan button on the homepage card.

## 7. What breaks, what carries over

Breaks / must change:
- **Fulfilment on `checkout.session.completed`** — the biggest one. Today any completed session fulfils. After this change the deposit session completes and must fulfil nothing. This is the change most likely to leak product if we get it wrong, so the fulfil routine will hard-refuse unless the order is in `balance_paid`/`plan_active`.
- **The 8 x $100 subscriptions** — replaced by the 10-month structure everywhere (checkout, sales reporting installment map, admin invoice builder, homepage plan buttons and plan-total copy).
- **`/order/success` idempotent re-run** — kept, but it now finalises whichever step just completed, keyed on the order, and only fulfils when the step warrants it.
- **`finalizeCheckoutSession`'s `cancel_at` maths** — deleted, replaced by the invoice-count rule.
- **Reporting** (`sales.server.ts`) — currently derives everything from Stripe sessions and a list-price map. It has to read `kit_orders` instead, or an order will appear twice (deposit session + balance session). Contract value, collected-to-date, GST and outstanding balance all come off the order row.
- **Promo codes** — apply to the kit balance, not the deposit. Redemption recording moves to the balance step.

Carries over unchanged: shipping rate resolution and bands, the access-code issuing path, onboarding queue, kit invoice/receipt numbering, the buyer-type fork, GST maths.

## 8. EFT / invoice path

Same model, different rail. EFT buyers also start with a $100 + shipping deposit invoice; the order row is identical and states move on admin-recorded payments rather than Stripe events.

- Deposit invoice raised at order time; admin marks it paid -> `deposit_paid`.
- Balance invoice raised for the remaining amount (or the deposit-balance for a plan); marked paid -> `balance_paid` / `plan_active` -> fulfil.
- EFT payment plans have no card on file, so the 10 monthlies become 10 scheduled invoices with no automatic collection. My recommendation: for Phase 2, offer EFT for the **deposit and pay-in-full balance only**, and require a card for the 10-month plan. Manual monthly EFT chasing is a dunning problem, which is explicitly Phase 3.

## Phase 3 hooks left in place

`invoice.payment_failed` recorded into the event log, `defaulted` state defined but never entered, `payments_made` / `payments_due` counters on the order row, and an `arrears_since` timestamp column. No behaviour attached.

## Size and risk

| Part | Size | Risk |
|---|---|---|
| `kit_orders` + events schema, RLS, grants | Medium | Low |
| Deposit checkout + returning-buyer balance page | Medium | Medium |
| Webhook rewrite to order state machine | Medium | **High** (money and fulfilment correctness) |
| Exact 10-payment stop | Small | Medium |
| Fulfilment gating rewrite | Small | **High** (could ship on a $100 deposit if wrong) |
| Expiry sweep, reminders, refund action | Medium | Low |
| Platinum plan | Small | Low |
| Reporting rebuild onto orders | Medium | Medium |
| EFT deposit-first | Medium | Low |

## Things that worry me, and what I would do differently

1. **Two-step checkout increases abandonment.** A real fraction of buyers will pay $100 and never return. That is a business decision, not a bug, but the reminder emails and the returning-buyer link are load-bearing, not nice-to-have.
2. **Shipping is charged before we know the buyer will complete.** If an order expires, the refund should return deposit *and* shipping. I will make that the default in the refund action.
3. **Reporting double-count is the quiet danger.** Any Stripe-session-derived report will show two "orders" per sale after this. Rebuilding reporting onto `kit_orders` is not optional.
4. **I would price the plan monthlies as a Stripe Price object per package** rather than inline `price_data`, so the plan is visible and auditable in the Stripe dashboard and future changes do not silently fork.
5. **Suggestion:** hold the balance link behind an emailed tokenised URL (like the existing booking-offer tokens) rather than a guessable order number.
