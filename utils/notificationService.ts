import { collection, addDoc, serverTimestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppNotification } from '../types';

/*
 * In-app notifications only. EMAIL is handled server-side: the
 * `onNotificationCreated` Cloud Function watches the `notifications` collection
 * and sends the emailable subset via Resend (functions/src/emailService.ts).
 * So these helpers just write the Firestore notification — the email follows
 * automatically.
 *
 * The `clientEmail` parameters are retained for call-site compatibility; the
 * recipient's address is now resolved server-side from the client/user doc.
 */

/**
 * Write a notification document to the `notifications` collection in Firestore.
 * This write is what triggers the server-side email (see onNotificationCreated).
 */
export const createNotification = async (
  payload: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<void> => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Notification] Failed to create notification:', error);
  }
};

/**
 * Mark a single notification as read.
 */
export const markNotificationRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    console.error('[Notification] Failed to mark as read:', error);
  }
};

/**
 * Per-admin read state. Admin notifications are a single shared doc
 * (recipientId 'all-admins'), so each admin's "seen" state is tracked in a
 * `readBy` array of user ids rather than the single `read` boolean. Marking
 * read appends this admin's id (arrayUnion is idempotent).
 */
export const markAdminNotificationRead = async (notificationId: string, adminId: string): Promise<void> => {
  if (!adminId) return;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { readBy: arrayUnion(adminId) });
  } catch (error) {
    console.error('[Notification] Failed to mark admin-read:', error);
  }
};

// ─── Convenience notification creators ─────────────────────────────────────

/** Notify all admins that a new assessment was submitted */
export const notifyNewAssessment = async (clientName: string, clientId: string, clientEmail: string) => {
  await createNotification({
    recipientId: 'all-admins',
    recipientRole: 'admin',
    type: 'new_assessment',
    title: 'New Assessment Submitted',
    body: `${clientName} has submitted a new hair assessment and is awaiting clinical review.`,
    metadata: { clientId },
  });
};

/** Notify a client that their doctor sent them a message */
export const notifyClientNewMessage = async (
  clientId: string,
  clientEmail: string,
  clientName: string,
  messagePreview: string
) => {
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'new_message',
    title: 'New Message from Your Clinic',
    body: messagePreview.length > 80 ? messagePreview.slice(0, 80) + '…' : messagePreview,
    metadata: { clientId },
  });
};

/** Notify admins that a client sent a message */
export const notifyAdminNewMessage = async (clientName: string, clientId: string, messagePreview: string) => {
  await createNotification({
    recipientId: 'all-admins',
    recipientRole: 'admin',
    type: 'new_message',
    title: `Message from ${clientName}`,
    body: messagePreview.length > 80 ? messagePreview.slice(0, 80) + '…' : messagePreview,
    metadata: { clientId },
  });
};

/** Notify a client that clinical feedback is available */
export const notifyFeedbackReceived = async (
  clientId: string,
  clientEmail: string,
  clientName: string
) => {
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'feedback_received',
    title: 'Clinical Feedback Available',
    body: 'Your Novogenics doctor has reviewed your assessment and left you clinical feedback.',
    metadata: { clientId },
  });
};

/** Notify a client that their treatment plan is ready to view */
export const notifyTreatmentPlanReady = async (
  clientId: string,
  clientEmail: string,
  clientName: string,
  planTitle: string
) => {
  // Server-side email uses a non-clinical body (omits the plan title) — GDPR.
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'treatment_plan_ready',
    title: 'Your Treatment Plan Is Ready',
    body: `Your clinician has created your plan: "${planTitle}". Open My care to see the steps.`,
    metadata: { clientId },
  });
};

/** Notify a client that a prescription was added to their record */
export const notifyPrescriptionAdded = async (
  clientId: string,
  clientEmail: string,
  clientName: string,
  drugName: string
) => {
  // Server-side email omits the drug name (GDPR-conservative).
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'prescription_added',
    title: 'New Prescription Added',
    body: `Your clinician has added ${drugName} to your treatment. Open My care for the instructions.`,
    metadata: { clientId },
  });
};

/** Notify a client that a form was sent to them (in-app only — no email) */
export const notifyFormSent = async (
  clientId: string,
  clientEmail: string,
  clientName: string,
  formTitle: string
) => {
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'form_sent',
    title: 'Document Requires Your Signature',
    body: `Please review and sign: "${formTitle}"`,
    metadata: { clientId },
  });
};

/** Notify admins that a client signed a form */
export const notifyFormSigned = async (clientName: string, clientId: string, formTitle: string) => {
  await createNotification({
    recipientId: 'all-admins',
    recipientRole: 'admin',
    type: 'form_signed',
    title: 'Form Signed',
    body: `${clientName} has signed "${formTitle}".`,
    metadata: { clientId },
  });
};

/** Notify a client that their appointment was confirmed */
export const notifyAppointmentConfirmed = async (
  clientId: string,
  clientEmail: string,
  clientName: string,
  appointmentType: string,
  date: string,
  time: string
) => {
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'appointment_confirmed',
    title: 'Appointment Confirmed',
    body: `Your ${appointmentType} is confirmed for ${date} at ${time}.`,
    metadata: { clientId },
  });
};

/** Notify a client that a payment link was sent */
export const notifyPaymentSent = async (
  clientId: string,
  clientEmail: string,
  clientName: string,
  amount: string
) => {
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'payment_received',
    title: 'Payment Requested',
    body: `A payment${amount ? ` of ${amount}` : ''} has been requested by the clinic. Any secure payment link will appear in your Messages.`,
    metadata: { clientId },
  });
};

/** Send welcome notification to a new client */
export const notifyWelcome = async (
  clientId: string,
  clientEmail: string,
  clientName: string
) => {
  await createNotification({
    recipientId: clientId,
    recipientRole: 'client',
    type: 'welcome',
    title: 'Welcome to Novogenics',
    body: 'Your account has been created. Your clinical team will review your assessment shortly.',
    metadata: { clientId },
  });
};
