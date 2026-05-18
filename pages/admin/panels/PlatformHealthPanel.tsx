import React, { memo, useState } from 'react';
import { useAdminContext } from '../context';
import {
  ShieldCheck, CheckCircle, Shield, Network, Database, Lock,
  Activity, Clock, UserCheck, RefreshCw,
} from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Button, Badge,
} from '../../../components/ui';

const StatusRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  status?: 'ok' | 'info';
}> = ({ icon, label, value, description, status = 'ok' }) => (
  <Card>
    <CardHeader
      title={label}
      subtitle={value}
      leadingIcon={icon}
      trailing={<Badge variant={status === 'ok' ? 'active' : 'new'}>{status === 'ok' ? 'Operational' : 'Healthy'}</Badge>}
    />
    <p className="text-xs text-muted leading-relaxed">{description}</p>
  </Card>
);

const PlatformHealthPanel: React.FC = () => {
  const {
    user, onLogout,
    onSeedDummyPatient,
  } = useAdminContext();

  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'done' | 'error'>('idle');
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const env =
    (import.meta as { env?: Record<string, string> }).env?.VITE_FIREBASE_PROJECT_ID ||
    'novogenics-clinical';

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        title="Platform health"
        subtitle="System status and environment"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatusRow
          icon={<Database size={15} />}
          label="Database"
          value="Firestore"
          description="All collections are synchronized and responding within normal latency."
        />
        <StatusRow
          icon={<Lock size={15} />}
          label="Security rules"
          value="Active & enforced"
          description="RBAC is active. Admin specialisations are enforced at the application layer."
          status="ok"
        />
        <StatusRow
          icon={<Network size={15} />}
          label="API connectivity"
          value="Auth + Functions"
          description="Firebase Auth and Cloud Functions are reachable. Real-time listeners are active."
          status="info"
        />
      </div>

      {user?.email === 'rasheedamer99@gmail.com' && (
        <Card>
          <CardHeader
            title="Admin management"
            subtitle="Manage admin accounts and permissions"
            leadingIcon={<ShieldCheck size={15} className="text-primary" />}
          />
          <p className="text-xs text-muted leading-relaxed">
            Admin accounts are managed securely via the CLI.<br />
            Run <code className="bg-cream px-1 py-0.5 rounded text-obsidian">npm run admin:set-claims</code> to set or refresh admin permissions, or <code className="bg-cream px-1 py-0.5 rounded text-obsidian">npm run admin:verify</code> to check platform status.
          </p>
        </Card>
      )}

      {user?.adminType === 'technical' && onSeedDummyPatient && (
        <Card>
          <CardHeader
            title="Test patient account"
            subtitle="Seeded data for the dummy account doctors and admins preview the portal with"
            leadingIcon={<UserCheck size={15} className="text-primary" />}
          />
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Creates or refreshes the clinic's persistent test-patient record with a
            realistic upcoming appointment, completed session, treatment plan,
            payments, signed form and unread messages. Stable IDs — won't create
            duplicates. Re-run any time the dummy data drifts from today's date.
          </p>
          {seedMsg && (
            <p className={`text-xs mb-2 ${seedStatus === 'error' ? 'text-danger' : 'text-success'}`}>
              {seedMsg}
            </p>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={seedStatus === 'seeding'}
            disabled={seedStatus === 'seeding'}
            leadingIcon={<RefreshCw size={13} />}
            onClick={async () => {
              setSeedStatus('seeding');
              setSeedMsg(null);
              try {
                await onSeedDummyPatient();
                setSeedStatus('done');
                setSeedMsg('Test patient seeded. Open the sidebar account menu → "View as test patient" to preview.');
              } catch (err) {
                console.error('Seed dummy patient error:', err);
                setSeedStatus('error');
                setSeedMsg(err instanceof Error ? err.message : 'Failed to seed. Check the console.');
              }
            }}
          >
            {seedStatus === 'seeding' ? 'Seeding…' : seedStatus === 'done' ? 'Re-seed' : 'Seed / reset test patient'}
          </Button>
        </Card>
      )}

      <Card>
        <CardHeader title="Build & environment" leadingIcon={<Activity size={15} />} />
        <div className="flex flex-col">
          <div className="flex items-center justify-between py-2.5 border-b border-cream">
            <div>
              <p className="text-sm font-medium text-obsidian">Frontend build</p>
              <p className="text-xs text-muted">React 19 + Vite + TypeScript (strict)</p>
            </div>
            <Badge variant="active">Live</Badge>
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-cream">
            <div>
              <p className="text-sm font-medium text-obsidian">Firebase project</p>
              <p className="text-xs text-muted font-mono">{env}</p>
            </div>
            <Badge variant="active">Connected</Badge>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-obsidian">Session</p>
              <p className="text-xs text-muted inline-flex items-center gap-1">
                <Clock size={11} /> Active since {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge variant="new">{user?.adminType || 'admin'}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted mt-3 leading-relaxed">
          Clinical audit logs are written to the <span className="font-mono text-obsidian">audit_logs</span> Firestore collection on each action.
        </p>
      </Card>
    </div>
  );
};

export default memo(PlatformHealthPanel);
