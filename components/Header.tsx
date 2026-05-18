import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../types';
import Logo from './Logo';
import { ChevronDown, ArrowRight, Menu, X } from 'lucide-react';

interface NavItem {
  label: string;
  page?: Page;
  subItems?: { label: string; page: Page }[];
}

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = React.memo(({ currentPage, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<number>(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems: NavItem[] = [
    { label: 'Home', page: Page.Home },
    { label: 'About', page: Page.About },
    { 
      label: 'Treatments', 
      subItems: [
        { label: 'Overview', page: Page.Treatments },
        { label: 'Pricing', page: Page.Pricing },
      ]
    },
    { 
      label: 'Resources', 
      subItems: [
        { label: "FAQ's", page: Page.FAQ },
        { label: 'Medical Blog', page: Page.Blog },
      ]
    },
    { label: 'Contact', page: Page.Contact },
  ];

  useEffect(() => {
    // Mobile header is static (no visual change on scroll), so skip the listener entirely
    if (window.matchMedia('(max-width: 1023px)').matches) return;

    let ticking = false;
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(scrollRef.current > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }
  }, [isMenuOpen]);

  const handleNavigate = (page: Page) => {
    setIsMenuOpen(false);
    setActiveDropdown(null);
    onNavigate(page);
  };

  const isGroupActive = (item: NavItem) => {
    if (item.page === currentPage) return true;
    if (item.subItems) {
      return item.subItems.some(sub => sub.page === currentPage);
    }
    return false;
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 lg:transition-all lg:duration-300 ease-out py-0 ${
        scrolled ? 'glass-header shadow-md' : 'glass-header lg:bg-transparent lg:shadow-none lg:py-2'
      }`}>
        <div className={`max-w-[1440px] mx-auto flex items-center justify-between px-6 md:px-10 lg:px-20 lg:transition-all lg:duration-500 ease-in-out h-16 ${
          scrolled ? 'lg:h-24' : 'lg:h-36'
        }`}>
          {/* Logo */}
          <div
            className="flex items-center cursor-pointer shrink-0 z-50 transition-transform duration-300 hover:scale-105 active:scale-95"
            onClick={() => handleNavigate(Page.Home)}
          >
            <Logo size={scrolled || isMobile ? "sm" : "md"} />
          </div>

          {/* Desktop Navigation — shown on lg+ (1024px), mobile menu below 1024px */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-10">
            <nav className="flex items-center gap-8 lg:gap-10">
              {navItems.map((item) => (
                <div 
                  key={item.label} 
                  className="relative group py-4"
                  onMouseEnter={() => item.subItems && setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    onClick={() => item.page && handleNavigate(item.page)}
                    className={`text-[11px] lg:text-[12px] font-bold uppercase transition-all duration-300 hover:text-primary flex items-center gap-1.5 ${
                      isGroupActive(item) ? 'text-primary' : 'text-obsidian'
                    }`}
                  >
                    {item.label}
                    {item.subItems && (
                      <ChevronDown size={16} className={`transition-transform duration-300 ${activeDropdown === item.label ? 'rotate-180' : ''}`} />
                    )}
                    <span className={`absolute bottom-2 left-0 h-[2px] bg-primary transition-all duration-300 ease-out ${
                      isGroupActive(item) ? 'w-full' : 'w-0'
                    }`} />
                  </button>

                  {/* Dropdown Menu */}
                  {item.subItems && (
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 w-48 bg-white shadow-2xl rounded-2xl border border-black/5 p-2 transition-all duration-300 transform origin-top ${
                      activeDropdown === item.label ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }`}>
                      {item.subItems.map((sub) => (
                        <button
                          key={sub.label}
                          onClick={() => handleNavigate(sub.page)}
                          className={`w-full text-left px-5 py-3 rounded-xl text-2xs font-medium text-hint transition-all hover:bg-cream ${
                            currentPage === sub.page ? 'text-primary bg-primary/5' : 'text-muted hover:text-obsidian'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Added Sign In Button */}
            <button 
              onClick={() => handleNavigate(Page.SignIn)}
              className="bg-primary/10 text-primary border border-primary/20 px-6 py-2 rounded-full text-xs font-medium hover:bg-primary hover:text-white transition-all duration-300"
            >
              Sign In
            </button>
          </div>

          {/* Mobile Toggle — visible below lg */}
          <div className="flex lg:hidden items-center gap-2 z-50">
            <button
              onClick={() => handleNavigate(Page.SignIn)}
              className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors duration-200"
              aria-label="Sign in"
            >
              <span className="material-symbols-outlined text-3xl">
                account_circle
              </span>
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              <span className="transition-transform duration-500 ease-in-out inline-flex" style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden transition-all duration-500 ease-in-out ${
          isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="absolute inset-0 bg-obsidian/40 backdrop-blur-md" onClick={() => setIsMenuOpen(false)} />
        
        <nav 
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-white shadow-2xl transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          } flex flex-col`}
        >
          <div className="flex-grow pt-32 pb-10 px-8 flex flex-col gap-1 overflow-y-auto no-scrollbar">
            {navItems.map((item, idx) => (
              <div key={item.label} className="flex flex-col border-b border-gray-50 last:border-0">
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setMobileExpanded(mobileExpanded === item.label ? null : item.label);
                    } else if (item.page) {
                      handleNavigate(item.page);
                    }
                  }}
                  style={{ transitionDelay: `${idx * 40}ms` }}
                  className={`text-left flex items-center justify-between py-5 transition-all duration-500 ${
                    isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                  } ${isGroupActive(item) ? 'text-primary' : 'text-obsidian'}`}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-accent-gold/50 uppercase mb-1">0{idx + 1}</span>
                    <span className="text-2xl font-medium">{item.label}</span>
                  </div>
                  {item.subItems ? (
                    <ChevronDown size={24} className={`transition-transform duration-300 ${mobileExpanded === item.label ? 'rotate-180 text-primary' : 'text-gray-300'}`} />
                  ) : (
                    <ArrowRight size={20} className={`text-primary transition-all duration-300 ${
                      currentPage === item.page ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                    }`} />
                  )}
                </button>

                {/* Mobile Sub Items */}
                {item.subItems && (
                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    mobileExpanded === item.label ? 'max-h-64 opacity-100 pb-4' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="flex flex-col gap-1 pl-4 border-l-2 border-primary/20 ml-1">
                      {item.subItems.map((sub) => (
                        <button
                          key={sub.label}
                          onClick={() => handleNavigate(sub.page)}
                          className={`text-left py-3 text-[13px] font-bold uppercase transition-colors ${
                            currentPage === sub.page ? 'text-primary' : 'text-muted'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
});

export default Header;