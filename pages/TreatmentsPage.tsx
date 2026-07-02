import React from 'react';
import { Page } from '../types';
import { ShieldCheck, Microscope, Info, CheckCircle, UserSearch } from 'lucide-react';

interface TreatmentsPageProps {
  onNavigate: (page: Page) => void;
}

interface TreatmentInfo {
  title: string;
  desc: string;
  works: string;
  benefits: string[];
  ideal: string[];
  /** Optional PRP comparison block — currently only PRF sets this. */
  compare?: string;
}

const TreatmentsPage: React.FC<TreatmentsPageProps> = ({ onNavigate }) => {
  const treatments: TreatmentInfo[] = [
    {
      title: "EV-Enriched Plasma (Autologous Exosome Therapy)",
      desc: "The most advanced regenerative treatment available for hair restoration. EV-Enriched Plasma harnesses exosomes - tiny vesicles that carry growth factors and regenerative signals to stimulate hair follicle activity and promote natural regrowth.",
      works: "Using your own blood, we isolate and concentrate exosomes that contain powerful regenerative properties. These are then precisely delivered to the scalp to rejuvenate dormant hair follicles.",
      benefits: ["Most advanced regenerative approach", "Stimulates natural hair growth", "No synthetic hormones", "Minimal downtime", "Evidence-based results"],
      ideal: ["Progressive hair thinning", "Pattern hair loss", "Stress-related hair loss", "Age-related hair loss"]
    },
    {
      title: "PRP (Platelet-Rich Plasma) for Hair Loss",
      desc: "A proven regenerative therapy that uses concentrated platelets from your own blood to stimulate hair follicle regeneration and promote hair growth.",
      works: "We draw a small amount of your blood, process it to concentrate the platelets rich in growth factors, and inject this into the scalp areas experiencing thinning or loss.",
      benefits: ["Clinically proven results", "Uses your body's own healing factors", "Stimulates dormant follicles", "Improves hair density and thickness", "No foreign substances"],
      ideal: ["Early-stage hair loss", "Hair thinning", "Androgenetic alopecia", "Maintaining hair density"]
    },
    {
      title: "PRF (Platelet-Rich Fibrin) for Hair Loss",
      desc: "A regenerative therapy that uses a natural fibrin matrix from your own blood to deliver a slower, longer-lasting release of growth factors to the scalp.",
      works: "We draw a small amount of your blood without anticoagulant, allowing it to naturally form a platelet-rich fibrin matrix, then inject this into areas of thinning to stimulate follicle regeneration.",
      benefits: ["Slower, longer-lasting release of growth factors", "Uses only your own blood — no anticoagulant or additives", "Forms a natural platelet-rich fibrin matrix", "A longer-acting alternative to standard PRP"],
      ideal: ["Early-stage thinning", "A longer-acting PRP alternative", "Pattern hair loss", "Maintaining hair density"],
      compare: "PRF and PRP both use your own blood to stimulate hair follicles, but they're processed differently. PRP is spun with an anticoagulant and releases its growth factors quickly, within hours, while PRF is spun without one, allowing platelets to form a natural fibrin matrix that releases growth factors gradually over several days. Some studies suggest this slower release may support more sustained follicle stimulation, making PRF a good option for patients seeking a longer-acting alternative to standard PRP — though as a newer technique, it has a smaller body of clinical evidence behind it than PRP."
    },
    {
      title: "Hair Microneedling",
      desc: "A minimally invasive treatment that creates controlled micro-injuries to the scalp, triggering the body's natural healing response and enhancing the absorption of topical treatments.",
      works: "Using a specialised device with fine needles, we create microscopic channels in the scalp. This stimulates collagen production, increases blood flow to hair follicles, and enhances the penetration of growth-promoting serums.",
      benefits: ["Enhances treatment absorption", "Stimulates natural healing", "Improves scalp health", "Boosts circulation to follicles", "Minimal discomfort"],
      ideal: ["Enhancing other treatments", "Improving scalp health", "Early intervention", "Maintenance therapy"]
    }
  ];

  return (
    <div className="animate-fade-in selection:bg-primary/20 bg-cream">
      {/* Redesigned Hero Section - Optimized for Vertical and Horizontal Spacing */}
      <section className="relative px-6 md:px-20 pt-32 md:pt-44 pb-24 md:pb-32 lg:pb-48 overflow-hidden bg-white">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-cream opacity-30 -skew-x-12 translate-x-1/4 pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-[1440px] mx-auto relative z-10 text-center">
          <span className="text-primary font-medium text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-8 animate-fade-in">
            Clinical Solutions
          </span>
          
          <h1 
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-medium text-obsidian tracking-tight leading-[1.2] mb-10 animate-fade-up max-w-[1200px] mx-auto"
            style={{ wordSpacing: '0.15em' }}
          >
            Advanced <span className="text-primary italic font-serif">Regenerative Treatments</span> for Hair Loss
          </h1>

          <p className="text-muted text-lg md:text-2xl max-w-3xl mx-auto font-medium animate-fade-up delay-100 leading-relaxed">
            Science-backed protocols using your body's own healing potential to restore density and confidence in a private, clinical setting.
          </p>
          
          <div className="mt-16 flex flex-wrap justify-center gap-4 animate-fade-up delay-200">
            <div className="flex items-center gap-3 px-6 py-4 bg-cream rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
              <ShieldCheck size={24} className="text-primary" />
              <span className="text-xs font-medium uppercase text-obsidian">Doctor-Led Protocols</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 bg-cream rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
              <Microscope size={24} className="text-primary" />
              <span className="text-xs font-medium uppercase text-obsidian">Autologous Cells</span>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Treatments */}
      {treatments.map((t, i) => (
        <section key={i} className={`px-6 md:px-10 lg:px-20 py-24 ${i % 2 === 1 ? 'bg-white' : 'bg-cream/40'}`}>
          <div className="max-w-[1000px] mx-auto flex flex-col gap-12">
            <div className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto">
               <span className="text-primary font-medium text-[11px] uppercase tracking-[0.4em]">TREATMENT {i + 1}</span>
               <h2 className="text-3xl md:text-5xl font-medium text-obsidian tracking-tight leading-tight">{t.title}</h2>
               <div className="w-20 h-1.5 bg-primary rounded-full" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-7 space-y-8">
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-black/5 shadow-xl shadow-black/[0.02]">
                  <h4 className="font-medium text-primary uppercase text-[11px] tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Info size={16} /> What is it?
                  </h4>
                  <p className="text-muted text-lg md:text-xl leading-relaxed">{t.desc}</p>
                </div>
                
                <div className="p-8 border-l-2 border-primary/20">
                  <h4 className="font-medium text-primary uppercase text-[11px] tracking-[0.2em] mb-4">How it works:</h4>
                  <p className="text-muted leading-relaxed text-lg">{t.works}</p>
                </div>

                {t.compare && (
                  <div className="p-8 border-l-2 border-primary/20">
                    <h4 className="font-medium text-primary uppercase text-[11px] tracking-[0.2em] mb-4">How PRF compares to PRP:</h4>
                    <p className="text-muted leading-relaxed text-lg">{t.compare}</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-white/60 backdrop-blur-sm p-8 rounded-[2rem] border border-black/5">
                  <h4 className="font-medium text-obsidian text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <CheckCircle size={20} className="text-primary" /> Key Benefits
                  </h4>
                  <ul className="space-y-4">
                    {t.benefits.map(b => (
                      <li key={b} className="text-sm md:text-base text-muted flex items-start gap-4 group">
                        <span className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0 group-hover:scale-150 transition-transform"></span> 
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-obsidian p-8 rounded-[2rem]">
                  <h4 className="font-medium text-white text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <UserSearch size={20} className="text-primary" /> Ideal For
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {t.ideal.map(id => (
                      <span key={id} className="text-[10px] font-medium text-white/70 bg-white/10 px-4 py-2 rounded-full uppercase border border-white/5">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <button 
                onClick={() => onNavigate(Page.Assessment)} 
                className="group relative bg-primary text-clinical-dark px-8 py-3 rounded-full font-medium text-base overflow-hidden shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <span className="relative z-10 uppercase tracking-[0.1em]">Start Virtual Assessment</span>
                <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out" />
              </button>
            </div>
          </div>
        </section>
      ))}

      {/* Journey Section */}
      <section className="px-6 md:px-20 py-24 bg-obsidian text-white rounded-t-[4rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-[1440px] mx-auto relative z-10 text-center lg:text-left">
          <h2 className="text-3xl md:text-5xl font-medium text-center mb-20 tracking-tight leading-tight">Your Treatment <span className="text-primary italic font-serif">Journey</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { step: "01", stepName: "Consultation", desc: "Comprehensive assessment of your hair loss, medical history, and goals." },
              { step: "02", stepName: "Personalised Plan", desc: "A bespoke treatment protocol designed specifically for your needs." },
              { step: "03", stepName: "Clinical Care", desc: "Comfortable, professional treatment in our private Cheadle clinic." },
              { step: "04", stepName: "Ongoing Support", desc: "Regular follow-ups to monitor progress and adjust treatment as needed." }
            ].map((j, i) => (
              <div key={i} className="flex flex-col gap-4 relative group items-center lg:items-start text-center lg:text-left">
                <div className="text-7xl font-medium text-white/5 absolute -top-12 lg:-left-4 group-hover:text-primary/10 transition-colors duration-500">{j.step}</div>
                <h4 className="text-xl font-bold mt-4 text-primary">{j.stepName}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{j.desc}</p>
                <div className="w-0 h-[1px] bg-primary group-hover:w-full transition-all duration-1000" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Consultation CTA Section */}
      <section className="px-6 md:px-20 py-32 bg-white">
        <div className="max-w-[1000px] mx-auto text-center flex flex-col items-center gap-10">
          <div className="w-16 h-1 bg-primary mb-2 rounded-full" />
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.1]">
            Tailored to <span className="text-primary italic font-serif">Your</span> Biology.
          </h2>
          <p className="text-muted text-lg md:text-xl max-w-3xl leading-relaxed">
            Many clients achieve optimal results through a combination of treatments. During your consultation, we'll assess your specific hair loss pattern, medical history, and goals to create a bespoke treatment plan.
          </p>
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => onNavigate(Page.Assessment)} 
              className="bg-primary text-clinical-dark px-8 py-3 rounded-full font-medium text-sm uppercase hover:bg-obsidian hover:text-white transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
            >
              Start Free Assessment
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TreatmentsPage;