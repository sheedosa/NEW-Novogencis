import React from 'react';
import { Page } from '../types';
import Logo from './Logo';
import { Phone, Mail, ArrowRight } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: Page) => void;
}

const Footer: React.FC<FooterProps> = React.memo(({ onNavigate }) => {
  return (
    <footer className="bg-white border-t border-black/5 px-6 md:px-12 lg:px-24 py-20 md:py-32">
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 md:gap-10">
          {/* Brand & Location Col */}
          <div className="md:col-span-4 space-y-10">
            <div 
              className="cursor-pointer transition-transform hover:scale-105 active:scale-95 origin-left w-fit" 
              onClick={() => onNavigate(Page.Home)}
            >
              <Logo size="lg" className="!justify-start" />
            </div>
            
            <p className="text-muted text-lg max-w-sm leading-relaxed font-medium">
              A bespoke doctor-led practice dedicated to hair restoration science.
            </p>

            <div className="space-y-4 pt-4 border-t border-gray-100 w-fit">
              <div className="flex items-center gap-3 text-sm text-muted font-bold tracking-tight">
                <Phone size={20} className="text-primary" />
                <a href="tel:+447356255598" className="hover:text-primary transition-colors">+44 7356 255598</a>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted font-bold tracking-tight">
                <Mail size={20} className="text-primary" />
                <a href="mailto:info@novogenics.co.uk" className="hover:text-primary transition-colors">info@novogenics.co.uk</a>
              </div>
            </div>

            <div className="flex gap-4">
              <a 
                href="https://www.instagram.com/novogenics/?hl=en" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 rounded-full border border-black/5 flex items-center justify-center text-obsidian hover:bg-primary hover:text-white transition-all duration-500 shadow-sm"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            </div>
          </div>

          {/* Links Grid */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6">
            {/* Explore Column */}
            <div className="space-y-8">
              <h4 className="text-[11px] font-medium tracking-[0.4em] uppercase text-obsidian">Explore</h4>
              <nav className="flex flex-col gap-5">
                {[
                  { label: 'Home', page: Page.Home },
                  { label: 'About Us', page: Page.About },
                  { label: 'Treatments', page: Page.Treatments },
                  { label: 'Pricing', page: Page.Pricing },
                  { label: 'Medical Blog', page: Page.Blog }
                ].map(link => (
                  <button key={link.label} onClick={() => onNavigate(link.page)} className="text-left text-muted hover:text-primary transition-colors text-sm font-bold tracking-tight">{link.label}</button>
                ))}
              </nav>
            </div>
            
            {/* Get Started Column */}
            <div className="space-y-8">
              <h4 className="text-[11px] font-medium tracking-[0.4em] uppercase text-obsidian">Get Started</h4>
              <nav className="flex flex-col gap-5">
                <button onClick={() => onNavigate(Page.Assessment)} className="text-left text-primary hover:text-accent-gold transition-colors text-sm font-medium tracking-tight flex items-center gap-2">VIRTUAL HAIR ASSESSMENT <ArrowRight size={16} /></button>
                <button onClick={() => onNavigate(Page.FAQ)} className="text-left text-muted hover:text-primary transition-colors text-sm font-bold tracking-tight">Clinical FAQs</button>
                <button onClick={() => onNavigate(Page.Contact)} className="text-left text-muted hover:text-primary transition-colors text-sm font-bold tracking-tight">Contact Us</button>
              </nav>
            </div>

            {/* Policies Column */}
            <div className="space-y-8">
              <h4 className="text-[11px] font-medium tracking-[0.4em] uppercase text-obsidian">Policies</h4>
              <nav className="flex flex-col gap-5">
                <button onClick={() => onNavigate(Page.PrivacyPolicy)} className="text-left text-muted hover:text-primary transition-colors text-sm font-bold tracking-tight">Privacy Policy</button>
                <button onClick={() => onNavigate(Page.CancellationPolicy)} className="text-left text-muted hover:text-primary transition-colors text-sm font-bold tracking-tight">Booking & Cancellation Policy</button>
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-24 md:mt-32 pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-10">
           <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">© 2026 Novogenics All rights reserved.</p>
              
              {/* Klarna Logo Integration */}
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted/60">We accept</span>
                 <img 
                    src="/images/klarna.jpg" 
                    alt="Klarna Logo" 
                    className="h-5 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                    referrerPolicy="no-referrer"
                 />
              </div>
           </div>

           <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted/50">Designed and Powered by</span>
              <a href="https://elconekt.com/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary hover:text-clinical-dark transition-colors">Elconekt</a>
           </div>
        </div>
      </div>
    </footer>
  );
});

export default Footer;