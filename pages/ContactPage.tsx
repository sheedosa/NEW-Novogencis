import React from 'react';

const ContactPage: React.FC = () => {
  return (
    <div className="animate-fade-in px-6 md:px-20 pt-32 md:pt-44 pb-24 bg-bg-soft">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div className="flex flex-col gap-10">
          <div>
            <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight leading-tight">Get in Touch</h1>
            <p className="text-text-muted text-xl leading-relaxed">
              Ready to take the first step? We're here to help you rediscover your confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <span className="material-symbols-outlined text-primary text-3xl mb-4">call</span>
              <h4 className="font-bold text-lg mb-1 tracking-tight">Call Us</h4>
              <p className="text-text-muted text-sm">
                <a href="tel:+447356255598" className="hover:text-primary transition-colors">+44 7356255598</a>
              </p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <span className="material-symbols-outlined text-primary text-3xl mb-4">mail</span>
              <h4 className="font-bold text-lg mb-1 tracking-tight">Email Us</h4>
              <p className="text-text-muted text-sm">
                <a href="mailto:Info@novogenics.co.uk" className="hover:text-primary transition-colors">Info@novogenics.co.uk</a>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl">
          <h3 className="text-2xl font-extrabold mb-8 text-text-main tracking-tight">Send us a message</h3>
          <form className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-main">First Name*</label>
                <input type="text" required className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-main">Last Name</label>
                <input type="text" className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-main">Your Email*</label>
              <input type="email" required className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-main">Preferred Contact Method</label>
              <select className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3">
                <option>Email</option>
                <option>Phone</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-main">Message*</label>
              <textarea required rows={4} className="w-full bg-gray-50 border-gray-100 rounded-xl focus:ring-primary focus:border-primary px-4 py-3"></textarea>
            </div>
            <button className="w-full bg-primary hover:bg-accent-gold text-white font-black py-4 rounded-full transition-all shadow-lg shadow-primary/20">
              Submit Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;