import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown, ArrowRight, User } from 'lucide-react';
import { Page } from '../types';
import Logo from './Logo';

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
  const [isMenuOpen, setIsMenuOpen]         = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const scrollRef = useRef<number>(0);

  const navItems: NavItem[] = [
    { label: 'Home',    page: Page.Home },
    { label: 'About',   page: Page.About },
    {
      label: 'Treatments',
      subItems: [
        { label: 'Treatment overview', page: Page.Treatments },
        { label: 'Pricing & packages', page: Page.Pricing },
      ],
    },
    {
      label: 'Resources',
      subItems: [
        { label: 'FAQ',          page: Page.FAQ },
        { label: 'Medical blog', page: Page.Blog },
      ],
    },
    { label: 'Contact', page: Page.Contact },
  ];

  // Skip scroll listener on mobile — avoids setState on every scroll frame
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) return;

    let ticking = false;
    const onScroll = () => {
      scrollRef.current = window.scrollY;
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(scrollRef.current > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const handleNavigate = (page: Page) => {
    setIsMenuOpen(false);
    setActiveDropdown(null);
    onNavigate(page);
  };

  const isGroupActive = (item: NavItem) =>
    item.page === currentPage || !!item.subItems?.some(s => s.page === currentPage);

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 50,
          transition: 'all 0.25s ease',
          ...(scrolled
            ? {
                background: 'rgba(253,252,251,0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '0.5px solid var(--color-sand)',
              }
            : { background: 'transparent' }),
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            height: scrolled ? 56 : 72,
            transition: 'height 0.25s ease',
          }}
        >
          {/* Logo */}
          <div
            onClick={() => handleNavigate(Page.Home)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Logo size={scrolled ? 'sm' : 'md'} />
          </div>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}
               className="hidden xl:flex">
            {navItems.map(item => (
              <div
                key={item.label}
                style={{ position: 'relative' }}
                onMouseEnter={() => item.subItems && setActiveDropdown(item.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  onClick={() => item.page && handleNavigate(item.page)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isGroupActive(item) ? 500 : 400,
                    color: isGroupActive(item) ? 'var(--color-obsidian)' : 'var(--color-muted)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s, background 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-obsidian)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isGroupActive(item) ? 'var(--color-obsidian)' : 'var(--color-muted)'; }}
                >
                  {item.label}
                  {item.subItems && (
                    <ChevronDown
                      size={13}
                      style={{
                        transform: activeDropdown === item.label ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  )}
                </button>

                {/* Dropdown */}
                {item.subItems && (
                  <div
                    style={{
                      position: 'absolute', top: '100%', left: '50%',
                      transform: 'translateX(-50%)',
                      marginTop: 4,
                      width: 200,
                      background: '#fff',
                      border: '0.5px solid var(--color-sand)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 6,
                      boxShadow: 'var(--shadow-panel)',
                      opacity: activeDropdown === item.label ? 1 : 0,
                      pointerEvents: activeDropdown === item.label ? 'all' : 'none',
                      transition: 'opacity 0.15s',
                      zIndex: 60,
                    }}
                  >
                    {item.subItems.map(sub => (
                      <button
                        key={sub.label}
                        onClick={() => handleNavigate(sub.page)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 12px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: currentPage === sub.page ? 500 : 400,
                          color: currentPage === sub.page ? 'var(--color-obsidian)' : 'var(--color-muted)',
                          background: currentPage === sub.page ? 'var(--color-cream)' : 'transparent',
                          border: 'none', cursor: 'pointer', transition: 'background 0.1s, color 0.1s',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-cream)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-obsidian)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = currentPage === sub.page ? 'var(--color-cream)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = currentPage === sub.page ? 'var(--color-obsidian)' : 'var(--color-muted)'; }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* CTA + Sign in */}
          <div className="hidden xl:flex" style={{ alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => handleNavigate(Page.SignIn)}
              className="btn btn-ghost btn-sm"
            >
              <User size={13} /> Sign in
            </button>
            <button
              onClick={() => handleNavigate(Page.Assessment)}
              className="btn btn-primary btn-sm"
            >
              Free assessment <ArrowRight size={13} />
            </button>
          </div>

          {/* Mobile controls */}
          <div className="flex xl:hidden" style={{ alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => handleNavigate(Page.SignIn)}
              className="btn-icon"
              style={{ width: 36, height: 36, padding: 0 }}
              aria-label="Sign in"
            >
              <User size={18} />
            </button>
            <button
              onClick={() => setIsMenuOpen(v => !v)}
              className="btn-icon"
              style={{ width: 36, height: 36, padding: 0 }}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu ───────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          opacity: isMenuOpen ? 1 : 0,
          visibility: isMenuOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.25s, visibility 0.25s',
          pointerEvents: isMenuOpen ? 'all' : 'none',
        }}
        className="xl:hidden"
      >
        {/* Backdrop */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(28,25,23,0.40)',
          }}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Drawer */}
        <nav
          style={{
            position: 'absolute', top: 0, right: 0,
            width: '85%', maxWidth: 340, height: '100%',
            background: 'var(--color-ivory)',
            display: 'flex', flexDirection: 'column',
            transform: isMenuOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          {/* Drawer header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--color-sand)' }}>
            <Logo size="sm" />
            <button onClick={() => setIsMenuOpen(false)} className="btn-icon" style={{ width: 32, height: 32, padding: 0 }} aria-label="Close menu">
              <X size={16} />
            </button>
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {navItems.map(item => (
              <div key={item.label}>
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setMobileExpanded(v => v === item.label ? null : item.label);
                    } else if (item.page) {
                      handleNavigate(item.page);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 10px',
                    fontSize: 15, fontWeight: 500,
                    color: isGroupActive(item) ? 'var(--color-obsidian)' : 'var(--color-muted)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderBottom: '0.5px solid var(--color-cream)',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>{item.label}</span>
                  {item.subItems && (
                    <ChevronDown
                      size={15}
                      style={{
                        transform: mobileExpanded === item.label ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                        color: 'var(--color-hint)',
                      }}
                    />
                  )}
                </button>

                {item.subItems && mobileExpanded === item.label && (
                  <div style={{ paddingLeft: 16, paddingBottom: 8 }}>
                    {item.subItems.map(sub => (
                      <button
                        key={sub.label}
                        onClick={() => handleNavigate(sub.page)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 10px',
                          fontSize: 14,
                          color: currentPage === sub.page ? 'var(--color-obsidian)' : 'var(--color-muted)',
                          fontWeight: currentPage === sub.page ? 500 : 400,
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile CTA */}
          <div style={{ padding: 16, borderTop: '0.5px solid var(--color-sand)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => handleNavigate(Page.Assessment)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Free hair assessment <ArrowRight size={14} />
            </button>
            <button onClick={() => handleNavigate(Page.SignIn)} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
              <User size={14} /> Sign in to portal
            </button>
          </div>
        </nav>
      </div>
    </>
  );
});

Header.displayName = 'Header';
export default Header;
