import type { Package } from './types';

// ── Treatment packages (single source of truth) ─────────────────────────────
// Fixed course bundles sold by the clinic. Feeds BOTH the admin "Start a
// package" booking flow and the marketing Pricing page, so prices/session
// counts can never drift between them. Prices are the clinic's canonical
// website prices. Every session is paired with microneedling; Elite tiers add
// one autologous-exosome visit as session 2.

const PRP_SESSION = { type: 'PRP + Microneedling', durationMin: 75 } as const;
const PRF_SESSION = { type: 'PRF + Microneedling', durationMin: 75 } as const;
const EXOSOME_VISIT = {
  position: 2,
  type: 'EV Enriched Plasma / Autologous Exosomes + Microneedling',
  durationMin: 120,
} as const;

export const PACKAGES: Package[] = [
  {
    id: 'prp-foundation',
    name: 'PRP Foundation',
    displayName: 'FOUNDATION PACKAGE',
    modality: 'prp',
    tier: 'foundation',
    sessionsPlanned: 3,
    cadenceWeeks: [4, 6],
    pricePence: 79500,
    session: PRP_SESSION,
    marketing: {
      subtitle: 'For early-stage thinning',
      features: ['3 PRP treatments', '3 Microneedling sessions', 'Structured clinical review'],
    },
  },
  {
    id: 'prp-intensive',
    name: 'PRP Intensive',
    displayName: 'INTENSIVE PACKAGE',
    modality: 'prp',
    tier: 'intensive',
    sessionsPlanned: 6,
    cadenceWeeks: [4, 6],
    pricePence: 150000,
    session: PRP_SESSION,
    marketing: {
      subtitle: 'For moderate or progressive hair thinning',
      isPopular: true,
      features: ['6 PRP treatments', '6 Microneedling sessions', 'Ongoing progress review'],
    },
  },
  {
    id: 'prp-elite',
    name: 'PRP Elite Regeneration',
    displayName: 'ELITE REGENERATION PACKAGE',
    modality: 'prp',
    tier: 'elite',
    sessionsPlanned: 7,
    cadenceWeeks: [4, 6],
    pricePence: 198500,
    session: PRP_SESSION,
    exosome: EXOSOME_VISIT,
    marketing: {
      subtitle: 'For significant or long-standing hair loss',
      features: [
        '6 PRP treatments',
        '1 Autologous Exosome therapy',
        '7 Microneedling sessions',
        'Long-term regenerative strategy',
      ],
    },
  },
  {
    id: 'prf-starter',
    name: 'PRF Starter',
    displayName: 'PRF STARTER PACKAGE',
    modality: 'prf',
    tier: 'starter',
    sessionsPlanned: 4,
    cadenceWeeks: [3, 4],
    pricePence: 92000,
    session: PRF_SESSION,
    marketing: {
      subtitle: 'For early-stage thinning',
      features: ['4 PRF treatments', '4 Microneedling sessions'],
    },
  },
  {
    id: 'prf-intensive',
    name: 'PRF Intensive',
    displayName: 'PRF INTENSIVE PACKAGE',
    modality: 'prf',
    tier: 'intensive',
    sessionsPlanned: 6,
    cadenceWeeks: [3, 4],
    pricePence: 138000,
    session: PRF_SESSION,
    marketing: {
      subtitle: 'For moderate or progressive thinning',
      isPopular: true,
      features: ['6 PRF treatments', '6 Microneedling sessions'],
    },
  },
  {
    id: 'prf-elite',
    name: 'PRF Elite',
    displayName: 'PRF + EXOSOME ELITE PACKAGE',
    modality: 'prf',
    tier: 'elite',
    sessionsPlanned: 7,
    cadenceWeeks: [3, 4],
    pricePence: 190000,
    session: PRF_SESSION,
    exosome: EXOSOME_VISIT,
    marketing: {
      subtitle: 'For significant or long-standing hair loss',
      features: [
        '6 PRF treatments',
        '1 Autologous Exosome therapy',
        '7 Microneedling sessions',
        'Long-term regenerative strategy',
      ],
    },
  },
];

