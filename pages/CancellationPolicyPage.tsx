import React from 'react';
import { CalendarX2, FlaskConical, History, UserX } from 'lucide-react';

const CancellationPolicyPage: React.FC = () => {
  return (
    <div className="animate-fade-in px-6 md:px-20 pt-32 md:pt-44 pb-24 bg-cream min-h-screen">
      <div className="max-w-[800px] mx-auto bg-white rounded-[3rem] p-8 md:p-16 shadow-sm border border-gray-100">
        <h1 className="text-3xl md:text-5xl font-medium text-obsidian mb-4">Cancellation & Refund Policy</h1>
        <p className="text-primary font-bold uppercase text-xs mb-8 italic">Transparency & Fairness in Care</p>
        
        <div className="prose prose-sm md:prose-base text-muted max-w-none space-y-10">
          <p className="text-lg leading-relaxed">
            We understand that life can be unpredictable. At Novogenics, we strive to offer flexible care while maintaining fairness to all clients and the high standards of our at-home hair restoration treatment service.
          </p>

          <div className="bg-cream/50 p-6 rounded-2xl border-l-4 border-primary italic text-sm">
            By booking with us, you agree to the following terms. Please review our cancellation policy carefully before finalizing your appointment.
          </div>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
                <CalendarX2 size={18} className="text-primary font-bold" />
                <h2 className="text-2xl font-medium text-obsidian m-0">PRP Treatments</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                    <h4 className="font-bold text-obsidian mb-2">48+ Hours Notice</h4>
                    <p className="text-sm">You will receive a <strong>full refund for the single session</strong> or may reschedule your appointment free of charge up to 2 times.</p>
                </div>
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                    <h4 className="font-bold text-obsidian mb-2">Less than 48 Hours</h4>
                    <p className="text-sm">The full fee for that single session is <strong>non-refundable</strong>, however you may re-schedule up to 2 times.</p>
                </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
                <FlaskConical size={18} className="text-primary font-bold" />
                <h2 className="text-2xl font-medium text-obsidian m-0">Exosome Treatments</h2>
            </div>
            <p className="text-sm italic text-primary font-semibold">Due to the specialist equipment and preparation required:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                    <h4 className="font-bold text-obsidian mb-2">48+ Hours Notice</h4>
                    <p className="text-sm">You will receive a <strong>65% refund</strong> or may reschedule up to 2 times. 35% is retained to cover non-recoverable preparation costs.</p>
                </div>
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                    <h4 className="font-bold text-obsidian mb-2">Less than 48 Hours</h4>
                    <p className="text-sm">The full fee is <strong>non-refundable</strong>, however you may re-schedule up to 2 times.</p>
                </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
                <h3 className="text-xl font-extrabold text-obsidian flex items-center gap-2">
                    <History size={18} className="text-accent-gold" /> Repeated Cancellations
                </h3>
                <p className="text-sm leading-relaxed">
                    If a client cancels or reschedules more than 2 times, regardless of notice, the session will be lost with no refund.
                </p>
            </div>
            <div className="space-y-3">
                <h3 className="text-xl font-extrabold text-obsidian flex items-center gap-2">
                    <UserX size={18} className="text-accent-gold" /> No Show
                </h3>
                <p className="text-sm leading-relaxed">
                    If a client does not turn up to an appointment, there will be no refund or rearrangement for that single session.
                </p>
            </div>
          </section>

          <div className="pt-10 border-t border-gray-100 mt-12 text-center">
            <p className="font-bold text-obsidian mb-4">Questions about your booking?</p>
            <p className="text-muted mb-8">If you are unsure about your availability, we recommend booking only once you are sure of your attendance.</p>
            <p className="text-primary font-medium uppercase text-sm">Thank you for your understanding and cooperation.</p>
            
            <div className="mt-12 text-xs text-muted">
                <p>Novogenics Ltd</p>
                <p><a href="mailto:info@novogenics.co.uk" className="text-primary font-bold">info@novogenics.co.uk</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancellationPolicyPage;