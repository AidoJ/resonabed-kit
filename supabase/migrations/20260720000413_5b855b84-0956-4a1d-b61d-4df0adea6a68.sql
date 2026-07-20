-- Global, super_admin-managed policy templates shipped to new orgs.
CREATE TABLE IF NOT EXISTS public.policy_templates (
  kind text PRIMARY KEY CHECK (kind IN ('consent','privacy','health_safety')),
  title text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.policy_templates TO authenticated;
GRANT ALL ON public.policy_templates TO service_role;

ALTER TABLE public.policy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_templates read (any authenticated)"
  ON public.policy_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "policy_templates insert (super admin)"
  ON public.policy_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "policy_templates update (super admin)"
  ON public.policy_templates FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "policy_templates delete (super admin)"
  ON public.policy_templates FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER policy_templates_set_updated_at
  BEFORE UPDATE ON public.policy_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.policy_templates (kind, title, body) VALUES
  ('consent',       'Client Consent to Vibroacoustic Therapy', $TPL$**[CLINIC LEGAL NAME]** ("we", "the clinic") — ABN **[ABN]**

## What this session involves
Vibroacoustic therapy uses low-frequency sound and vibration delivered through a
therapy bed or table while you rest, clothed, on the surface. It is intended for
**relaxation and general wellbeing**. It is **not** a medical treatment and is **not**
a substitute for medical or allied-health care, diagnosis, or advice from a qualified
practitioner.

## No medical claims
We make no claim that this session treats, cures, or manages any medical condition.
If you have a health concern, please consult a qualified medical practitioner.

## Suitability and contraindications
Some people should not use vibroacoustic therapy, or should seek medical advice
first. Please tell us before your session if any of the following apply to you:
- A pacemaker or other implanted electronic or active medical device
- Pregnancy
- Recent surgery
- A history of blood clots, DVT, or thrombosis
- Acute inflammation or infection
- Very low blood pressure
- Epilepsy or a seizure disorder
- **[CLINIC TO ADD any further contraindications relevant to its scope/insurer]**

If you are unsure whether the session is suitable for you, we may ask you to obtain
clearance from your doctor before proceeding.

## Your consent
By signing below, you confirm that:
- You have read and understood the above.
- The information you have given us about your health is true and complete to the
  best of your knowledge.
- You understand this session is for relaxation and wellbeing and is not medical
  treatment.
- You consent to receiving the session, and you understand you may stop it at any
  time.
- You consent to the clinic collecting and holding the information you provide, as
  described in our Privacy Policy.

Client name: **[typed at signing]**  Signature: **[captured at signing]**
Date: **[captured at signing]**

> **Clinic to review:** align contraindications with your insurer and professional
> association; confirm wording with your adviser; ensure it matches what your
> practitioners are actually trained and insured to do.$TPL$),
  ('privacy',       'Privacy Policy',                          $TPL$**[CLINIC LEGAL NAME]** ("we", "us") — ABN **[ABN]**
Contact for privacy matters: **[NAME / ROLE]**, **[EMAIL]**, **[PHONE]**

We handle personal information in accordance with the **Privacy Act 1988 (Cth)** and
the **Australian Privacy Principles (APPs)**. Because we provide a health service and
hold health information, we are bound by the Privacy Act as a health service provider.

## What we collect
- Identity and contact details: name, email, phone, date of birth.
- Health information you provide for your session: pain, stress and sleep levels,
  areas of the body, health concerns, contraindications, and related notes.
- Session records: services provided, dates, and practitioner notes.
- Your signed consent.
- **[CLINIC TO ADD anything else it collects — e.g. payment records, marketing
  preferences]**

Health information is **sensitive information** under the Privacy Act. We collect it
only with your consent and only where it is reasonably necessary to provide your
session safely.

## Why we collect it
- To assess whether a session is suitable and safe for you.
- To deliver and record your session.
- To keep accurate client records.
- To contact you about your care or appointments.
- **[CLINIC TO ADD any other purpose — e.g. billing, recall reminders]**

We will not use your information for a purpose you would not reasonably expect
without your consent.

## How we store and protect it
Your information is stored **[describe: e.g. in the Resonabed software platform,
which stores data securely on our behalf]**. We take reasonable steps to protect it
from misuse, loss, and unauthorised access. Access is limited to practitioners and
staff who need it to provide your care.

We use **Resonabed**, a third-party software provider, to deliver and record
sessions. Client information is processed by that provider on our behalf under
agreement. **[CLINIC TO CONFIRM and name any other providers — payments, email, etc.]**

## Disclosure
We do not sell your information. We may disclose it:
- to you;
- with your consent;
- to another health provider involved in your care, with your consent;
- where required or authorised by law.
We do **[not / — clinic to state]** disclose personal information overseas, except
insofar as a software or service provider stores data outside Australia — **[clinic
to confirm with each provider where data is hosted]**.

## Access and correction
You may ask to see the personal information we hold about you and ask us to correct
it. Contact us using the details above. We will respond within a reasonable time.

## Complaints and data breaches
If you are concerned about how we have handled your information, contact us first
using the details above. If unresolved, you may complain to the **Office of the
Australian Information Commissioner (OAIC)** at oaic.gov.au. We comply with the
**Notifiable Data Breaches** scheme and will notify you and the OAIC of an eligible
data breach as required by law.

Last updated: **[DATE]**

> **Clinic to review:** confirm where each provider hosts data (Australia or
> overseas), confirm your breach-response process, and have your adviser check this
> against your actual practices before publishing.$TPL$),
  ('health_safety', 'Health & Safety Policy',                  $TPL$**[CLINIC LEGAL NAME]** — ABN **[ABN]**

This policy sets out how we keep clients, staff, and visitors safe. It supports our
obligations under the **Work Health and Safety Act 2011 (Qld)** and related
regulations, and general duties of care we owe our clients.

## Our commitment
We provide a safe environment for vibroacoustic therapy and take reasonable steps to
identify and manage risks to health and safety.

## Client screening
Before each session, we screen clients for contraindications (see the Client Consent
form). Where a contraindication is present or suitability is uncertain, the
practitioner assesses whether to proceed, decline, modify the session, or request
medical clearance.

## Equipment
- The vibroacoustic bed, amplifier, and associated equipment are **[maintained /
  inspected]** **[frequency — e.g. before each use / weekly / per manufacturer
  guidance]**.
- Faulty equipment is taken out of use until repaired.
- Volume and intensity are set to safe, comfortable levels and adjusted to the client.
- **[CLINIC TO ADD electrical safety / test-and-tag arrangements as applicable]**

## Hygiene and infection control
- The bed surface and any client-contact points are cleaned between clients.
- Pillow coverings are **[changed / replaced]** between clients (clients are treated
  clothed).
- Hand hygiene facilities are available.
- **[CLINIC TO ADD its cleaning products / schedule and any infection-control
  requirements from its association or local health rules]**

## During the session
- The client can stop the session at any time.
- A practitioner is **[present / contactable]** **[clinic to state]** during sessions.
- Clients are given time to get up slowly and safely after a session.

## Incidents and emergencies
- Any incident, injury, or near-miss is recorded and reviewed.
- First-aid **[arrangements — clinic to state: trained staff / kit location]**.
- Emergency procedures: **[clinic to state — exits, emergency contacts]**.

## Staff
- Practitioners are trained in safe use of the equipment and in client screening.
- **[CLINIC TO ADD qualification / insurance / association-membership requirements]**

Last updated: **[DATE]**

> **Clinic to review:** WHS obligations depend on your premises, staff, and
> activities. Have this reviewed against your actual setup, your insurer's
> requirements, and current Queensland WHS regulation. If you have employees, your
> WHS duties are more extensive than a sole practitioner's.$TPL$)
ON CONFLICT (kind) DO NOTHING;