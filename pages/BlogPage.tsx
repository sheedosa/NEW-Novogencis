import React, { useState, useEffect } from 'react';
import { Page } from '../types';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  excerpt: string;
  thumbnail: string;
  authorImage: string;
}

interface BlogPageProps {
  onNavigate: (page: Page) => void;
}

const BlogPage: React.FC<BlogPageProps> = ({ onNavigate }) => {
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);

  // Scroll to top when switching views
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedBlogId]);

  const blogs: BlogPost[] = [
    {
      id: 'what-are-exosomes',
      title: "What Are Autologous Exosomes and How Do They Help Hair Loss?",
      author: "Dr Aminah Amer",
      date: "6/23/2025",
      readTime: "2 min read",
      category: "Medical Insights",
      excerpt: "Exosomes are tiny extracellular vesicles - microscopic messengers released by your body’s own cells. Discover how this breakthrough in regenerative medicine is helping clients restore hair density.",
      thumbnail: "https://lh3.googleusercontent.com/d/1rYma56lbUvSDU5DVEb1vhT7kw690f4EJ",
      authorImage: "https://lh3.googleusercontent.com/d/1YZP8Ey7efS4TDkira7M9cTkzDNo9zwW7"
    }
  ];

  const renderListView = () => (
    <div className="max-w-[1200px] mx-auto px-6 pt-32 md:pt-44 pb-16 md:pb-24 animate-fade-in">
      <div className="text-center mb-16 md:mb-24">
        <span className="text-primary font-medium text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-4">The Science of Regeneration</span>
        <h1 className="text-4xl md:text-7xl font-medium text-obsidian tracking-tight leading-[1.1] mb-6">Medical <span className="text-primary italic font-serif">Insights</span></h1>
        <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto font-medium">
          Expert articles on hair restoration, clinical breakthroughs, and regenerative medicine by our clinical team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {blogs.map((blog) => (
          <div 
            key={blog.id} 
            onClick={() => setSelectedBlogId(blog.id)}
            className="premium-card rounded-[2.5rem] overflow-hidden cursor-pointer group flex flex-col"
          >
            <div className="aspect-[16/10] overflow-hidden relative">
              <img 
                src={blog.thumbnail} 
                alt={blog.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[20%] group-hover:grayscale-0"
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute top-6 left-6">
                <span className="bg-white/90 backdrop-blur-md text-obsidian text-2xs font-medium text-hint px-4 py-2 rounded-full shadow-sm">
                  {blog.category}
                </span>
              </div>
            </div>
            
            <div className="p-8 md:p-10 flex-grow flex flex-col gap-4">
              <div className="flex items-center gap-3 text-[10px] font-bold text-muted uppercase">
                <span>{blog.date}</span>
                <span className="w-1 h-1 bg-primary rounded-full"></span>
                <span>{blog.readTime}</span>
              </div>
              
              <h3 className="text-2xl font-medium text-obsidian tracking-tight leading-tight group-hover:text-primary transition-colors">
                {blog.title}
              </h3>
              
              <p className="text-muted text-sm leading-relaxed line-clamp-3">
                {blog.excerpt}
              </p>
              
              <div className="mt-auto pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10">
                    <img src={blog.authorImage} alt={blog.author} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                  </div>
                  <span className="text-2xs font-medium text-hint text-obsidian">{blog.author}</span>
                </div>
                <ArrowRight size={18} className="text-primary group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailView = () => {
    return (
      <div className="animate-fade-in bg-cream min-h-screen pt-32 md:pt-44 pb-16 md:pb-24">
        <article className="max-w-[900px] mx-auto px-6">
          {/* Back Button */}
          <button 
            onClick={() => setSelectedBlogId(null)}
            className="flex items-center gap-2 text-primary font-medium uppercase text-xs mb-12 hover:text-clinical-dark transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Articles
          </button>

          {/* Blog Header */}
          <div className="mb-12 md:mb-16">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="bg-primary/10 text-primary text-[10px] font-medium uppercase tracking-[0.2em] px-3 py-1 rounded-full">Medical Insights</span>
              <span className="text-muted text-[10px] font-medium uppercase tracking-[0.2em]">6/23/2025</span>
              <span className="text-muted text-[10px] font-medium uppercase tracking-[0.2em]">• 2 min read</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-medium text-obsidian leading-[1.1] mb-8 tracking-tight [word-spacing:0.05em]">
              What Are Autologous <span className="text-primary italic font-serif mx-1">Exosomes</span> and How Do They Help Hair Loss?
            </h1>
            
            <div className="flex items-center gap-4 py-6 border-y border-black/5">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                 <img src="https://lh3.googleusercontent.com/d/1YZP8Ey7efS4TDkira7M9cTkzDNo9zwW7" alt="Dr Aminah Amer" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
              </div>
              <div>
                <p className="text-sm font-medium text-obsidian">Dr Aminah Amer</p>
                <p className="text-[10px] font-bold text-muted uppercase">Founder, Novogenics Clinic</p>
              </div>
            </div>
          </div>

          {/* Blog Content */}
          <div className="prose prose-lg prose-headings:font-medium prose-headings:text-obsidian prose-p:text-muted prose-p:leading-relaxed max-w-none">
            <p className="text-xl md:text-2xl font-medium text-obsidian leading-relaxed mb-12">
              Exosomes are tiny extracellular vesicles - microscopic messengers released by your body’s own cells. These vesicles carry growth signals and healing instructions between cells, especially in areas where repair or regeneration is needed.
            </p>

            <h2 className="text-2xl md:text-3xl font-medium mb-6">What are Autologous Exosomes?</h2>
            <p>
              At Novogenics, we extract these vesicles from your own blood (this is what “autologous” means) using a refined, sterile process. No donor material, no synthetic ingredients, and no foreign substances are used.
            </p>

            <h2 className="text-2xl md:text-3xl font-medium mt-12 mb-6">Why Platelet-Derived Exosomes Matter</h2>
            <p>
              Recent evidence shows that PRP-derived extracellular vesicles (EVs) - including exosomes - may contain greater concentrations of functional growth factors than PRP itself. These nanosized vesicles (typically 30–150 nm) are secreted naturally by activated platelets and serve as stable, bioavailable carriers of regenerative signals, including VEGF and other platelet-derived growth factors.
            </p>
            <p>
              Because exosomes are protected by a double lipid membrane, they are highly resistant to degradation and can penetrate cell membranes efficiently to deliver their molecular cargo.
            </p>

            <figure className="my-12">
              <div className="rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white">
                <img 
                  src="https://lh3.googleusercontent.com/d/1rYma56lbUvSDU5DVEb1vhT7kw690f4EJ" 
                  alt="Novogenics infographic exosome" 
                  className="w-full h-auto grayscale-[20%] hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption className="text-center text-2xs font-medium text-hint mt-4 text-muted">
                Novogenics Clinical Infographic: Exosome Signalling
              </figcaption>
            </figure>

            <p>
              At Novogenics, we use the Exomine™ system, a fully autologous platform that applies controlled shear forces via microlyser blades to activate platelets and release billions of exosomes directly from the client’s own blood - all within the same sterile system. 
            </p>
            <p>
              Flow cytometry markers (CD61+, CD41+, CD81+, CD9+) confirm that the exosomes are truly platelet-derived, while low CD45 and <span className="no-wrap">CD54</span> expression confirms minimal leukocyte contamination. Using this protocol, 4 mL of citrated plasma may yield over 100 billion vesicles, optimised in size (average ~104 nm) and purity. 
            </p>
            <p>
              While the exact count can vary between clients, the T-Lab protocol ensures a consistently high-quality, reproducible product, setting a new gold standard for autologous regenerative therapy.
            </p>

            <h2 className="text-2xl md:text-3xl font-medium mt-12 mb-6">How Are They Different from PRP?</h2>
            <p>
              While PRP (Platelet-Rich Plasma) uses the whole plasma containing platelets, autologous exosome therapy goes a step further. It isolates the cell-free fraction - rich in nanosized extracellular vesicles - which can penetrate more deeply into tissue and stimulate more targeted repair.
            </p>
            <p className="font-bold text-obsidian mb-4">This means:</p>
            <ul className="list-none pl-0 space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle size={18} className="text-primary mt-1" />
                <span>Less inflammation</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle size={18} className="text-primary mt-1" />
                <span>Faster recovery</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle size={18} className="text-primary mt-1" />
                <span>Longer-lasting signalling than PRP alone</span>
              </li>
            </ul>
            <p>
              For many clients with thinning hair, especially where the follicles are still alive but dormant, exosome therapy can be a breakthrough.
            </p>

            <h2 className="text-2xl md:text-3xl font-medium mt-12 mb-6">Why Novogenics Uses Autologous Exosomes Only</h2>
            <p>
              Not all exosomes are created equal. Many commercial clinics offer exosome products derived from sources such as amniotic fluid, placenta, plants, or even salmon - often imported and not licensed for injection use in the UK. While early studies on these products suggest potential benefits, we cannot confidently predict the long-term effects of injecting material derived from other species or tissues into the human body.
            </p>
            <p>
              At Novogenics, your safety is paramount. That’s why we use only autologous exosomes - regenerative messengers naturally derived from your own platelets. This method supports cellular repair and hair regrowth while eliminating the risks associated with foreign or synthetic biologics.
            </p>
            <p className="bg-obsidian text-white p-8 rounded-[2rem] font-medium my-10 border-l-8 border-primary italic">
              "In short: your biology, your results - with nothing added and nothing to reject."
            </p>
            <p>
              Using autologous exosomes, extracted from your own blood on the same day keeps our process:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-10">
              <li>Legal and safe</li>
              <li>Biocompatible</li>
              <li>Ethical and hormone-free</li>
            </ul>
            <p>
              You deserve a treatment that puts your health and your biology first.
            </p>

            <h2 className="text-2xl md:text-3xl font-medium mt-12 mb-6">Is It Right for Me?</h2>
            <p>Autologous EV-enriched plasma therapy may be right for you if:</p>
            <ul className="list-none pl-0 space-y-4">
              <li className="flex items-start gap-3">
                <ArrowRight size={18} className="text-primary mt-1" />
                <span>You’ve noticed early thinning around your parting or temples</span>
              </li>
              <li className="flex items-start gap-3">
                <ArrowRight size={18} className="text-primary mt-1" />
                <span>You’ve tried topical treatments without success</span>
              </li>
              <li className="flex items-start gap-3">
                <ArrowRight size={18} className="text-primary mt-1" />
                <span>You want a natural, drug-free approach to hair regrowth</span>
              </li>
              <li className="flex items-start gap-3">
                <ArrowRight size={18} className="text-primary mt-1" />
                <span>You value privacy, dignity, and medically-led care</span>
              </li>
            </ul>

            <div className="mt-20 p-10 md:p-16 bg-white rounded-[3rem] border border-black/5 text-center shadow-xl">
              <h2 className="text-3xl md:text-4xl font-medium text-obsidian mb-6">Book Your Consultation</h2>
              <p className="mb-10 text-muted">
                We see clients from across Manchester, Cheshire, and the surrounding areas at our private clinic in Cheadle. Whether you're dealing with stress-related hair loss, genetic thinning, or just want a science-based approach, Novogenics is here to help.
              </p>
              <p className="font-serif italic text-2xl text-primary mb-10">Your body holds the answer. We help you unlock it.</p>
              <button onClick={() => onNavigate(Page.Assessment)} className="bg-primary text-clinical-dark px-12 py-4 rounded-full font-medium text-sm uppercase hover:bg-obsidian hover:text-white transition-all shadow-xl shadow-primary/20">
                Start Free Assessment
              </button>
            </div>
          </div>
        </article>
      </div>
    );
  };

  return (
    <div className="bg-cream min-h-screen">
      {selectedBlogId ? renderDetailView() : renderListView()}
    </div>
  );
};

export default BlogPage;