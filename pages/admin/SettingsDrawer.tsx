import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Plus, Pencil, Trash2, Save, FileText, MessageSquare, Mail,
  Sliders, Users as UsersIcon, BookText, LayoutGrid, Maximize2, Minimize2,
  Copy, Check, UserCheck, ExternalLink,
} from 'lucide-react';
import { Button, Input, Select, Textarea, EmptyState, Portal } from '../../components/ui';
import { useAdminContext } from './context';
import { AdminType } from '../../types';
import { Template, TemplateCategory } from '../../types';

type SettingsTab = 'preferences' | 'templates' | 'staff';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const DENSITY_KEY = 'novogenics_density';
const setDensity = (mode: 'comfortable' | 'compact') => {
  document.body.setAttribute('data-density', mode);
  try { localStorage.setItem(DENSITY_KEY, mode); } catch {}
};

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onClose }) => {
  const {
    templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
    user, effectiveAdminType, setEffectiveAdminType,
    onSetViewAsTestPatient,
  } = useAdminContext();

  const [tab, setTab] = useState<SettingsTab>('preferences');
  const [density, setDensityState] = useState<'comfortable' | 'compact'>('comfortable');

  // Initialise density from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DENSITY_KEY) as 'comfortable' | 'compact' | null;
      if (stored === 'compact' || stored === 'comfortable') {
        setDensityState(stored);
        document.body.setAttribute('data-density', stored);
      }
    } catch {}
  }, []);

  const changeDensity = (mode: 'comfortable' | 'compact') => {
    setDensityState(mode);
    setDensity(mode);
  };

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[180] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-obsidian/55 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.8 }}
            className="relative w-full sm:w-[480px] max-w-full bg-white shadow-modal flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-sand flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-medium text-obsidian">Settings</h2>
                <p className="text-xs text-muted">Preferences, templates and clinic</p>
              </div>
              <button onClick={onClose} className="btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-3 py-2 border-b border-sand flex gap-1 shrink-0">
              {([
                { id: 'preferences', label: 'Preferences', icon: <Sliders size={13} /> },
                { id: 'templates',   label: 'Templates',   icon: <BookText size={13} /> },
                { id: 'staff',       label: 'Staff',       icon: <UsersIcon size={13} /> },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    tab === t.id
                      ? 'bg-obsidian text-white font-medium'
                      : 'text-muted hover:bg-cream hover:text-obsidian'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Body — bottom safe-area inset so content clears the iOS home indicator */}
            <div className="flex-1 overflow-y-auto" data-scroll style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <AnimatePresence mode="wait" initial={false}>
                {tab === 'preferences' && (
                  <motion.div
                    key="prefs"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                    className="p-5 flex flex-col gap-5"
                  >
                    <div>
                      <h3 className="text-sm font-medium text-obsidian mb-2">Density</h3>
                      <p className="text-xs text-muted mb-3">How much information shows on screen at once.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => changeDensity('comfortable')}
                          className={`p-4 rounded-md border text-left transition-all ${
                            density === 'comfortable'
                              ? 'border-obsidian bg-cream'
                              : 'border-sand hover:border-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Maximize2 size={14} className="text-muted" />
                            {density === 'comfortable' && <Check size={14} className="text-obsidian" />}
                          </div>
                          <p className="text-sm font-medium text-obsidian">Comfortable</p>
                          <p className="text-xs text-muted mt-0.5">More breathing room.</p>
                        </button>
                        <button
                          onClick={() => changeDensity('compact')}
                          className={`p-4 rounded-md border text-left transition-all ${
                            density === 'compact'
                              ? 'border-obsidian bg-cream'
                              : 'border-sand hover:border-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Minimize2 size={14} className="text-muted" />
                            {density === 'compact' && <Check size={14} className="text-obsidian" />}
                          </div>
                          <p className="text-sm font-medium text-obsidian">Compact</p>
                          <p className="text-xs text-muted mt-0.5">More on every screen.</p>
                        </button>
                      </div>
                    </div>

                    <div className="divider" />

                    <div>
                      <h3 className="text-sm font-medium text-obsidian mb-2">View as</h3>
                      <p className="text-xs text-muted mb-3">
                        {user?.adminType === 'technical'
                          ? 'Tech admins can preview the system from a doctor’s perspective.'
                          : 'Only technical admins can switch viewpoints.'}
                      </p>
                      <Select
                        disabled={user?.adminType !== 'technical'}
                        value={effectiveAdminType}
                        onChange={(e) => setEffectiveAdminType(e.target.value as AdminType | 'all')}
                      >
                        <option value="all">All accounts (ultimate)</option>
                        <option value="doctor-female">Dr Aminah</option>
                        <option value="doctor-male">Dr Waqas</option>
                      </Select>
                    </div>

                    <div className="divider" />

                    <div>
                      <h3 className="text-sm font-medium text-obsidian mb-2">Keyboard shortcuts</h3>
                      <div className="flex flex-col gap-2 text-sm">
                        <ShortcutRow keys={['⌘', 'K']} label="Open quick find / command palette" />
                        <ShortcutRow keys={['Esc']}    label="Close any modal or drawer" />
                        <ShortcutRow keys={['↑', '↓']} label="Navigate in command palette" />
                      </div>
                    </div>

                    {/* Developer tools — only visible to technical admins so
                        clinical doctors don't see (or accidentally trigger) it. */}
                    {user?.adminType === 'technical' && (
                      <>
                        <div className="divider" />
                        <div>
                          <p className="text-xs uppercase tracking-wider text-hint mb-2">Developer</p>
                          <h3 className="text-sm font-medium text-obsidian mb-2 flex items-center gap-1.5">
                            <UserCheck size={14} /> Preview patient portal
                          </h3>
                          <p className="text-xs text-muted mb-3 leading-relaxed">
                            Opens the patient dashboard using the clinic's demo account. You stay signed in as yourself.
                            Use this to see what your patients see.
                          </p>
                          <Button
                            variant="ghost"
                            leadingIcon={<ExternalLink size={13} />}
                            onClick={() => { onSetViewAsTestPatient?.(true); onClose(); }}
                          >
                            Open test patient view
                          </Button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {tab === 'templates' && (
                  <motion.div
                    key="tpl"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                  >
                    <TemplatesTab
                      templates={templates}
                      onAdd={onAddTemplate}
                      onUpdate={onUpdateTemplate}
                      onDelete={onDeleteTemplate}
                    />
                  </motion.div>
                )}

                {tab === 'staff' && (
                  <motion.div
                    key="staff"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                    className="p-5"
                  >
                    <StaffTab />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
    </Portal>
  );
};

// ── Shortcut row ───────────────────────────────────────────────────────────
const ShortcutRow: React.FC<{ keys: string[]; label: string }> = ({ keys, label }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-obsidian">{label}</span>
    <span className="flex items-center gap-1">
      {keys.map(k => (
        <kbd key={k} className="text-xs text-hint border border-sand rounded px-1.5 py-0.5 bg-cream/60 font-mono">
          {k}
        </kbd>
      ))}
    </span>
  </div>
);

// ── Templates tab ──────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  note:    'Clinical note',
  message: 'Portal message',
  email:   'Email',
};
const CATEGORY_ICON: Record<TemplateCategory, React.ReactNode> = {
  note:    <FileText size={13} />,
  message: <MessageSquare size={13} />,
  email:   <Mail size={13} />,
};

interface TemplatesTabProps {
  templates: Template[];
  onAdd: (tpl: Omit<Template, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Template>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TemplatesTab: React.FC<TemplatesTabProps> = ({ templates, onAdd, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState<Template | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', category: 'note' as TemplateCategory });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
    [templates],
  );

  const startNew = () => {
    setDraft({ title: '', body: '', category: 'note' });
    setEditing(null);
    setShowNew(true);
  };

  const startEdit = (tpl: Template) => {
    setDraft({ title: tpl.title, body: tpl.body, category: tpl.category });
    setEditing(tpl);
    setShowNew(true);
  };

  const submit = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    if (editing) {
      await onUpdate(editing.id, draft);
    } else {
      await onAdd(draft);
    }
    setShowNew(false);
    setEditing(null);
    setDraft({ title: '', body: '', category: 'note' });
  };

  const copy = async (tpl: Template) => {
    try {
      await navigator.clipboard.writeText(tpl.body);
      setCopiedId(tpl.id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {}
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Save snippets you reuse: SOAP notes, aftercare advice, replies.</p>
        <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={startNew}>New</Button>
      </div>

      {sorted.length === 0 && !showNew ? (
        <EmptyState
          icon={<BookText size={16} />}
          title="No templates yet"
          description="Create one and reuse it across notes, messages and emails."
          action={<Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={startNew}>New template</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(tpl => (
            <div key={tpl.id} className="border border-sand rounded-md p-3 hover:border-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">{CATEGORY_ICON[tpl.category]}</span>
                    <p className="text-sm font-medium text-obsidian truncate">{tpl.title}</p>
                  </div>
                  <p className="text-xs text-hint mt-0.5">{CATEGORY_LABEL[tpl.category]}</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => copy(tpl)} className="btn-icon" aria-label="Copy">
                    {copiedId === tpl.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => startEdit(tpl)} className="btn-icon" aria-label="Edit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => onDelete(tpl.id)} className="btn-icon hover:!text-danger" aria-label="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted mt-2 leading-relaxed line-clamp-3 whitespace-pre-wrap">{tpl.body}</p>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="border border-sand rounded-md p-3 bg-cream/40 flex flex-col gap-3">
          <p className="text-sm font-medium text-obsidian">{editing ? 'Edit template' : 'New template'}</p>
          <Select label="Category" value={draft.category} onChange={(e) => setDraft(d => ({ ...d, category: e.target.value as TemplateCategory }))}>
            <option value="note">Clinical note</option>
            <option value="message">Portal message</option>
            <option value="email">Email</option>
          </Select>
          <Input
            label="Title"
            value={draft.title}
            onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="e.g. PRP aftercare instructions"
          />
          <Textarea
            label="Body"
            rows={5}
            value={draft.body}
            onChange={(e) => setDraft(d => ({ ...d, body: e.target.value }))}
            placeholder="Write the template text. You can paste it anywhere later with one click."
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowNew(false); setEditing(null); }}>Cancel</Button>
            <Button variant="primary" leadingIcon={<Save size={13} />} onClick={submit} disabled={!draft.title.trim() || !draft.body.trim()}>
              {editing ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Staff tab ──────────────────────────────────────────────────────────────
const StaffTab: React.FC = () => {
  // The user-account model lives in App.tsx and isn't passed through to AdminContext
  // (it would require new plumbing). For now, the Staff view is the known set
  // of admin accounts. Working-hour editing is shown as a future capability.
  const { user, getInitials } = useAdminContext();
  const STAFF = [
    {
      id: 'aminah',
      fullName: 'Dr Aminah Amer',
      role: 'Clinical Director (Female patients)',
      email: 'aminah_amer@hotmail.com',
      hours: 'Mon–Fri · 09:00–18:00',
    },
    {
      id: 'waqas',
      fullName: 'Dr Waqas Farid',
      role: 'Clinical Director (Male patients)',
      email: 'wfarid812@gmail.com',
      hours: 'Tue / Thu / Sat · 10:00–17:00',
    },
    {
      id: 'rasheed',
      fullName: 'Rasheed Amer',
      role: 'Technical Admin',
      email: 'rasheedamer99@gmail.com',
      hours: '—',
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Clinic team. Per-clinician scheduling rules are read-only here while we build the editor.</p>
      <div className="flex flex-col gap-2">
        {STAFF.map(s => (
          <div key={s.id} className="border border-sand rounded-md p-3 flex items-center gap-3 hover:bg-cream/40 transition-colors">
            <div className="avatar avatar-md shrink-0">{getInitials(s.fullName)}</div>
            <div className="min-w-0 flex-grow">
              <p className="text-sm font-medium text-obsidian truncate">{s.fullName}</p>
              <p className="text-xs text-muted truncate">{s.role}</p>
              <p className="text-xs text-hint truncate">{s.email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted">Hours</p>
              <p className="text-xs text-obsidian">{s.hours}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-hint mt-2">
        Per-day working hours editor coming in the next wave — currently the clinic schedules globally on the calendar.
      </p>
    </div>
  );
};

export default SettingsDrawer;
