import React, { useState, useRef, useEffect } from 'react';
import { Message, Client } from '../types';
import { FORMS } from '../constants';
import { Printer, X, FileEdit, PenLine, PenTool } from 'lucide-react';
import { Button, Input } from './ui';

type FormFieldValue = string | boolean;
type FormData = Record<string, FormFieldValue>;

interface InteractiveFormProps {
  message: Message;
  client?: Client;
  isReadOnly?: boolean;
  isSaving?: boolean;
  onSave?: (formData: FormData, signature: string) => void;
  onClose: () => void;
}

export const InteractiveForm: React.FC<InteractiveFormProps> = ({
  message, client, isReadOnly = false, isSaving = false, onSave, onClose,
}) => {
  const form = FORMS.find(f => f.id === message.formId);
  const [formData, setFormData] = useState<FormData>(() => {
    if (message.formData) return message.formData as FormData;
    if (client) {
      return {
        name: client.name,
        email: client.email,
        phone: client.phone,
        dob: client.dob,
        address: client.address || '',
        signingDate: new Date().toISOString().split('T')[0],
      };
    }
    return { signingDate: new Date().toISOString().split('T')[0] };
  });
  const [signature, setSignature] = useState(message.signature || '');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (canvasRef.current && message.signature && isReadOnly) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); };
        img.src = message.signature;
      }
    }
  }, [message.signature, isReadOnly]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isReadOnly) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) setSignature(canvasRef.current.toDataURL());
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isReadOnly || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1C1917';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setSignature('');
      }
    }
  };

  const handleInputChange = (field: string, value: FormFieldValue) => {
    if (isReadOnly) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!form) return null;

  // Narrowing helpers so JSX inputs/checkboxes get the right primitive type.
  const str = (field: string): string => {
    const v = formData[field];
    return typeof v === 'string' ? v : '';
  };
  const bool = (field: string): boolean => formData[field] === true;

  // Per-form required-field validation. Submit is gated on this in addition to signature.
  const validateForm = (): { valid: boolean; missingField?: string } => {
    const requireFilled = (field: string, label: string) => {
      const v = formData[field];
      if (typeof v !== 'string' || v.trim().length === 0) return label;
      return null;
    };
    const requireChecked = (field: string, label: string) =>
      formData[field] === true ? null : label;

    if (form.id === 'prp-consent' || form.id === 'microneedling-consent') {
      const missing =
        requireFilled('name', 'Full name') ||
        requireFilled('dob', 'Date of birth') ||
        requireFilled('address', 'Address') ||
        requireFilled('phone', 'Phone number') ||
        requireFilled('email', 'Email') ||
        requireChecked('informed', 'Informed declaration') ||
        requireChecked('multiple_sessions', 'Multiple sessions declaration') ||
        requireChecked('disclosed', 'Disclosure declaration') ||
        requireChecked('consent', 'Consent declaration');
      return missing ? { valid: false, missingField: missing } : { valid: true };
    }
    if (form.id === 'aftercare-form') {
      const missing =
        requireFilled('name', 'Full name') ||
        requireChecked('acknowledged', 'Aftercare acknowledgement');
      return missing ? { valid: false, missingField: missing } : { valid: true };
    }
    return { valid: true };
  };

  const validation = validateForm();
  const canSubmit = !!signature && validation.valid && !isSaving;

  const renderFields = () => {
    if (form.id === 'prp-consent' || form.id === 'microneedling-consent') {
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Full name"        type="text"  value={str('name')}            onChange={(e) => handleInputChange('name', e.target.value)}            disabled={isReadOnly} placeholder="Patient's full name" />
            <Input label="Date of birth"    type="date"  value={str('dob')}             onChange={(e) => handleInputChange('dob', e.target.value)}             disabled={isReadOnly} />
            <Input className="md:col-span-2" label="Address" type="text" value={str('address')} onChange={(e) => handleInputChange('address', e.target.value)} disabled={isReadOnly} placeholder="Full residential address" />
            <Input label="Phone number"     type="tel"   value={str('phone')}           onChange={(e) => handleInputChange('phone', e.target.value)}           disabled={isReadOnly} placeholder="Contact number" />
            <Input label="Email"            type="email" value={str('email')}           onChange={(e) => handleInputChange('email', e.target.value)}           disabled={isReadOnly} placeholder="Email address" />
            <Input label="Appointment date" type="date"  value={str('appointmentDate')} onChange={(e) => handleInputChange('appointmentDate', e.target.value)} disabled={isReadOnly} />
            <Input label="Appointment time" type="time"  value={str('appointmentTime')} onChange={(e) => handleInputChange('appointmentTime', e.target.value)} disabled={isReadOnly} />
            <Input label="Date of signing"  type="date"  value={str('signingDate') || new Date().toISOString().split('T')[0]} onChange={(e) => handleInputChange('signingDate', e.target.value)} disabled={isReadOnly} />
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <p className="text-sm font-medium text-obsidian mb-1">Declarations</p>
            {[
              { id: 'informed',          label: 'I have been informed about the procedure, its purpose, and potential risks.' },
              { id: 'multiple_sessions', label: 'I understand that multiple sessions may be required for optimal results.' },
              { id: 'disclosed',         label: 'I have disclosed all medical conditions and medications I am currently taking.' },
              { id: 'consent',           label: 'I consent to the treatment.' },
            ].map(item => (
              <label key={item.id} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={bool(item.id)}
                  onChange={(e) => handleInputChange(item.id, e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 w-4 h-4 rounded-sm border-sand text-obsidian focus:ring-primary/30"
                />
                <span className="text-sm text-muted group-hover:text-obsidian transition-colors leading-relaxed">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (form.id === 'aftercare-form') {
      return (
        <div className="flex flex-col gap-4">
          <div className="bg-cream rounded-md border border-sand p-4">
            <p className="text-sm text-obsidian leading-relaxed">
              "I have received and understood the aftercare instructions, including washing restrictions, exercise limitations, and sun protection."
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Full name"       type="text" value={str('name')}        onChange={(e) => handleInputChange('name', e.target.value)}        disabled={isReadOnly} placeholder="Patient's full name" />
            <Input label="Date of signing" type="date" value={str('signingDate') || new Date().toISOString().split('T')[0]} onChange={(e) => handleInputChange('signingDate', e.target.value)} disabled={isReadOnly} />
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={bool('acknowledged')}
              onChange={(e) => handleInputChange('acknowledged', e.target.checked)}
              disabled={isReadOnly}
              className="mt-1 w-4 h-4 rounded-sm border-sand text-obsidian focus:ring-primary/30"
            />
            <span className="text-sm text-obsidian">I acknowledge and agree to follow these instructions.</span>
          </label>
        </div>
      );
    }

    return <p className="text-sm text-muted">Interactive fields not configured for this form type.</p>;
  };

  return (
    <div className="fixed inset-0 bg-obsidian/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-modal flex flex-col overflow-hidden animate-fade-up">
        <div className="px-5 py-4 border-b border-sand flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-obsidian truncate">{form.title}</h2>
            <p className="text-xs text-muted mt-0.5">
              {isReadOnly ? 'Completed record' : 'Requires your signature'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isReadOnly && (
              <button onClick={() => window.print()} className="btn-icon" aria-label="Print">
                <Printer size={14} />
              </button>
            )}
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {/* Form content */}
          <div className="bg-cream/60 border border-sand rounded-md p-4">
            <p className="text-sm text-obsidian leading-relaxed whitespace-pre-wrap">
              {form.content}
            </p>
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileEdit size={14} className="text-muted" />
              <h3 className="text-sm font-medium text-obsidian">Patient information & declarations</h3>
            </div>
            {renderFields()}
          </div>

          {/* Signature */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2">
                <PenLine size={14} className="text-muted" />
                <h3 className="text-sm font-medium text-obsidian">Patient signature</h3>
              </div>
              {!isReadOnly && signature && (
                <button onClick={clearSignature} className="text-xs text-danger hover:underline">
                  Clear
                </button>
              )}
            </div>

            <div className="bg-cream rounded-md border border-dashed border-sand h-36 relative overflow-hidden">
              {isReadOnly && !signature ? (
                <div className="absolute inset-0 flex items-center justify-center text-hint text-sm">
                  No signature provided
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={144}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseOut={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className={`w-full h-full touch-none ${isReadOnly ? 'cursor-default' : 'cursor-crosshair'}`}
                />
              )}
            </div>
            <div className="mt-2 flex justify-between items-center">
              <p className="text-xs text-muted">
                {isReadOnly ? `Signed on ${new Date(message.signedAt!).toLocaleString('en-GB')}` : 'Sign above with mouse or touch'}
              </p>
              {formData.name && (
                <p className="text-sm text-obsidian">{formData.name as string}</p>
              )}
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="px-5 py-4 border-t border-sand bg-ivory shrink-0 flex flex-col gap-2">
            {!validation.valid && (
              <p className="text-xs text-warning-text">
                Please complete: <span className="font-medium">{validation.missingField}</span>
              </p>
            )}
            {!signature && validation.valid && (
              <p className="text-xs text-muted">Add your signature above to submit.</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => canSubmit && onSave?.(formData, signature)}
                disabled={!canSubmit}
                loading={isSaving}
                leadingIcon={<PenTool size={14} />}
              >
                Sign &amp; submit
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
