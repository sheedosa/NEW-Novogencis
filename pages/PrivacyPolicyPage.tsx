import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="animate-fade-in px-6 md:px-20 pt-32 md:pt-44 pb-24 bg-cream min-h-screen">
      <div className="max-w-[800px] mx-auto bg-white rounded-[3rem] p-8 md:p-16 shadow-sm border border-gray-100">
        <h1 className="text-3xl md:text-5xl font-medium text-obsidian mb-4">Privacy Policy</h1>
        <p className="text-primary font-bold uppercase text-xs mb-8">Novogenics Privacy Policy</p>
        
        <div className="prose prose-sm md:prose-base text-muted max-w-none space-y-8">
          <p className="italic">Effective Date: June 2025</p>
          
          <p>
            At Novogenics, we are committed to protecting your privacy and handling your personal information with care and transparency. This Privacy Policy explains how we collect, use, store, and protect your data when you engage with our clinic and online services.
          </p>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">1. Who We Are</h2>
            <p>
              Novogenics is a UK-based private aesthetic hair restoration clinic specialising in hair loss and regenerative medicine. We comply with UK data protection laws and operate under the General Data Protection Regulation (GDPR).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">2. What Personal Information We Collect</h2>
            <p>We may collect and store the following types of personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Full name, date of birth, and contact information (e.g. address, phone number, email)</li>
              <li>Medical history, consultation records, treatment plans</li>
              <li>GP contact details (if provided)</li>
              <li>Payment and billing information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">3. How We Store Your Information</h2>
            <p>
              Personal health records, photographs and appointment information are stored in Google Cloud (Firebase) data centres located in the United Kingdom and the European Economic Area. Data in transit is protected by TLS 1.2 or higher, and Google Cloud encrypts data at rest using AES-256 by default. Access is gated by role-based security rules so that clients can only see their own records.
            </p>
            <p>
              Only authorised clinicians (currently Dr. Aminah Amer, clinic owner and practitioner) have access to your full clinical record. All administrative access is logged.
            </p>
            <p>
              If you would like more detail about our technical safeguards or to raise a data-protection concern, please email <a href="mailto:privacy@novogenics.co.uk" className="underline">privacy@novogenics.co.uk</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">4. How We Use Your Information</h2>
            <p>Your data is used for the purpose of:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Booking and managing appointments</li>
              <li>Providing consultations and treatments</li>
              <li>Creating treatment records and clinical notes</li>
              <li>Communicating with you regarding your care</li>
            </ul>
            <p>We may also use anonymised data for service improvement, audits, or research purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">5. Sharing Your Information</h2>
            <p>Your personal data will never be sold or shared for marketing purposes.</p>
            <p>We may share your information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>With your GP or other healthcare providers, but only with your explicit consent</li>
              <li>With emergency services, if there is a serious concern for your safety or in life-threatening situations where consent cannot be obtained, and disclosure is in your best interest</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">6. Your Rights</h2>
            <p>Under GDPR, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your data (where legally applicable)</li>
              <li>Withdraw your consent at any time</li>
              <li>Lodge a complaint with the Information Commissioner’s Office (ICO)</li>
            </ul>
            <p>To exercise your rights, please contact us at: <a href="mailto:info@novogenics.co.uk" className="text-primary font-bold">info@novogenics.co.uk</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">7. Data Retention</h2>
            <p>
              We retain medical records for a minimum of 8 years after your last appointment, in line with UK clinical record-keeping standards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">8. Security Measures</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Our practice management system encrypts all stored and transmitted data</li>
              <li>Two-factor authentication is used for all administrative account access</li>
              <li>Devices used for clinical access are password-protected and regularly updated</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-obsidian mb-3">9. Updates to This Policy</h2>
            <p>
              This Privacy Policy may be updated from time to time. The most recent version will always be available on our website.
            </p>
          </section>

          <div className="pt-10 border-t border-gray-100 mt-12 text-sm">
            <p className="font-bold">For any questions or concerns about your privacy, please contact us at:</p>
            <p><a href="mailto:info@novogenics.co.uk" className="text-primary">info@novogenics.co.uk</a></p>
            <p className="mt-4 font-bold">Novogenics Ltd</p>
            <p>Hair Loss Restoration • Regenerative Medicine</p>
            <p><a href="http://www.novogenics.co.uk" className="text-primary">www.novogenics.co.uk</a></p>
            <p className="mt-4 italic">This policy was last updated on June 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;