import React from 'react';
import { Page } from '../types';
import { CalendarDays, Stethoscope, Star, ArrowRight } from 'lucide-react';

interface PricingPageProps {
  onNavigate: (page: Page) => void;
}

interface PriceItem {
  title: string;
  price: string;
  subtitle?: string;
  features?: string[];
  isPopular?: boolean;
}

const PricingSection = ({ title, items, icon, isPackages = false, onNavigate }: { title: string, items: PriceItem[], icon: React.ReactNode, isPackages?: boolean, onNavigate: (page: Page) => void }) => (
  <div className="mb-20">
    <div className="flex items-center gap-4 mb-10">
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
        {icon}
      </div>
      <h2 className="text-2xl md:text-3xl font-medium text-obsidian tracking-tight uppercase">{title}</h2>
    </div>
    <div className={`grid grid-cols-1 ${isPackages ? 'lg:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
      {items.map((item, idx) => (
        <div 
          key={idx} 
          className={`premium-card p-8 rounded-[2rem] flex flex-col justify-between group relative overflow-hidden transition-all duration-500 hover:shadow-2xl ${
            item.isPopular ? 'border-primary/40 bg-white ring-1 ring-primary/20' : ''
          }`}
        >
          {item.isPopular && (
            <div className="absolute top-0 right-0 bg-primary text-clinical-dark text-[10px] font-medium px-6 py-2 rounded-bl-2xl uppercase flex items-center gap-1">
              <Star size={12} /> Most Popular
            </div>
          )}
          <div>
            <h3 className="text-xl font-medium text-obsidian leading-tight mb-2 pr-20 group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            {item.subtitle && (
              <p className="text-muted text-xs font-bold uppercase mb-6 leading-relaxed">
                ({item.subtitle})
              </p>
            )}
            {item.features && (
              <ul className="space-y-3 mb-8">
                {item.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3 text-sm text-muted font-medium">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-auto flex items-end justify-between border-t border-gray-50 pt-6">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted uppercase mb-1">Investment</span>
              <span className="text-3xl md:text-4xl font-medium text-obsidian">{item.price}</span>
            </div>
            <button
              onClick={() => onNavigate(Page.Assessment)}
              className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const packages: PriceItem[] = [
    { 
      title: "FOUNDATION PACKAGE", 
      price: "£795",
      subtitle: "For early thinning or those starting treatment",
      features: [
        "3 PRP treatments",
        "3 Microneedling sessions",
        "Structured clinical review"
      ]
    },
    { 
      title: "INTENSIVE PACKAGE", 
      price: "£1,500",
      subtitle: "For moderate or progressive hair thinning",
      isPopular: true,
      features: [
        "6 PRP treatments",
        "6 Microneedling sessions",
        "Ongoing progress review"
      ]
    },
    { 
      title: "ELITE REGENERATION PACKAGE", 
      price: "£1,985",
      subtitle: "For more significant or long-standing hair loss",
      features: [
        "6 PRP treatments",
        "1 Autologous Exosome therapy",
        "7 Microneedling sessions",
        "Long-term regenerative strategy"
      ]
    },
  ];

  const singleTreatments: PriceItem[] = [
    { title: "Single PRP + Microneedling", price: "£300" },
    { title: "Single Exosome + Microneedling", price: "£680" },
  ];

  return (
    <div className="animate-fade-in bg-cream min-h-screen">
      {/* Hero Section */}
      <section className="relative px-6 md:px-20 pt-32 md:pt-44 pb-20 md:pb-32 overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-cream opacity-30 -skew-x-12 translate-x-1/4 pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-[1200px] mx-auto relative z-10 text-center">
          <span className="text-primary font-medium text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-4 animate-fade-in">
            Investment in Your Confidence
          </span>
          <h1 className="text-4xl md:text-7xl font-medium text-obsidian tracking-tight leading-[1.1] mb-8 animate-fade-up">
            Treatments & <span className="text-primary italic font-serif">Packages</span>
          </h1>
          <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto font-medium animate-fade-up delay-100 mb-4">
            Transparent pricing for world-class regenerative care.
          </p>
          <p className="text-primary font-medium text-[10px] md:text-xs uppercase tracking-[0.2em] animate-fade-up delay-150">
            All treatments are delivered every 4–6 weeks in line with the hair growth cycle.
          </p>
          <div className="mt-12 flex flex-col items-center gap-6 animate-fade-up delay-200">
            <button 
              onClick={() => onNavigate(Page.Assessment)}
              className="bg-primary text-clinical-dark px-10 py-4 rounded-full font-medium text-sm uppercase hover:bg-obsidian hover:text-white transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
            >
              Start Free Assessment
            </button>
            
            {/* Klarna Payment Indicator - Unified URL */}
            <div className="flex flex-col items-center gap-2 mt-4">
               <span className="text-[8px] md:text-[10px] font-medium uppercase tracking-[0.3em] text-muted/60">Payment plans available via</span>
               <div className="h-5 flex items-center">
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
        </div>
      </section>

      {/* Pricing Content */}
      <section className="px-6 md:px-20 py-20 md:py-32">
        <div className="max-w-[1440px] mx-auto">
          
          <PricingSection title="Restoration Packages" items={packages} icon={<CalendarDays size={24} />} isPackages={true} onNavigate={onNavigate} />

          <PricingSection title="Single / Top Up Treatments" items={singleTreatments} icon={<Stethoscope size={24} />} onNavigate={onNavigate} />

          {/* Assessment CTA */}
          <div className="mt-20 max-w-[1200px] mx-auto bg-obsidian rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-20 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-accent-gold/5 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 md:gap-16">
              <div className="w-full lg:w-3/5 text-center lg:text-left">
                <span className="text-primary font-medium uppercase tracking-[0.4em] text-[10px] mb-6 block">START YOUR JOURNEY</span>
                <h2 className="text-4xl md:text-6xl font-medium text-white mb-8 leading-[1.1] tracking-tight">
                  Discover the Cause of Your <span className="text-primary italic font-serif">Hair Thinning.</span>
                </h2>
                <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  Our free virtual assessment helps us understand your unique profile before you ever step foot in the clinic.
                </p>
                <button 
                  onClick={() => onNavigate(Page.Assessment)}
                  className="bg-primary text-clinical-dark px-8 py-3.5 rounded-full font-bold text-sm uppercase hover:bg-white hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-primary/10"
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
                    className="relative z-10 rounded-3xl w-full object-cover shadow-2xl grayscale-[30%] group-hover:grayscale-0 transition-all duration-1000 transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;