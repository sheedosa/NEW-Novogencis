/**
 * The clinic's persistent "test patient" identity.
 *
 * Used for two related but distinct purposes:
 *
 *   1. The Firestore client record at `/clients/{DUMMY_PATIENT.id}` — a real
 *      document seeded with realistic data (upcoming appointment, treatment
 *      plan, payments, messages, signed + unsigned forms). Bootstrapped from
 *      the Platform Health panel (tech admin only).
 *
 *   2. A synthetic `User` object that admins (Rasheed, Dr Aminah, Dr Waqas)
 *      can switch into via the sidebar account menu. When active, the platform
 *      renders ClientDashboard with this user, so the admin sees exactly what
 *      a patient sees — including any new feature shipped. No real auth swap
 *      happens; the admin remains signed in as themselves throughout.
 *
 * The ID is fixed so the same record is shared across all clinic devices and
 * survives bootstraps without orphaning history.
 */
import type { User, Client, Appointment, Message, TreatmentPlan, Payment } from '../types';

export const DUMMY_PATIENT = {
  id:       'dummy-patient-novogenics',
  email:    'dummy_patient@novogenics.internal',
  fullName: 'Test Patient (Demo)',
  username: 'dummy_patient',
} as const;

/** Synthetic User object handed to ClientDashboard during preview mode. */
export const dummyPatientUser: User = {
  id:               DUMMY_PATIENT.id,
  email:            DUMMY_PATIENT.email,
  fullName:         DUMMY_PATIENT.fullName,
  username:         DUMMY_PATIENT.username,
  role:             'client',
  policiesAccepted: true,
  createdAt:        '2026-01-01T00:00:00.000Z',
};

/**
 * Build a fresh seed payload for the dummy patient. Called when admin clicks
 * "Reset dummy patient data" — wipes and recreates so the test data always
 * reflects today's date, not whenever it was first seeded.
 */
export function buildDummyPatientSeed(): { client: Client; appointments: Appointment[]; messages: Omit<Message, 'id'>[] } {
  const today = new Date();
  const iso = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };
  const nowIso = today.toISOString();

  const treatmentPlan: TreatmentPlan = {
    id: 'plan-dummy-1',
    clientId: DUMMY_PATIENT.id,
    title: 'EV-Enriched Plasma Programme — 6 sessions',
    phases: [
      { id: 'phase-1', name: 'Initial loading',     description: 'Three sessions, 4 weeks apart', status: 'Active',    sessionsPlanned: 3, sessionsCompleted: 1, startDate: iso(-30), notes: 'Tolerating well.' },
      { id: 'phase-2', name: 'Consolidation',       description: 'Two sessions, 6 weeks apart',   status: 'Planned',   sessionsPlanned: 2, sessionsCompleted: 0 },
      { id: 'phase-3', name: 'Maintenance review',  description: 'Single review session',          status: 'Planned',   sessionsPlanned: 1, sessionsCompleted: 0 },
    ],
    adminNotes: 'Patient is enrolled on the 6-session programme.',
    createdAt: nowIso,
  };

  const payments: Payment[] = [
    { id: 'pay-1', description: 'EV-Enriched Plasma · Session 1', amount: 600, currency: 'GBP', status: 'Paid',    paidDate: iso(-28), createdAt: iso(-30), reference: 'INV-1001' },
    { id: 'pay-2', description: 'EV-Enriched Plasma · Session 2', amount: 600, currency: 'GBP', status: 'Pending', dueDate:  iso(7),   createdAt: iso(-3),  reference: 'INV-1002' },
  ];

  const client: Client = {
    id:               DUMMY_PATIENT.id,
    name:             DUMMY_PATIENT.fullName,
    gender:           'female',
    email:            DUMMY_PATIENT.email,
    phone:            '07700 900900',
    dob:              '1992-04-12',
    address:          '1 Demo Street, Cheadle, SK8 1AA',
    package:          'EV-Enriched Plasma — 6 session programme',
    status:           'Active',
    policiesAccepted: true,
    doctorPreference: 'female-only',
    createdAt:        '2026-01-15T10:00:00.000Z',
    internalNotes:    'Test patient — used by clinic staff to preview the patient portal.',
    treatmentPlan,
    payments,
    gallery: [],
    completedForms: [
      { formId: 'prp-consent', title: 'PRP Consent Form', signedAt: '2026-01-20T10:00:00.000Z', formData: { name: DUMMY_PATIENT.fullName }, signature: 'data:image/png;base64,' },
    ],
    assessmentData: {
      answers: {
        f1: { text: 'When did you first notice hair changes?', value: 'About 18 months ago' },
        f3: { text: 'Is there a family history?',               value: 'Yes — maternal grandmother' },
      },
      screening: { conditions: [], suitability: 'Cleared for protocol' },
      clinicalFeedback: 'Patient is an excellent candidate for the EV-Enriched Plasma protocol. Recommend the 6-session loading + consolidation programme.',
      reviewDate: '2026-01-18T09:30:00.000Z',
    },
  };

  const appointments: Appointment[] = [
    { id: 'apt-dummy-1', clientId: DUMMY_PATIENT.id, clientName: DUMMY_PATIENT.fullName, type: 'EV-Enriched Plasma Session', date: iso(-28), time: '10:00 AM', status: 'Completed', notes: 'Session went smoothly. Mild redness at scalp, no other issues.', createdAt: iso(-35) },
    { id: 'apt-dummy-2', clientId: DUMMY_PATIENT.id, clientName: DUMMY_PATIENT.fullName, type: 'EV-Enriched Plasma Session', date: iso(7),   time: '02:00 PM', status: 'Confirmed', notes: '',                                                                                createdAt: iso(-3)  },
  ];

  const messages: Omit<Message, 'id'>[] = [
    {
      senderId: DUMMY_PATIENT.id, recipientId: 'admin',
      subject: 'Question about aftercare',
      body: 'Hi clinic — is it ok to use my regular shampoo on day 3? Thanks.',
      read: false, createdAt: new Date(today.getTime() - 86400000 * 2).toISOString(),
    },
    {
      senderId: 'admin', recipientId: DUMMY_PATIENT.id,
      subject: 'Please complete and sign',
      body: 'Please review and sign your aftercare form before your next session.',
      type: 'form', formId: 'aftercare-form', isSigned: false,
      read: false, createdAt: new Date(today.getTime() - 86400000).toISOString(),
    },
  ];

  return { client, appointments, messages };
}
