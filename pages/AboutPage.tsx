import React from 'react';
import { Page } from '../types';
import { BadgeCheck, MapPin, Phone } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (page: Page) => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  // Direct serving URL for Dr. Amer's image
  const drAmerImgUrl = "https://lh3.googleusercontent.com/d/1YZP8Ey7efS4TDkira7M9cTkzDNo9zwW7";
  
  // Direct serving URL for Dr. Farid's image
  const drFaridImgUrl = "https://lh3.googleusercontent.com/d/1ytEpSn_daHfMDF9qcMlKXuVp9uy78OUG";
  
  // Direct serving URL for the Clinic Space image
  const clinicSpaceImgUrl = "https://lh3.googleusercontent.com/d/1_OpdNoH5ZzlXJuAbP5Yf0QeDW5KpXmlh";

  return (
    <div className="animate-fade-in bg-cream">
      {/* Refined Hero Section aligned with FAQ/Blog style */}
      <section className="relative px-6 md:px-20 pt-32 md:pt-44 pb-16 md:pb-24 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white/50 -skew-x-12 translate-x-1/4 pointer-events-none" />
        <div className="hidden lg:block absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="text-center mb-16 md:mb-24">
            <span className="text-primary font-medium text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-4 animate-fade-in">
              The Heart of Our Practice
            </span>
            <h1 className="text-5xl md:text-9xl font-medium text-obsidian tracking-tighter leading-[0.9] mb-10 animate-fade-up">
              <span className="block opacity-90">Empowering</span>
              <span className="block text-primary italic font-serif -mt-2 md:-mt-4">Confidence</span>
              <div className="flex items-center justify-center gap-4 mt-8">
                <div className="h-[1px] flex-grow bg-black/5 max-w-[100px] hidden md:block" />
                <span className="text-[10px] md:text-xs font-medium uppercase tracking-[0.6em] text-muted whitespace-nowrap">Through Regenerative Medicine</span>
                <div className="h-[1px] flex-grow bg-black/5 max-w-[100px] hidden md:block" />
              </div>
            </h1>
            <p className="text-muted text-lg md:text-xl max-w-3xl mx-auto font-medium animate-fade-up delay-100">
              At Novogenics, our mission is to help clients facing hair loss by offering safe, ethical and evidence-based regenerative treatments in a private, compassionate setting.
            </p>
            <div className="mt-12 w-24 h-1 bg-primary/20 mx-auto rounded-full" />
          </div>
        </div>
      </section>

      {/* Meet Dr. Amer */}
      <section className="px-6 md:px-20 py-24 bg-white border-b border-black/5">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="w-full md:w-1/3">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary rotate-6 rounded-[2.5rem] -z-10 opacity-20 group-hover:rotate-3 transition-transform duration-700"></div>
              <div className="overflow-hidden rounded-[2.5rem] shadow-2xl">
                <img 
                  src={drAmerImgUrl} 
                  alt="Dr. Aminah Amer at Novogenics" 
                  className="w-full aspect-[3/4] object-cover transition-transform duration-1000 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
          <div className="w-full md:w-2/3 flex flex-col gap-6">
            <p className="text-primary font-bold uppercase tracking-[0.3em] text-[10px] md:text-xs">Our Founder</p>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">Meet Dr. <span className="text-primary italic font-serif">Aminah Amer.</span></h2>
            <div className="p-8 bg-cream rounded-[2rem] border-l-8 border-primary shadow-xl shadow-primary/5">
              <p className="text-muted text-lg md:text-xl leading-relaxed italic font-serif">
                "My passion for evidence-based, client-centred care drives everything we do at Novogenics. We want every client to feel heard, seen, and supported."
              </p>
            </div>
            <p className="text-obsidian text-lg font-medium leading-relaxed">
              Dr. Aminah Amer is a qualified GP and Sports & Exercise Medicine doctor with specialised training in regenerative medicine and hair loss restoration.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {[
                "General Practitioner (GP)",
                "Sports & Exercise Medicine Doctor",
                "Specialised Training in Regenerative Medicine",
                "Expert in Hair Loss Treatment"
              ].map(qual => (
                <div key={qual} className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-black/5 shadow-sm hover:border-primary/30 transition-colors group">
                  <BadgeCheck size={18} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium uppercase text-obsidian">{qual}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Meet Dr. Farid */}
      <section className="px-6 md:px-20 py-24 bg-white">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row-reverse items-center gap-16">
          <div className="w-full md:w-1/3">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary -rotate-6 rounded-[2.5rem] -z-10 opacity-20 group-hover:-rotate-3 transition-transform duration-700"></div>
              <div className="overflow-hidden rounded-[2.5rem] shadow-2xl">
                <img 
                  src={drFaridImgUrl} 
                  alt="Dr. Waqass Farid at Novogenics" 
                  className="w-full aspect-[3/4] object-cover transition-transform duration-1000 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
          <div className="w-full md:w-2/3 flex flex-col gap-6">
            <p className="text-primary font-bold uppercase tracking-[0.3em] text-[10px] md:text-xs">Clinical Team</p>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">Meet Dr. <span className="text-primary italic font-serif">Waqass Farid.</span></h2>
            <div className="p-8 bg-cream rounded-[2rem] border-l-8 border-primary shadow-xl shadow-primary/5">
              <p className="text-muted text-lg md:text-xl leading-relaxed italic font-serif">
                "As an NHS GP, I believe clients deserve safe, evidence-based care delivered with integrity and precision. My goal is to help restore confidence and wellbeing using advanced aesthetic regenerative techniques."
              </p>
            </div>
            <p className="text-obsidian text-lg font-medium leading-relaxed">
              Dr. Waqass Farid is an experienced NHS General Practitioner with additional training in regenerative medicine. His clinical foundation in the NHS underpins a careful, client-centred approach focused on safety, transparency and long-term outcomes.
            </p>
            <p className="text-muted text-lg font-medium leading-relaxed">
              Alongside his primary care work, Dr Farid has developed expertise in advanced aesthetic hair regenerative therapies, helping clients address hair thinning and loss with modern, minimally invasive treatments designed to stimulate natural restoration and improve confidence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {[
                "NHS General Practitioner (GP)",
                "Training in Regenerative Medicine",
                "Advanced Aesthetic Hair Therapies",
                "Client-Centred Clinical Care"
              ].map(qual => (
                <div key={qual} className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-black/5 shadow-sm hover:border-primary/30 transition-colors group">
                  <BadgeCheck size={18} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium uppercase text-obsidian">{qual}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 md:px-20 py-24 bg-obsidian text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-[1440px] mx-auto relative z-10">
          <h2 className="text-3xl md:text-5xl font-medium text-center mb-20 tracking-tight leading-tight">What Sets Us <span className="text-primary italic font-serif">Apart</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-12">
            {[
              { title: "Evidence-Based", desc: "Every treatment we offer is grounded in peer-reviewed research and clinical evidence." },
              { title: "Client-Centred", desc: "We understand the unique challenges of hair loss and tailor our approach accordingly." },
              { title: "Ethical Practice", desc: "We use only autologous treatments - your body's own power - no hormones." },
              { title: "Private", desc: "Your comfort is paramount in our calm, respectful clinic environment." },
              { title: "Personalised", desc: "No two clients are the same. We create bespoke treatment plans." }
            ].map((val, i) => (
              <div key={i} className="flex flex-col gap-6 group">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-primary font-medium text-xl border border-white/10 group-hover:bg-primary group-hover:text-clinical-dark transition-all duration-500">{i+1}</div>
                <h4 className="font-medium text-lg tracking-tight uppercase text-sm">{val.title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{val.desc}</p>
                <div className="w-0 h-[1px] bg-primary group-hover:w-full transition-all duration-1000" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clinic Section */}
      <section className="px-6 md:px-20 py-24 bg-white">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-cream text-muted border border-black/5 w-fit">
              <MapPin size={16} />
              <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.25em]">Our Environment</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">Your Comfortable, <br/><span className="text-primary italic font-serif">Private</span> Space</h2>
            <p className="text-muted text-lg leading-relaxed font-medium">
              Located in Cheadle, our clinic has been designed with your comfort in mind. We offer a calm, respectful environment where you can discuss your concerns openly and receive treatment with complete privacy. Our clinical team ensures a supportive experience for all clients, with full cultural sensitivity and privacy maintained at all times.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 text-obsidian font-medium uppercase text-xs">
                <Phone size={18} className="text-primary" />
                +44 7356 255598
              </div>
            </div>
            <button onClick={() => onNavigate(Page.Contact)} className="group bg-primary text-clinical-dark px-10 py-4 rounded-full font-medium uppercase text-sm w-fit shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
              Book Your Visit
            </button>
          </div>
          <div className="w-full relative">
            <div className="hidden lg:block absolute -inset-4 border border-primary/20 rounded-[3rem] -z-10 animate-pulse" />
            <div className="overflow-hidden rounded-[2.5rem] shadow-2xl">
              <img 
                src={clinicSpaceImgUrl} 
                className="w-full aspect-video object-cover hover:scale-105 transition-transform duration-1000 grayscale-[20%] hover:grayscale-0" 
                alt="Clinical consultation at Novogenics" 
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;