import { collection, addDoc, serverTimestamp, query, where, updateDoc, doc } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { db } from '../firebase';
import { EMAIL_CONFIG, EMAIL_TEMPLATES, EmailTemplateKey } from './emailTemplates';
import type { AppNotification } from '../types';

// Initialise EmailJS once
let emailjsInitialised = false;
function ensureEmailJS() {
  if (!emailjsInitialised && EMAIL_CONFIG.publicKey) {
    emailjs.init({ publicKey: EMAIL_CONFIG.publicKey });
    emailjsInitialised = true;
  }
}

/**
 * Write a notification document to the `notifications` collection in Firestore.
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
 * Send an email notification via EmailJS.
 * Fails silently so it never blocks a clinical action.
 */
export const sendEmailNotification = async (
  templateKey: EmailTemplateKey,
  templateParams: Record<string, string>
): Promise<void> => {
  const templateId = EMAIL_TEMPLATES[templateKey];

  if (!EMAIL_CONFIG.serviceId || !EMAIL_CONFIG.publicKey || !templateId) {
    console.warn(`[EmailJS] Skipping email — config not set for template: ${templateKey}`);
    return;
  }

  try {
    ensureEmailJS();
    await emailjs.send(EMAIL_CONFIG.serviceId, templateId, templateParams);
  } catch (error) {
    console.error(`[EmailJS] Failed to send email (${templateKey}):`, error);
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

  await sendEmailNotification('new_assessment', {
    to_email: EMAIL_CONFIG.adminEmail,
    client_name: clientName,
    client_email: clientEmail,
    dashboard_url: window.location.origin,
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

  await sendEmailNotification('new_message_client', {
    to_email: clientEmail,
    client_name: clientName,
    message_preview: messagePreview.slice(0, 200),
    dashboard_url: window.location.origin,
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

  await sendEmailNotification('new_message_admin', {
    to_email: EMAIL_CONFIG.adminEmail,
    client_name: clientName,
    message_preview: messagePreview.slice(0, 200),
    dashboard_url: window.location.origin,
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

  await sendEmailNotification('feedback_received', {
    to_email: clientEmail,
    client_name: clientName,
    dashboard_url: window.location.origin,
  });
};

/** Notify a client that a form was sent to them */
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

  await sendEmailNotification('form_signed', {
    to_email: EMAIL_CONFIG.adminEmail,
    client_name: clientName,
    form_title: formTitle,
    dashboard_url: window.location.origin,
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

  await sendEmailNotification('appointment_confirmed', {
    to_email: clientEmail,
    client_name: clientName,
    appointment_type: appointmentType,
    appointment_date: date,
    appointment_time: time,
    dashboard_url: window.location.origin,
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
    title: 'Payment Link Received',
    body: `A payment link${amount ? ` for ${amount}` : ''} has been sent to you by the clinic.`,
    metadata: { clientId },
  });

  await sendEmailNotification('payment_received', {
    to_email: clientEmail,
    client_name: clientName,
    amount,
    dashboard_url: window.location.origin,
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

  await sendEmailNotification('welcome', {
    to_email: clientEmail,
    client_name: clientName,
    dashboard_url: window.location.origin,
  });
};
