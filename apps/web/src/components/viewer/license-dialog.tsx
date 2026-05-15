import { useLicenseStore } from '@/stores/license-store';
import { Key, ShieldCheck, Mail, X } from 'lucide-react';

interface LicenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONTACT_EMAIL = 'hi@barisgunaydin.com';

export function LicenseDialog({ isOpen, onClose }: LicenseDialogProps) {
  const { isPro, licenseKey, instanceId, removeLicense } = useLicenseStore();

  if (!isOpen) return null;

  return (
    <div className="viewer-search-overlay" onClick={onClose} style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className="viewer-search-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} />
            License Settings
          </h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--text-secondary)', 
              cursor: 'pointer', padding: 4, borderRadius: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {isPro ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid rgba(34, 197, 94, 0.2)', 
                borderRadius: 8, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' 
              }}>
                <ShieldCheck size={20} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#22c55e', margin: '0 0 4px 0' }}>MarkView Pro Activated</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Your commercial license is active. You have full access to MarkView's premium features for commercial use.
                  </p>
                </div>
              </div>

              <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Active License Key</div>
                <div style={{ fontSize: 14, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                  {licenseKey?.substring(0, 8)}••••••••••••••••
                </div>
                {instanceId && (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 12 }}>Device/Instance ID</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{instanceId}</div>
                  </>
                )}
              </div>

              <button
                onClick={removeLicense}
                style={{
                  padding: '10px 16px', borderRadius: 6, border: '1px solid var(--border-muted)',
                  background: 'transparent', color: '#ef4444', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.2s ease', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Deactivate License
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: 'rgba(79, 70, 229, 0.08)',
                border: '1px solid rgba(79, 70, 229, 0.25)',
                borderRadius: 8, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <Mail size={20} color="#a5b4fc" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Pro licenses handled by email</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Automated activation is temporarily paused. To purchase a commercial license or activate an existing key, email us and we'll get you set up manually.
                  </p>
                </div>
              </div>

              <a
                href={`mailto:${CONTACT_EMAIL}?subject=MarkView%20Pro%20License`}
                style={{
                  padding: '10px 16px', borderRadius: 6, border: 'none',
                  background: '#4f46e5', color: '#fff', fontWeight: 500,
                  cursor: 'pointer', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Mail size={14} />
                Email {CONTACT_EMAIL}
              </a>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: 500
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  Close
                </button>
              </div>

              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border-muted)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Want to see tiers first? <a href="/pricing" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>View pricing</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
