import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logClinicalAction } from './auditLogger';

/**
 * GDPR / DPA 2018 helpers.
 *
 * - exportClientData implements Article 20 (right to data portability) by
 *   bundling every Firestore document linked to a patient into a single
 *   JSON file the operator can hand to the patient.
 * - erasePatientRecord implements Article 17 (right to erasure) as a
 *   pseudonymisation: PII fields are overwritten with redacted markers
 *   and the account is flagged erasedAt. Clinical data is kept (in an
 *   anonymised form) to satisfy UK medical-records retention duties.
 *
 * True hard-deletion of the Firebase Auth user requires the Admin SDK
 * and therefore a Cloud Function. Until that is in place, AuthPages
 * checks erasedAt on sign-in and refuses access.
 */

export interface ExportedPatientRecord {
  exportedAt: string;
  exportedBy: string;
  schemaVersion: 1;
  user: Record<string, unknown> | null;
  client: Record<string, unknown> | null;
  appointments: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
}

export async function exportClientData(clientId: string, adminId: string): Promise<ExportedPatientRecord> {
  const [userSnap, clientSnap, apptSnap, msgsSentSnap, msgsRecvSnap, notifSnap] = await Promise.all([
    getDoc(doc(db, 'users', clientId)),
    getDoc(doc(db, 'clients', clientId)),
    getDocs(query(collection(db, 'appointments'), where('clientId', '==', clientId))),
    getDocs(query(collection(db, 'messages'), where('senderId', '==', clientId))),
    getDocs(query(collection(db, 'messages'), where('recipientId', '==', clientId))),
    getDocs(query(collection(db, 'notifications'), where('recipientId', '==', clientId))),
  ]);

  const messages = new Map<string, Record<string, unknown>>();
  [...msgsSentSnap.docs, ...msgsRecvSnap.docs].forEach(d => messages.set(d.id, { id: d.id, ...d.data() }));

  const bundle: ExportedPatientRecord = {
    exportedAt: new Date().toISOString(),
    exportedBy: adminId,
    schemaVersion: 1,
    user: userSnap.exists() ? userSnap.data() : null,
    client: clientSnap.exists() ? clientSnap.data() : null,
    appointments: apptSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    messages: [...messages.values()],
    notifications: notifSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };

  await logClinicalAction(adminId, 'export_client_data', clientId, 'Generated GDPR data export');
  return bundle;
}

/** Trigger a JSON file download in the browser. */
export function downloadAsJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const REDACTED = '[REDACTED]';

export async function erasePatientRecord(clientId: string, adminId: string): Promise<void> {
  const erasedAt = new Date().toISOString();

  // Anonymise the client clinical record but keep treatment events.
  await updateDoc(doc(db, 'clients', clientId), {
    name: REDACTED,
    email: REDACTED,
    phone: REDACTED,
    dob: REDACTED,
    address: REDACTED,
    allergies: REDACTED,
    medicalHistory: REDACTED,
    internalNotes: REDACTED,
    gallery: [],
    assessmentData: null,
    completedForms: [],
    erasedAt,
    status: 'Erased',
  });

  // Anonymise and flag the user account so sign-in is refused.
  await updateDoc(doc(db, 'users', clientId), {
    fullName: REDACTED,
    email: REDACTED,
    username: REDACTED,
    erasedAt,
  });

  await logClinicalAction(adminId, 'erase_patient_record', clientId, 'Anonymised patient record under GDPR Art. 17');
}
