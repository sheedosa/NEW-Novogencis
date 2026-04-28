import React, { useState, useRef, useEffect } from 'react';
import { Message, Client } from '../types';
import { FORMS } from '../constants';
import { Card } from './Card';
import Logo from './Logo';

interface InteractiveFormProps {
  message: Message;
  client?: Client;
  isReadOnly?: boolean;
  isSaving?: boolean;
  onSave?: (formData: Record<string, any>, signature: string) => void;
  onClose: () => void;
}

export const InteractiveForm: React.FC<InteractiveFormProps> = ({ message, client, isReadOnly = false, isSaving = false, onSave, onClose }) => {
  const form = FORMS.find(f => f.id === message.formId);
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (message.formData) return message.formData;
    
    // Pre-fill with client data if available
    if (client) {
      return {
        name: client.name,
        email: client.email,
        phone: client.phone,
        dob: client.dob,
        address: client.address || '',
        signingDate: new Date().toISOString().split('T')[0]
      };
    }
    
    return {
      signingDate: new Date().toISOString().split('T')[0]
    };
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
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
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
    if (canvasRef.current) {
      setSignature(canvasRef.current.toDataURL());
    }
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
    ctx.strokeStyle = '#141414';

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

  const handleInputChange = (field: string, value: any) => {
    if (isReadOnly) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!form) return null;

  // Simple parser for the form content to identify fields
  // In a real app, this would be a structured schema
  const renderFields = () => {
    if (form.id === 'prp-consent' || form.id === 'microneedling-consent') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Full Name</label>
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isReadOnly}
                placeholder="Patient's Full Name"
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Date of Birth</label>
              <input 
                type="date" 
                value={formData.dob || ''} 
                onChange={(e) => handleInputChange('dob', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Address</label>
              <input 
                type="text" 
                value={formData.address || ''} 
                onChange={(e) => handleInputChange('address', e.target.value)}
                disabled={isReadOnly}
                placeholder="Full Residential Address"
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Phone Number</label>
              <input 
                type="tel" 
                value={formData.phone || ''} 
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={isReadOnly}
                placeholder="Contact Number"
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Email</label>
              <input 
                type="email" 
                value={formData.email || ''} 
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isReadOnly}
                placeholder="Email Address"
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Date of Appointment</label>
              <input 
                type="date" 
                value={formData.appointmentDate || ''} 
                onChange={(e) => handleInputChange('appointmentDate', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Time</label>
              <input 
                type="time" 
                value={formData.appointmentTime || ''} 
                onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Date of Signing</label>
              <input 
                type="date" 
                value={formData.signingDate || new Date().toISOString().split('T')[0]} 
                onChange={(e) => handleInputChange('signingDate', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-xs font-bold text-text-main">Declarations:</p>
            {[
              { id: 'informed', label: 'I have been informed about the procedure, its purpose, and potential risks.' },
              { id: 'multiple_sessions', label: 'I understand that multiple sessions may be required for optimal results.' },
              { id: 'disclosed', label: 'I have disclosed all medical conditions and medications I am currently taking.' },
              { id: 'consent', label: 'I consent to the treatment.' }
            ].map(item => (
              <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={formData[item.id] || false}
                  onChange={(e) => handleInputChange(item.id, e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 rounded border-black/10 text-primary focus:ring-primary/20"
                />
                <span className="text-[11px] leading-relaxed text-text-muted group-hover:text-text-main transition-colors">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (form.id === 'aftercare-form') {
      return (
        <div className="space-y-6">
          <div className="bg-bg-soft p-6 rounded-2xl border border-black/5">
            <p className="text-[11px] leading-relaxed text-text-main italic">
              "I have received and understood the aftercare instructions provided to me, including washing restrictions, exercise limitations, and sun protection."
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Full Name</label>
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isReadOnly}
                placeholder="Patient's Full Name"
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1 block">Date of Signing</label>
              <input 
                type="date" 
                value={formData.signingDate || new Date().toISOString().split('T')[0]} 
                onChange={(e) => handleInputChange('signingDate', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.acknowledged || false}
              onChange={(e) => handleInputChange('acknowledged', e.target.checked)}
              disabled={isReadOnly}
              className="mt-1 rounded border-black/10 text-primary focus:ring-primary/20"
            />
            <span className="text-[11px] font-bold text-text-main">I acknowledge and agree to follow these instructions.</span>
          </label>
        </div>
      );
    }

    return <p className="text-xs text-text-muted italic">Interactive fields not configured for this form type.</p>;
  };

  return (
    <div className="fixed inset-0 bg-clinical-dark/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-up">
        <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-lg font-black text-text-main">{form.title}</h2>
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
              {isReadOnly ? 'Completed Record' : 'Requires your signature'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isReadOnly && (
              <button 
                onClick={() => window.print()} 
                className="w-10 h-10 rounded-full hover:bg-bg-soft flex items-center justify-center transition-colors text-text-muted hover:text-primary"
                title="Print Form"
              >
                <span className="material-symbols-outlined">print</span>
              </button>
            )}
            <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-bg-soft flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-10 no-scrollbar">
          <div className="flex flex-col items-center text-center mb-10">
            <Logo size="sm" className="mb-4 opacity-20" />
            <h1 className="text-2xl font-serif text-text-main italic mb-2">{form.title}</h1>
            <div className="w-12 h-0.5 bg-primary/20 rounded-full mb-4" />
            <p className="max-w-md text-[11px] text-text-muted leading-relaxed uppercase tracking-widest font-bold">
              Clinical Documentation & Patient Consent Portal
            </p>
          </div>

          <div className="prose prose-sm max-w-none">
            <div className="bg-bg-soft/30 p-10 rounded-[2rem] border border-black/5 mb-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/10" />
              <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap font-serif italic">
                {form.content}
              </p>
            </div>
          </div>

          <div className="pt-10 border-t border-black/5">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">edit_note</span>
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Patient Information & Declarations</h3>
            </div>
            {renderFields()}
          </div>

          <div className="pt-10 border-t border-black/5">
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-sm">signature</span>
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Patient Signature</h3>
              </div>
              {!isReadOnly && signature && (
                <button onClick={clearSignature} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:underline">Clear Signature</button>
              )}
            </div>
            
            <div className="bg-bg-soft rounded-[2rem] border-2 border-dashed border-black/5 relative overflow-hidden h-48 shadow-inner">
              {isReadOnly && !signature ? (
                <div className="absolute inset-0 flex items-center justify-center text-text-muted/40 italic text-xs">No signature provided</div>
              ) : (
                <canvas 
                  ref={canvasRef}
                  width={800}
                  height={200}
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
            <div className="mt-4 flex justify-between items-center">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
                {isReadOnly ? `Signed on ${new Date(message.signedAt!).toLocaleString('en-GB')}` : 'Sign above using your mouse or touch screen'}
              </p>
              {formData.name && (
                <p className="text-[10px] font-black text-text-main font-serif italic">{formData.name as string}</p>
              )}
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="p-6 border-t border-black/5 bg-white shrink-0">
            <button 
              onClick={() => onSave?.(formData, signature)}
              disabled={!signature || isSaving}
              className="w-full bg-primary text-clinical-dark py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-clinical-dark/20 border-t-clinical-dark rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">draw</span>
                  <span>Sign & Submit Form</span>
                </>
              )}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};
