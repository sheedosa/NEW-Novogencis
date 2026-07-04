import React, { useState } from 'react';
import { Phone, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { sendContactFormEmail } from '../utils/notificationService';

type SubmitStatus = 'idle' | 'sending' | 'sent' | 'failed';

const ContactPage: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState('Email');
  const [message, setMessage] = useState('');
  // Honeypot — invisible to humans; bots that fill it get a silent no-op.
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;

    if (company.trim() !== '') {
      // Honeypot tripped — pretend success without sending anything.
      setStatus('sent');
      return;
    }

    setStatus('sending');
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const ok = await sendContactFormEmail(fullName, email.trim(), method, message.trim());
    setStatus(ok ? 'sent' : 'failed');
  };

  return (
    <div className="animate-fade-in px-6 md:px-20 pt-32 md:pt-44 pb-24 bg-cream">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div className="flex flex-col gap-10">
          <div>
            <h1 className="text-4xl md:text-6xl font-medium mb-6 tracking-tight leading-tight">Get in Touch</h1>
            <p className="text-muted text-xl leading-relaxed">
              Ready to take the first step? We're here to help you rediscover your confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <Phone size={24} className="text-primary mb-4" />
              <h4 className="font-bold text-lg mb-1 tracking-tight">Call Us</h4>
              <p className="text-muted text-sm">
                <a href="tel:+447356255598" className="hover:text-primary transition-colors">+44 7356255598</a>
              </p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <Mail size={24} className="text-primary mb-4" />
              <h4 className="font-bold text-lg mb-1 tracking-tight">Email Us</h4>
              <p className="text-muted text-sm">
                <a href="mailto:Info@novogenics.co.uk" className="hover:text-primary transition-colors">Info@novogenics.co.uk</a>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl">
          {status === 'sent' ? (
            <div className="flex flex-col items-center text-center gap-5 py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={30} className="text-emerald-600" />
              </div>
              <h3 className="text-2xl font-extrabold text-obsidian tracking-tight">Message sent</h3>
              <p className="text-muted leading-relaxed max-w-sm">
                Thank you — your message is with the clinic. We aim to reply within one working day.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-2xl font-extrabold mb-8 text-obsidian tracking-tight">Send us a message</h3>
              {status === 'failed' && (
                <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm p-4 rounded-2xl">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p>
                    Sorry — your message could not be sent just now. Please email us directly at{' '}
                    <a href="mailto:Info@novogenics.co.uk" className="font-bold underline underline-offset-2">Info@novogenics.co.uk</a>{' '}
                    or call <a href="tel:+447356255598" className="font-bold underline underline-offset-2">+44 7356255598</a>.
                    Your message is still in the form below.
                  </p>
                </div>
              )}
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="contact-first-name" className="text-sm font-bold text-obsidian">First Name*</label>
                    <input
                      id="contact-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-last-name" className="text-sm font-bold text-obsidian">Last Name</label>
                    <input
                      id="contact-last-name"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-email" className="text-sm font-bold text-obsidian">Your Email*</label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-method" className="text-sm font-bold text-obsidian">Preferred Contact Method</label>
                  <select
                    id="contact-method"
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3"
                  >
                    <option>Email</option>
                    <option>Phone</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-message" className="text-sm font-bold text-obsidian">Message*</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3"
                  ></textarea>
                </div>
                {/* Honeypot — hidden from humans (and from screen readers). */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="contact-company">Company</label>
                  <input
                    id="contact-company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className={`w-full font-medium py-4 rounded-full transition-all shadow-lg shadow-primary/20 ${
                    status === 'sending'
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-primary hover:bg-accent-gold text-white'
                  }`}
                >
                  {status === 'sending' ? 'Sending…' : 'Submit Message'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
