import React, { useState } from 'react';

const FAQPage: React.FC = () => {
  const faqCategories = [
    {
      title: "Before Booking / Suitability",
      items: [
        {
          q: "Is there an online consultation available?",
          a: "Yes. Novogenics offers a free online consultation designed to determine whether treatment may be suitable before booking an in-person appointment. Patients can create a secure profile, complete a structured questionnaire about their hair loss and medical history, and upload photos if required. Our clinicians review the information and may recommend treatment options, advise if treatment is suitable, or suggest seeing your GP or a specialist if a medical cause needs investigation. If appropriate, you will then be invited to book an in-clinic appointment."
        },
        {
          q: "Who is the ideal candidate for treatment?",
          a: "These treatments often work best for individuals with early to moderate hair thinning or reduced hair density. They are less effective in areas where hair follicles are no longer active."
        },
        {
          q: "What types of hair loss respond best to PRP?",
          a: "Research suggests PRP may be beneficial for certain types of hair loss including (androgenetic alopecia), early thinning, and hair shedding following stress or illness."
        },
        {
          q: "When will I start to see results?",
          a: "Hair growth occurs in cycles, so improvements take time. Many patients notice reduced shedding or early regrowth around 3–4 months, with further improvement between 6–12 months."
        }
      ]
    },
    {
      title: "Treatment Information",
      items: [
        {
          q: "Is PRP safe?",
          a: "Platelet-Rich Plasma (PRP) uses a small sample of your own blood, which is processed to concentrate platelets and growth factors before being injected into the scalp. Because the material comes from your own body, the risk of allergic reaction is very low. As with any injection procedure, there are small risks such as temporary discomfort, bruising, or infection."
        },
        {
          q: "Is PRP treatment painful?",
          a: "Most patients describe PRP injections as mildly uncomfortable rather than painful. The sensation is often described as small pinches or a scratching feeling. We use a vibrating tool on the scalp to help minimise the discomfort. A topical numbing cream can be applied beforehand to minimise discomfort."
        },
        {
          q: "Is microneedling painful?",
          a: "Microneedling uses very fine needles to create controlled micro-channels in the scalp, which may stimulate repair processes and improve absorption of topical treatments. Most patients describe the sensation as mild prickling or tingling."
        },
        {
          q: "How long does each treatment session take?",
          a: "Appointments typically last between 60 and 120 minutes depending on the treatment performed and whether multiple therapies are combined."
        },
        {
          q: "How many sessions will I need?",
          a: "Treatment plans vary depending on the individual and the type of hair loss. A typical initial course may involve three sessions spaced approximately 4–6 weeks apart. Maintenance treatments may be recommended depending on response and clinical goals."
        },
        {
          q: "Is this better than over-the-counter products or minoxidil?",
          a: "Evidence-based treatments such as topical minoxidil remain first-line therapy for many forms of hair loss. PRP and microneedling may be used alongside medical treatments as part of a combined approach."
        },
        {
          q: "Is PRP or exosome therapy a cure for hair loss?",
          a: "No treatment currently offers a permanent cure for most forms of hair loss. These therapies aim to support hair follicle health and potentially improve hair density or shedding in some individuals. Results vary and maintenance treatments may be required."
        },
        {
          q: "What are autologous exosomes, and how are they different from PRP?",
          a: "Autologous extracellular vesicles (sometimes referred to as 'autologous exosomes') are cell-derived signalling particles naturally present in blood that play a role in cellular communication. PRP contains platelets that release growth factors, whereas extracellular vesicles contain signalling molecules involved in cell communication. Research into their role in regenerative medicine is ongoing. At Novogenics these are derived from your own blood sample using specialised preparation techniques."
        },
        {
          q: "Are autologous exosome treatments legal in the UK?",
          a: "At Novogenics we use autologous blood-derived preparations, meaning the material used for treatment comes from your own blood collected during the appointment. We do not use donor-derived or commercially manufactured exosome products."
        }
      ]
    },
    {
      title: "Assessment & Monitoring",
      items: [
        {
          q: "Why do you offer trichoscopy?",
          a: "Trichoscopy allows examination of the scalp and hair follicles under magnification, helping assess hair density, follicle health, and scalp condition. Baseline images also help monitor changes over time."
        },
        {
          q: "What is trichoscopy?",
          a: "Trichoscopy is a non-invasive examination of the scalp using a specialised digital microscope. Images may be recorded in your clinical record to help monitor hair density and scalp health."
        }
      ]
    },
    {
      title: "Safety & Medical Considerations",
      items: [
        {
          q: "Will I be diagnosed or treated for a medical condition?",
          a: "Novogenics provides cosmetic and aesthetic hair restoration treatments. If signs of a medical scalp or hair disorder are identified, you may be advised to seek assessment from your GP or a dermatology specialist."
        },
        {
          q: "Do I need to see my GP before treatment?",
          a: "We strongly encourage patients experiencing new or unexplained hair loss to seek medical assessment from their GP before pursuing cosmetic treatments. This helps rule out underlying medical causes such as hormonal imbalance, nutritional deficiencies, or autoimmune conditions."
        },
        {
          q: "What if my hair loss requires medical treatment?",
          a: "If during consultation we suspect an underlying medical condition affecting your hair or scalp, we will advise you to seek GP medical assessment before cosmetic treatment."
        },
        {
          q: "Can I have treatment if I have other medical conditions?",
          a: "Suitability for treatment is assessed during consultation. Treatment may not be suitable in situations such as active scalp infection, pregnancy, breastfeeding, certain blood disorders, uncontrolled diabetes, or use of medications affecting platelet function."
        },
        {
          q: "What if I am worried about allergic reactions?",
          a: "Because PRP and autologous preparations use your own blood, the risk of allergic reaction is extremely low. Reactions to other materials such as antiseptics or adhesives can occasionally occur."
        },
        {
          q: "What are the risks?",
          a: "Possible side effects include temporary discomfort, swelling, bruising, small amounts of bleeding, infection (rare), and lack of response to treatment. All potential risks are discussed during consultation before treatment."
        },
        {
          q: "Are results permanent?",
          a: "For many types of hair loss, treatments aim to support follicle health rather than permanently cure the condition. Maintenance treatments may be required to sustain results."
        }
      ]
    },
    {
      title: "Clinic Information",
      items: [
        {
          q: "Who will perform my treatment?",
          a: "All consultations and treatments are performed by qualified medical professionals including Dr Aminah Amer (female GP) and Dr Waqass Farid (male GP)."
        },
        {
          q: "Where is Novogenics based?",
          a: "Novogenics is based in Cheadle, UK, serving clients across Manchester and Cheshire."
        },
        {
          q: "Is my treatment private?",
          a: "Yes. Novogenics is a private clinic that prioritises patient confidentiality and cultural sensitivity, providing a respectful and comfortable environment for all clients."
        },
        {
          q: "Who has access to my data?",
          a: "Your medical records are stored securely within a GDPR-compliant clinical system. Access is restricted to authorised clinicians involved in your care. Information is shared with your GP only with your consent unless required for medical safety."
        },
        {
          q: "What happens if a blood sample cannot be taken?",
          a: "In the rare event that a blood sample cannot be obtained and treatment cannot proceed, any unused treatment sessions will be refunded in accordance with clinic policy."
        },
        {
          q: "Why do some clinics offer PRP much cheaper than others?",
          a: "PRP treatments can vary significantly between clinics. Differences in price may reflect practitioner training, equipment used to prepare PRP, consultation time and assessment. At Novogenics, cosmetic treatments are performed by qualified doctors using medical-grade equipment with careful clinical assessment and follow-up."
        }
      ]
    }
  ];

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  const toggle = (catIdx: number, itemIdx: number) => {
    const key = `${catIdx}-${itemIdx}`;
    setOpenStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="animate-fade-in px-6 md:px-20 pt-32 md:pt-44 pb-24 bg-bg-soft min-h-screen">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-16 md:mb-24">
          <span className="text-primary font-black text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-4">Support & Information</span>
          <h1 className="text-4xl md:text-7xl font-black text-text-main tracking-tight leading-[1.1] mb-6">Frequently asked <span className="text-primary italic font-serif">questions</span></h1>
          <p className="text-text-muted text-lg md:text-xl max-w-2xl mx-auto font-medium">
            Everything you need to know about our regenerative hair therapies and clinical protocols.
          </p>
        </div>

        <div className="space-y-16">
          {faqCategories.map((category, catIdx) => (
            <div key={catIdx} className="space-y-6">
              <h2 className="text-xl md:text-2xl font-black text-text-main uppercase tracking-widest border-l-4 border-primary pl-6">
                {category.title}
              </h2>
              <div className="space-y-4">
                {category.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const isOpen = openStates[key];
                  return (
                    <div 
                      key={itemIdx} 
                      className={`bg-white rounded-3xl overflow-hidden border transition-all duration-300 ${
                        isOpen ? 'border-primary shadow-lg shadow-primary/5' : 'border-gray-100 shadow-sm'
                      }`}
                    >
                      <button 
                        onClick={() => toggle(catIdx, itemIdx)}
                        className="w-full flex items-center justify-between p-6 md:p-8 text-left hover:bg-gray-50 transition-colors group"
                      >
                        <span className={`font-black text-base md:text-lg pr-8 tracking-tight transition-colors ${isOpen ? 'text-primary' : 'text-text-main'}`}>
                          {item.q}
                        </span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          isOpen ? 'bg-primary border-primary text-white' : 'border-gray-100 text-primary group-hover:border-primary/30'
                        }`}>
                          <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </div>
                      </button>
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="p-6 md:p-8 pt-0 border-t border-gray-50 bg-gray-50/30">
                          <p className="text-text-muted leading-relaxed text-sm md:text-base font-medium">
                            {item.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 p-10 md:p-16 bg-clinical-dark rounded-[3rem] text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-black text-white mb-4">Still have questions?</h3>
            <p className="text-gray-400 mb-10 max-w-xl mx-auto">
              Our clinical team is happy to provide more detailed information tailored to your specific situation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="mailto:info@novogenics.co.uk" className="bg-primary text-clinical-dark px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-primary/10">
                Email Dr Amer
              </a>
              <a href="tel:+447356255598" className="bg-white/10 text-white border border-white/10 px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:bg-white/20 transition-all">
                Call the Clinic
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;