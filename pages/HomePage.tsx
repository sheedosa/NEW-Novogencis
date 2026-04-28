import React, { useMemo } from 'react';
import { Page } from '../types';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

const HeroImage = ({ className = "" }: { className?: string }) => {
  const heroImgUrl = "https://lh3.googleusercontent.com/d/1SNFDgxNELvdVd8ifLazIcDRwwnr2Cmb3";
  const reviewsUrl = "https://www.google.com/search?q=novogenics#lrd=0x487bb3b413601afd:0x4d09d8314222a8e3,1,,,,";

  return (
    <div className={`relative ${className} transform translate-z-0`}>
      <div className="absolute -top-10 -right-10 w-48 md:w-72 h-48 md:h-72 bg-primary/10 rounded-full blur-[60px] md:blur-[80px] animate-pulse"></div>
      <div className="absolute -bottom-10 -left-10 w-48 md:w-72 h-48 md:h-72 bg-accent-gold/5 rounded-full blur-[60px] md:blur-[80px] animate-pulse delay-700"></div>
      
      <div className="relative z-10 w-full aspect-[4/3] min-h-[250px] bg-bg-soft shadow-[0_32px_64px_-16px_rgba(208,187,149,0.25)] overflow-hidden border-[6px] md:border-[12px] border-white organic-shape animate-fade-up">
        <img 
          src={heroImgUrl}
          alt="Dr Aminah Amer consulting with a client at Novogenics clinic"
          className="w-full h-full object-cover transition-transform duration-[3s] ease-out hover:scale-105"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-clinical-dark/5 to-transparent pointer-events-none" />
      </div>

      <a 
        href={reviewsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute -top-4 -left-4 md:-top-8 md:-left-8 z-30 bg-white p-4 md:p-5 rounded-[2rem] shadow-2xl border border-primary/10 animate-fade-up hover:scale-105 transition-all duration-300 group cursor-pointer"
        style={{ animationDelay: '400ms' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xl md:text-2xl font-black text-text-main">5.0</span>
              <div className="flex text-[#FBBC05] gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span 
                    key={i} 
                    className="material-symbols-outlined text-sm md:text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Google Reviews</p>
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 group-hover:bg-primary/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
        </div>
      </a>

      <div className="absolute -bottom-6 -right-6 z-20 bg-white p-3 md:p-4 rounded-2xl shadow-xl border border-primary/10 animate-float hidden md:flex items-center gap-3 will-change-transform transform translate-z-0">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-xl">verified_user</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Clinical Setting</span>
          <span className="text-xs font-bold text-text-main">Doctor-Led Care</span>
        </div>
      </div>
    </div>
  );
};

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const testimonials = useMemo(() => [
    {
      name: "Rusul Al-Hashimi",
      review: "I have just completed my hair regrowth package of 4x PRP, 1x Exosomes and 5x microneedling and the results have been amazing and very visible. From the first moment I had my consultation, Dr Amer didn't sell me the treatment but she sold me on her knowledge.",
      date: "1 month ago"
    },
    {
      name: "Saime Choudhry",
      review: "I had a consultation at Novogenics in Cheadle about their EV-Enriched Plasma (Autologous Exosome Therapy) for hair growth and was really impressed. The team were professional, knowledgeable, and took the time to explain everything clearly.",
      date: "3 months ago"
    },
    {
      name: "Sara Amer",
      review: "Had my second prp treatment yesterday at novogenics and i couldn't believe how much new baby hairs had started to come through from just the one treatment. Dr Aminah uses a machine on the scalp to magnify the hairs and it was astonishing.",
      date: "6 months ago"
    },
    {
      name: "Maham Ahmed",
      review: "Lovely clean clinic, easy to find. Dr Aminah is so knowledgeable and backs everything with science. Will see her again for PRP. The environment is calming and very professional.",
      date: "3 months ago"
    },
    {
      name: "Arwa Eltaweel",
      review: "I recently had a consultation at the clinic, and I couldn’t be more pleased with the experience. From the moment I walked in, Dr. Aminah was warm, professional, and attentive. Very welcoming.",
      date: "7 months ago"
    },
    {
      name: "Farzana Gul",
      review: "Dr Aminah is incredibly knowledgeable, and her attention to detail is impeccable. She is truly passionate about her work. She has a beautiful discreet clinic and instantly made me feel comfortable!",
      date: "7 months ago"
    }
  ], []);

  // Duplicated list for seamless infinite marquee
  const marqueeItems = useMemo(() => [...testimonials, ...testimonials, ...testimonials], [testimonials]);

  return (
    <div className="animate-fade-in overflow-x-hidden selection:bg-primary/20">
      {/* Hero Section */}
      <section className="px-6 md:px-10 lg:px-20 pt-32 md:pt-44 pb-20 md:pb-32 max-w-[1440px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 md:gap-24 items-center">
          
          <div className="w-full lg:w-1/2 flex flex-col gap-6 md:gap-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/5 text-primary border border-primary/10 w-fit mx-auto lg:mx-0 animate-fade-in will-change-opacity">
              <span className="material-symbols-outlined text-base animate-pulse">medical_services</span>
              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em]">Hair Loss Specialists</span>
            </div>
            
            <h1 className="text-text-main text-4xl xs:text-5xl sm:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight animate-fade-up will-change-transform" style={{ animationDelay: '150ms' }}>
              Restore <span className="text-primary italic font-serif">Confidence</span> Naturally
            </h1>

            <div className="block lg:hidden w-full px-2 my-4">
              <HeroImage />
            </div>

            <p className="text-text-muted text-base md:text-xl leading-relaxed max-w-[560px] mx-auto lg:mx-0 opacity-0 animate-fade-up will-change-opacity" style={{ animationDelay: '250ms' }}>
              Specialised regenerative care. Experience evidence-based hair restoration in a private, supportive clinical environment.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start opacity-0 animate-fade-up" style={{ animationDelay: '350ms' }}>
              <button 
                onClick={() => onNavigate(Page.Assessment)}
                className="group relative bg-primary text-clinical-dark px-10 py-3.5 rounded-full text-base font-black shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 uppercase tracking-widest group-hover:text-white transition-colors duration-500">Start Your Journey</span>
                <div className="absolute inset-0 bg-clinical-dark translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out" />
              </button>
              <button 
                onClick={() => onNavigate(Page.Treatments)}
                className="border-2 border-primary/20 hover:border-primary text-text-main px-10 py-3.5 rounded-full text-base font-black transition-all duration-300 hover:bg-white active:scale-95 shadow-lg shadow-primary/5 uppercase tracking-widest"
              >
                Treatments
              </button>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-2 mt-2 opacity-0 animate-fade-in" style={{ animationDelay: '450ms' }}>
               <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.3em] text-text-muted/60">Payment plans available via</span>
               <div className="h-4 flex items-center">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1G4qDbkBW0teKcS1IaKy7oaly8CVTKkQK" 
                    alt="Klarna Logo" 
                    className="h-full w-auto object-contain opacity-70 transition-all hover:opacity-100"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
               </div>
            </div>
          </div>

          <div className="hidden lg:block w-full lg:w-1/2">
            <HeroImage />
          </div>
        </div>
      </section>

      {/* Philosophy / Trust Section */}
      <section className="bg-white py-16 md:py-32">
        <div className="max-w-[1440px] mx-auto px-6 md:px-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-24">
            {[
              { label: 'Ethical', title: 'Autologous Treatment', desc: 'We only use your body\'s own healing potential. No hormones, no synthetics.', icon: 'diversity_3' },
              { label: 'Scientific', title: 'Evidence-Based', desc: 'Protocols grounded in regenerative science and peer-reviewed clinical research.', icon: 'analytics' },
              { label: 'Personal', title: 'Private & Discrete', desc: 'A serene clinic environment in Cheadle designed exclusively for your comfort.', icon: 'shield_person' }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center md:items-start text-center md:text-left group animate-fade-up" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="w-14 h-14 md:w-16 md:h-16 bg-bg-soft rounded-2xl flex items-center justify-center text-primary mb-6 md:mb-8 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm transform translate-z-0">
                  <span className="material-symbols-outlined text-2xl md:text-3xl font-light">{item.icon}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold mb-3">{item.label}</span>
                <h3 className="text-xl md:text-2xl font-black mb-4 text-text-main tracking-tight leading-snug">{item.title}</h3>
                <p className="text-text-muted leading-relaxed text-sm md:text-base">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* World-Leading PRP Technology Section */}
      <section className="py-16 md:py-32 bg-white overflow-hidden">
        <div className="max-w-[1440px] mx-auto px-6 md:px-20">
          <div className="flex flex-col lg:flex-row items-center gap-12 md:gap-24">
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute -inset-4 border-2 border-primary/10 rounded-[2rem] -z-10 animate-pulse" />
              <div className="relative z-10 rounded-[2.5rem] overflow-hidden shadow-[0_48px_80px_-24px_rgba(208,187,149,0.25)] border-8 border-white bg-bg-soft">
                <img 
                  src="https://lh3.googleusercontent.com/d/1Jb1arkWJebGZjOaHX1PYRms2zPtYiI5P" 
                  alt="T-Lab #1 Ranked PRP System IMCAS 2025 Data Chart" 
                  className="w-full object-cover transition-transform duration-1000 hover:scale-105"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="absolute -bottom-8 -right-4 md:-right-8 z-20 bg-clinical-dark p-6 rounded-3xl shadow-2xl border border-primary/20 animate-fade-up max-w-[200px]">
                <div className="flex flex-col gap-2">
                  <span className="text-primary font-black text-[10px] uppercase tracking-widest">IMCAS 2025</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-white">#1</span>
                    <span className="text-[11px] font-bold text-gray-400 leading-tight">Ranked PRP System Globally</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col gap-6 md:gap-8">
              <div className="flex flex-col gap-4">
                <span className="text-primary font-black text-[10px] md:text-xs uppercase tracking-[0.4em] animate-fade-in">Clinical Excellence</span>
                <h2 className="text-4xl md:text-6xl font-black text-text-main tracking-tight leading-[1.1]">
                  World-Leading <br className="hidden md:block" />
                  <span className="text-primary italic font-serif">PRP Technology.</span>
                </h2>
                <h3 className="text-base md:text-xl font-bold text-text-muted max-w-xl">
                  Novogenics uses T-Lab®, ranked #1 PRP system at IMCAS World Congress 2025
                </h3>
              </div>

              <p className="text-text-muted text-sm md:text-lg leading-relaxed max-w-xl">
                We're committed to delivering the highest standard of care, which is why we use T-Lab® — the world's leading platelet-rich plasma system. Ranked #1 among top systems globally.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-4">
                {[
                  { title: "Highest Platelet Dose", detail: "4.6 billion platelets — the most concentrated formula available", icon: "biotech" },
                  { title: "Superior Recovery Rate", detail: "90.1% platelet recovery for maximum effectiveness", icon: "analytics" },
                  { title: "Proven Results", detail: "Over 4 million treatments delivered worldwide since 2012", icon: "public" },
                  { title: "Medical-Grade Quality", detail: "CE-approved, FDA-approved medical devices", icon: "verified" }
                ].map((stat, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-bg-soft border border-primary/5 hover:border-primary/20 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] md:text-xs font-black text-text-main uppercase tracking-widest">{stat.title}</span>
                      <span className="text-[11px] text-text-muted leading-relaxed font-medium">{stat.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services Preview */}
      <section className="py-16 md:py-32">
        <div className="max-w-[1440px] mx-auto px-6 md:px-20">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 md:mb-16 gap-8">
            <div className="max-w-2xl">
              <span className="text-primary font-black text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-4 animate-fade-in">
                Clinical Excellence
              </span>
              <h2 className="text-3xl md:text-6xl font-black tracking-tight leading-[1.1] mb-4 md:mb-6">
                World-Class <span className="text-primary italic font-serif">Treatments.</span>
              </h2>
              <p className="text-text-muted text-base md:text-xl">Cutting-edge regenerative protocols tailored for your scalp health.</p>
            </div>
            <button 
              onClick={() => onNavigate(Page.Treatments)}
              className="text-primary font-black uppercase tracking-widest text-[10px] md:text-sm flex items-center gap-2 group transition-all"
            >
              VIEW ALL TREATMENTS 
              <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform duration-300">arrow_forward</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              { title: 'EV-Enriched Plasma', cat: 'REGENERATIVE', desc: 'Harnessing concentrated exosomes for peak follicular stimulation.' },
              { title: 'PRP Hair Therapy', cat: 'CELLULAR', desc: 'Platelet-rich plasma derived from your own blood to thicken hair density.' },
              { title: 'Microneedling', cat: 'STIMULATION', desc: 'Micro-channels created to enhance absorption and trigger natural repair.' }
            ].map((item, idx) => (
              <div key={idx} className="premium-card p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col gap-6 group cursor-pointer animate-fade-up" style={{ animationDelay: `${idx * 150}ms` }} onClick={() => onNavigate(Page.Treatments)}>
                <span className="text-[10px] font-black uppercase tracking-widest text-accent-gold/60">{item.cat}</span>
                <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight group-hover:text-primary transition-colors duration-300">{item.title}</h3>
                <p className="text-text-muted leading-relaxed text-sm md:text-base">{item.desc}</p>
                <div className="mt-auto pt-6 flex justify-between items-center border-t border-gray-50">
                  <span className="text-[10px] md:text-xs font-bold text-text-main group-hover:translate-x-2 transition-transform duration-300 uppercase tracking-widest">LEARN MORE</span>
                  <span className="material-symbols-outlined text-primary text-xl">east</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Assessment CTA */}
      <section className="px-4 md:px-10 lg:px-20 py-16 md:py-32 bg-bg-soft">
        <div className="max-w-[1200px] mx-auto bg-clinical-dark rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-20 relative overflow-hidden shadow-2xl transform translate-z-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-accent-gold/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10 md:gap-16">
            <div className="w-full lg:w-3/5 text-center lg:text-left">
              <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-4 md:mb-6 block">START YOUR JOURNEY</span>
              <h2 className="text-3xl md:text-6xl font-black text-white mb-6 md:mb-8 leading-[1.1] tracking-tight">
                Discover the Cause of Your <span className="text-primary italic font-serif">Hair Thinning.</span>
              </h2>
              <p className="text-gray-400 text-sm md:text-xl mb-8 md:mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Our free virtual assessment helps us understand your unique profile before you ever step foot in the clinic.
              </p>
              <button 
                onClick={() => onNavigate(Page.Assessment)}
                className="bg-primary text-clinical-dark px-8 py-3.5 rounded-full font-bold text-[11px] md:text-sm uppercase tracking-widest hover:bg-white hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-primary/10"
              >
                START VIRTUAL ASSESSMENT
              </button>
            </div>
            <div className="w-full lg:w-2/5">
              <div className="relative group overflow-hidden rounded-3xl">
                <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500 pointer-events-none" />
                <img 
                  loading="lazy"
                  decoding="async"
                  src="https://lh3.googleusercontent.com/d/1uoDkwYFGc3Ffdawu71C8fGKdt2eB1NLp" 
                  alt="Virtual Assessment Clinical Image" 
                  className="relative z-10 rounded-3xl w-full object-cover shadow-2xl grayscale-[30%] group-hover:grayscale-0 transition-all duration-1000 transform will-change-transform"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Continuous Marquee */}
      <section className="py-12 md:py-32 bg-bg-soft/50 overflow-hidden relative">
        <style>
          {`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-33.33%); }
            }
            .animate-marquee {
              display: flex;
              width: fit-content;
              animation: marquee 60s linear infinite;
            }
            @media (max-width: 768px) {
              .animate-marquee {
                animation-duration: 40s;
              }
            }
          `}
        </style>

        <div className="max-w-[1440px] mx-auto px-6 md:px-20">
          <div className="text-center mb-10 md:mb-20">
            <span className="text-primary font-black text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-3 md:mb-4 animate-fade-in">
              Client Experiences
            </span>
            <h2 className="text-3xl md:text-6xl font-black text-text-main tracking-tight leading-[1.1] mb-4 md:mb-6 [word-spacing:0.12em]">
              Verified <span className="text-primary italic font-serif">Google</span> Reviews.
            </h2>
            <div className="w-16 md:w-24 h-1 bg-primary/20 mx-auto rounded-full" />
          </div>

          <div className="relative mt-8">
            <div className="animate-marquee">
              {marqueeItems.map((t, idx) => (
                <div key={idx} className="w-[300px] md:w-[450px] shrink-0 px-3 md:px-5">
                  <div className="premium-card p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] flex flex-col gap-3 md:gap-6 group h-full shadow-2xl shadow-primary/5 bg-white border border-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex text-[#FBBC05] gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className="material-symbols-outlined text-sm md:text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        ))}
                      </div>
                      <span className="text-[8px] md:text-[9px] font-bold text-text-muted/50 uppercase tracking-widest">{t.date}</span>
                    </div>
                    
                    <div className="relative">
                      <span className="material-symbols-outlined text-primary/10 text-4xl md:text-8xl absolute -top-4 -left-2 md:-top-8 md:-left-12 pointer-events-none">format_quote</span>
                      <p className="text-text-muted italic text-[14px] md:text-lg lg:text-xl leading-relaxed relative z-10 font-serif">
                        "{t.review}"
                      </p>
                    </div>

                    <div className="mt-auto pt-4 md:pt-6 border-t border-gray-50 flex items-center gap-3 md:gap-4">
                      <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-[10px] md:text-sm">
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs md:text-base font-black text-text-main">{t.name}</span>
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-text-muted/60">Verified Client</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-bg-soft/50 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-bg-soft/50 to-transparent z-10 pointer-events-none" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;