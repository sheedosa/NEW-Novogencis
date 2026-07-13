/**
 * Per-appointment notes editor (modal/bottom-sheet).
 *
 * Closes the SOAP-notes gap: doctors mark a session "Completed" but previously
 * had no UI to record per-appointment clinical notes. This modal opens from
 * the Schedule list and from inside the patient's ClientRecord, lets the
 * doctor edit the `notes` field on the appointment, and saves on demand.
 *
 * The appointment.notes field already exists on the type — this is pure UI.
 */

import React, { useEffect, useState } from 'react';
import { localTodayISO } from '../../utils/time';
import { Modal, Button, useToast } from '../../components/ui';
import { Appointment, Payment } from '../../types';
import { Save, CalendarDays, User as UserIcon, CreditCard } from 'lucide-react';

interface AppointmentNotesDrawerProps {
  appointment: Appointment | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Appointment>) => void | Promise<void>;
  /** Optional: record a session payment in the same flow (shown only when Completed). */
  onRecordPayment?: (clientId: string, payment: Payment) => void | Promise<void>;
}

export const AppointmentNotesDrawer: React.FC<AppointmentNotesDrawerProps> = ({
  appointment, onClose, onSave, onRecordPayment,
}) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Appointment['status']>('Confirmed');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Optional payment captured in the same flow when a session is completed.
  const [payAmount, setPayAmount] = useState('');
  const [payStatus, setPayStatus] = useState<'Paid' | 'Pending'>('Paid');

  useEffect(() => {
    if (appointment) {
      setNotes(appointment.notes || '');
      setStatus(appointment.status);
      setPayAmount('');
      setPayStatus('Paid');
      setDirty(false);
    }
  }, [appointment]);

  const handleSave = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      await onSave(appointment.id, { notes, status });
      // Optional: record the session payment in the same step. Non-blocking —
      // a payment hiccup must never lose the saved notes/status.
      const amt = parseFloat(payAmount);
      if (status === 'Completed' && onRecordPayment && payAmount && amt > 0) {
        try {
          await onRecordPayment(appointment.clientId, {
            id: `sess-${appointment.id}-${Date.now()}`,
            description: `${appointment.type} — session payment`,
            amount: amt,
            currency: 'GBP',
            status: payStatus,
            paidDate: payStatus === 'Paid' ? localTodayISO() : undefined,
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to record session payment:', err);
          toast.error('Notes saved, but the payment was not recorded', { description: 'Add it from the patient’s Money tab.' });
        }
      }
      toast.success('Session saved');
      onClose();
    } catch {
      // Keep the drawer open with the doctor's notes intact.
      toast.error('Could not save the notes', { description: 'Your notes are still here — please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!appointment}
      onClose={onClose}
      title="Appointment notes"
      subtitle={appointment ? `${appointment.type} · ${appointment.date} at ${appointment.time}` : undefined}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingIcon={<Save size={14} />}
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : appointment?.notes ? 'Update notes' : 'Add notes'}
          </Button>
        </div>
      }
    >
      {appointment && (
        <div className="flex flex-col gap-4">
          {/* Patient + date block */}
          <div className="flex flex-col gap-2 p-3 rounded-md bg-cream/40 border border-sand text-sm">
            <div className="flex items-center gap-2">
              <UserIcon size={14} className="text-muted" />
              <span className="text-obsidian font-medium">{appointment.clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <CalendarDays size={14} />
              <span>{appointment.date} · {appointment.time}{appointment.doctorName ? ` · ${appointment.doctorName}` : ''}</span>
            </div>
          </div>

          {/* Status — the selected pill IS the status display */}
          <div>
            <label className="text-sm font-medium text-obsidian block mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {(['Confirmed','Pending','Awaiting deposit','Completed','Cancelled','No-Show'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStatus(s); setDirty(true); }}
                  className={`px-3 py-2 rounded-md text-sm transition-colors ${
                    status === s
                      ? 'bg-obsidian text-white font-medium'
                      : 'bg-cream text-muted hover:text-obsidian'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-muted block mb-1.5" htmlFor="appt-notes">
              Clinical notes
            </label>
            <textarea
              id="appt-notes"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              rows={8}
              placeholder="Add SOAP notes — subjective, objective, assessment, plan. Visible to clinicians only."
              className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm focus:ring-2 focus:ring-primary/20 resize-y leading-relaxed"
            />
            <p className="text-xs text-hint mt-1.5">
              Notes are saved on the appointment record and visible inside the patient's record under this session.
            </p>
          </div>

          {/* Optional payment — only when completing, so the session closes in one place */}
          {status === 'Completed' && onRecordPayment && (
            <div className="border-t border-sand pt-4">
              <label className="text-sm font-medium text-obsidian flex items-center gap-1.5 mb-2">
                <CreditCard size={14} className="text-muted" /> Payment <span className="text-xs text-hint font-normal">· optional</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-grow">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">£</span>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={payAmount}
                    onChange={(e) => { setPayAmount(e.target.value); setDirty(true); }}
                    placeholder="0.00"
                    className="w-full bg-cream border-transparent rounded-md pl-7 pr-3 py-2.5 text-base sm:text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {(['Paid', 'Pending'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setPayStatus(s); setDirty(true); }}
                      className={`px-3 py-2.5 rounded-md text-sm transition-colors ${
                        payStatus === s ? 'bg-obsidian text-white font-medium' : 'bg-cream text-muted hover:text-obsidian'
                      }`}
                    >
                      {s === 'Pending' ? 'Invoice' : 'Paid'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-hint mt-1.5">Record what the patient paid for this session, or leave blank.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default AppointmentNotesDrawer;
