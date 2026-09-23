# Basic CRM for demo enquiries

A simple sales follow-up desk for the enquiries that arrive from the `/demo` page. Nothing on the public page changes — this is a new private admin area.

## How it would work

1. Someone submits the form on `/demo` (unchanged). The enquiry is saved as it is today.
2. The enquiry appears immediately in a new **Leads** page in the platform admin area, marked **New**.
3. Each lead moves through a simple pipeline: **New → Contacted → Demo booked → Won / Lost**.
4. Each lead has an owner (a platform admin), a next-follow-up date, and a running notes timeline.
5. The Leads page opens on "needs attention": new leads plus anything with a follow-up date due today or earlier.

## The leads list

- Columns: name, practice, suburb, stage, owner, next follow-up, created.
- Filter chips by stage, plus a filter for "due or overdue" and "unassigned".
- Search by name, practice or email.
- Click a row to open the lead detail.

## The lead detail

- Contact details (name, practice, suburb, email, phone) with click-to-email and click-to-call.
- Where the enquiry came from (the campaign tags already captured) and the reference number.
- Stage selector, owner selector, next-follow-up date.
- Add-a-note box with a timeline of every note and stage change, each stamped with who and when.
- Marking **Lost** asks for a short reason.

## Dashboard summary

A small card on the platform admin home: new leads this week, leads due today, leads overdue.

## What it will not do

- No emails sent to enquirers from the CRM (follow-up happens in your own inbox; the existing notification to info@resonabed.com stays as is).
- No automatic reminders or scheduled tasks.
- No changes to the `/demo` page design, wording or form.
- Visible to platform admins only, as the enquiry records are today.

## Technical outline

- Migration: add `stage`, `owner_id`, `next_follow_up_on`, `lost_reason` to `demo_enquiries`; new `demo_enquiry_events` table (enquiry_id, type note/stage_change/assignment, body, from_stage, to_stage, actor_id, actor_name, created_at) with GRANTs and super-admin-only RLS on both, plus an update policy for super admins on `demo_enquiries`.
- `src/lib/crm.functions.ts`: `listDemoLeads`, `getDemoLead`, `updateDemoLead`, `addDemoLeadNote`, `getDemoLeadSummary` — all `createServerFn` with `requireSupabaseAuth`, each verifying `is_super_admin` before reading or writing.
- `src/routes/_authenticated/leads.tsx` (list + detail panel) following the existing `admin.sales.tsx` patterns; **Leads appears as its own top-level item in the platform admin sidebar** (a new "Sales leads" group above Platform in the super-admin sidebar), not inside the admin tab strip.
- Summary card added to the existing platform admin home.
