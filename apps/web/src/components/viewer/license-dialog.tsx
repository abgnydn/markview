import React, { useState } from 'react';
import { useLicenseStore } from '@/stores/license-store';
import { Key, ShieldCheck, AlertCircle, X, Loader2 } from 'lucide-react';

interface LicenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LicenseDialog({ isOpen, onClose }: LicenseDialogProps) {
  const { isPro, licenseKey, instanceId, activateLicense, removeLicense } = useLicenseStore();
  
  const [inputKey, setInputKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleActivate = async () => {
    setError(null);
    if (!inputKey.trim()) {
      setError('Please enter a license key');
      return;
    }
    
    setIsLoading(true);
    const { success, error: activationError } = await activateLicense(inputKey.trim());
    setIsLoading(false);
    
    if (!success) {
      setError(activationError || 'Invalid license key');
    } else {
      setInputKey('');
    }
  };

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
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Enter your LemonSqueezy license key to activate MarkView Pro for commercial use.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>License Key</label>
                <input
                  type="text"
                  placeholder="e.g. A1B2C3D4-E5F6G7H8-I9J0K1L2"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  spellCheck={false}
                  style={{
                    padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-muted)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    fontSize: 14, fontFamily: 'monospace', outline: 'none'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent-blue)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-muted)')}
                />
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
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
                  Cancel
                </button>
                <button
                  onClick={handleActivate}
                  disabled={isLoading || !inputKey.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: isLoading || !inputKey.trim() ? '#4f46e588' : '#4f46e5', 
                    color: '#fff', cursor: isLoading || !inputKey.trim() ? 'not-allowed' : 'pointer', 
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'background 0.2s'
                  }}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Activate Pro'}
                </button>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-muted)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                Don't have a license? <a href="/pricing" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>Get MarkView Pro</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
