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
import { Modal, Button, StatusBadge } from '../../components/ui';
import { Appointment } from '../../types';
import { Save, CalendarDays, User as UserIcon } from 'lucide-react';

interface AppointmentNotesDrawerProps {
  appointment: Appointment | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Appointment>) => void | Promise<void>;
}

export const AppointmentNotesDrawer: React.FC<AppointmentNotesDrawerProps> = ({
  appointment, onClose, onSave,
}) => {
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Appointment['status']>('Confirmed');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (appointment) {
      setNotes(appointment.notes || '');
      setStatus(appointment.status);
      setDirty(false);
    }
  }, [appointment]);

  const handleSave = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      await onSave(appointment.id, { notes, status });
      onClose();
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
            {saving ? 'Saving…' : 'Save changes'}
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

          {/* Status */}
          <div>
            <label className="text-xs text-muted block mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {(['Confirmed','Pending','Awaiting deposit','Completed','Cancelled','No-Show'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStatus(s); setDirty(true); }}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    status === s
                      ? 'bg-obsidian text-white font-medium'
                      : 'bg-cream text-muted hover:text-obsidian'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <StatusBadge status={status} />
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
        </div>
      )}
    </Modal>
  );
};

export default AppointmentNotesDrawer;
