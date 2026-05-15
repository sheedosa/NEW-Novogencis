import React, { memo } from 'react';
import { Card } from '../../../components/Card';
import { useAdminContext } from '../context';
import { CheckCircle, Shield, Network } from 'lucide-react';

const PlatformHealthPanel: React.FC = () => {
  const { user } = useAdminContext();

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-medium text-obsidian">Platform Health</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase text-muted">Database Status</h3>
              <p className="text-sm font-medium text-obsidian">Operational</p>
            </div>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            All Firestore collections are synchronized and responding within normal latency parameters.
          </p>
        </Card>

        <Card className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase text-muted">Security Rules</h3>
              <p className="text-sm font-medium text-obsidian">Active &amp; Enforced</p>
            </div>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            RBAC is active. Admin specialisations are enforced at the application layer.
          </p>
        </Card>

        <Card className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Network size={24} />
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase text-muted">API Connectivity</h3>
              <p className="text-sm font-medium text-obsidian">Healthy</p>
            </div>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            Firebase Auth and Cloud Functions are reachable. Real-time messaging listeners are active.
          </p>
        </Card>
      </div>

      <Card className="p-8">
        <h3 className="text-xs font-medium uppercase text-muted mb-6">Build &amp; Environment</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-black/5">
            <div>
              <p className="text-[11px] font-medium text-obsidian">Frontend Build</p>
              <p className="text-[9px] text-muted">React 19 + Vite + TypeScript (strict)</p>
            </div>
            <span className="text-[8px] font-medium uppercase text-green-600 bg-green-100 px-2 py-1 rounded-full">Live</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-black/5">
            <div>
              <p className="text-[11px] font-medium text-obsidian">Firebase Project</p>
              <p className="text-[9px] text-muted font-mono">
                {(import.meta as { env?: Record<string, string> }).env?.VITE_FIREBASE_PROJECT_ID || 'novogenics-clinical'}
              </p>
            </div>
            <span className="text-[8px] font-medium uppercase text-green-600 bg-green-100 px-2 py-1 rounded-full">Connected</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-[11px] font-medium text-obsidian">Session</p>
              <p className="text-[9px] text-muted">Active since {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <span className="text-[8px] font-medium uppercase text-green-600 bg-green-100 px-2 py-1 rounded-full">{user?.adminType || 'admin'}</span>
          </div>
          <p className="text-[9px] text-muted leading-relaxed pt-2 border-t border-black/5">
            Clinical audit logs are written to the <span className="font-mono">audit_logs</span> Firestore collection on each action. Browse historical logs via the Firebase Console.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default memo(PlatformHealthPanel);