/** Look up a package by id (undefined-safe). */
export const getPackage = (id?: string): Package | undefined =>
  id ? PACKAGES.find((p) => p.id === id) : undefined;

/** Format a pence price as "£1,985" (no decimals for whole pounds). */
export const formatPackagePrice = (pence: number): string => {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString('en-GB', {
    minimumFractionDigits: pounds % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

export const FORMS = [
  {
    id: 'prp-consent',
    title: 'PRP/Autologus Exosome Scalp Treatment Consent Form',
    content: `PRP/Autologus Exosome Scalp Treatment Consent Form
Patient Details:
• Name: 
• Date of Birth: 
• Address: 
• Phone Number: 
• Email: 

Treatment Details:
• Treatment Type: Platelet-Rich Plasma (PRP)/ Autologus Exosome Scalp Treatment
• Date of Appointment: 
• Time: 

Purpose of Treatment:
The purpose of the PRP/Autologus Exosome Scalp Treatment is to stimulate hair growth, reduce hair loss, and improve the quality of hair by using your own platelet-rich plasma (PRP) or platelet derived extracellular vesicles, which contains growth factors to nourish hair follicles and promote healthier, thicker hair.

Procedure:
• Blood Collection: A small amount of blood will be drawn from you.
• Processing: The blood is spun in a centrifuge to separate the PRP or exosomes.
• Injection: The concentrated PRP/exosomes are injected into the scalp in areas of thinning hair.

Risks and Side Effects:
While generally safe, potential risks include:
• Temporary swelling, redness, or bruising at injection sites.
• Mild headache or scalp tenderness.
• Infection (rare).
• Minimal or no improvement in hair growth (results vary).

Patient Declaration:
• I have been informed about the procedure, its purpose, and potential risks.
• I understand that multiple sessions may be required for optimal results.
• I have disclosed all medical conditions and medications I am currently taking.
• I consent to the PRP/Autologus Exosome Scalp Treatment.

Signature: 
Date: `
  },
  {
    id: 'microneedling-consent',
    title: 'Scalp Microneedling Consent Form',
    content: `Scalp Microneedling Consent Form
Patient Details:
• Name: 
• Date of Birth: 
• Address: 
• Phone Number: 
• Email: 

Treatment Details:
• Treatment Type: Scalp Microneedling
• Date of Appointment: 
• Time: 

Purpose of Treatment:
Microneedling involves using a device with fine needles to create micro-injuries in the scalp. This stimulates the body's natural healing process, increases blood flow, and enhances the absorption of topical hair growth treatments.

Procedure:
• The scalp is cleaned and a topical numbing agent may be applied.
• A microneedling device is passed over the treatment areas.
• A specialized serum may be applied during or after the procedure.

Risks and Side Effects:
• Temporary redness, swelling, or sensitivity.
• Minor bleeding or bruising.
• Risk of infection if post-care instructions are not followed.
• Skin irritation.

Patient Declaration:
• I understand the procedure and the expected outcomes.
• I have informed the practitioner of any skin conditions or allergies.
• I agree to follow the post-treatment care instructions provided.
• I consent to the Scalp Microneedling treatment.

Signature: 
Date: `
  },
  {
    id: 'aftercare-form',
    title: 'After care form',
    content: `After care form
Post-Treatment Instructions:
1. Do not wash your hair for at least 24 hours after treatment.
2. Avoid strenuous exercise and excessive sweating for 48 hours.
3. Avoid direct sunlight on the scalp for at least 7 days; wear a hat if necessary.
4. Do not use harsh hair products, dyes, or chemicals for 1 week.
5. Stay hydrated and follow a healthy diet to support hair growth.
6. If you experience unusual pain, significant swelling, or signs of infection, contact the clinic immediately.

Acknowledgment:
I have received and understood the aftercare instructions provided to me.

Signature: 
Date: `
  }
];
