/**
 * Email template IDs and configuration for EmailJS.
 * Map each notification type to its EmailJS template.
 */

export const EMAIL_CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '',
  adminEmail: import.meta.env.VITE_ADMIN_NOTIFICATION_EMAIL || '',
};

export const EMAIL_TEMPLATES = {
  // Admin-bound emails
  new_assessment: import.meta.env.VITE_EMAILJS_TEMPLATE_NEW_ASSESSMENT || '',
  new_message_admin: import.meta.env.VITE_EMAILJS_TEMPLATE_NEW_MESSAGE_ADMIN || '',
  form_signed: import.meta.env.VITE_EMAILJS_TEMPLATE_FORM_SIGNED || '',

  // Client-bound emails
  new_message_client: import.meta.env.VITE_EMAILJS_TEMPLATE_NEW_MESSAGE_CLIENT || '',
  feedback_received: import.meta.env.VITE_EMAILJS_TEMPLATE_FEEDBACK_RECEIVED || '',
  appointment_confirmed: import.meta.env.VITE_EMAILJS_TEMPLATE_APPOINTMENT_CONFIRMED || '',
  payment_received: import.meta.env.VITE_EMAILJS_TEMPLATE_PAYMENT_RECEIVED || '',
  welcome: import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME || '',
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
