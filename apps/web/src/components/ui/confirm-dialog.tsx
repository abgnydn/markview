import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .confirm-overlay-locked {
          position: fixed !important;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99999 !important;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex !important;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 150ms ease;
        }
        .confirm-dialog-locked {
          width: 90vw;
          max-width: 400px;
          background: var(--bg-elevated, #161b22);
          border: 1px solid var(--border-default, #30363d);
          border-radius: var(--radius-xl, 12px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          overflow: hidden;
          animation: slideDown 200ms ease;
        }
        .confirm-header-locked {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px 16px;
        }
        .confirm-icon-locked { color: var(--accent-red, #f85149); }
        .confirm-title-locked {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #e6edf3);
          margin: 0;
        }
        .confirm-body-locked {
          padding: 0 24px 24px;
          color: var(--text-secondary, #8b949e);
          font-size: 14px;
          line-height: 1.5;
        }
        .confirm-footer-locked {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: var(--bg-secondary, #0d1117);
          border-top: 1px solid var(--border-muted, #21262d);
        }
        .confirm-cancel-locked {
          padding: 8px 16px;
          border-radius: var(--radius-md, 6px);
          background: transparent;
          border: 1px solid var(--border-default, #30363d);
          color: var(--text-primary, #e6edf3);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .confirm-cancel-locked:hover { background: var(--bg-hover, #21262d); }
        .confirm-action-locked {
          padding: 8px 16px;
          border-radius: var(--radius-md, 6px);
          background: var(--accent-red, #da3633);
          border: 1px solid transparent;
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .confirm-action-locked:hover { filter: brightness(1.2); }
      ` }} />
      <div className="confirm-overlay-locked" onClick={onCancel} role="dialog" aria-modal="true">
        <div className="confirm-dialog-locked" onClick={(e) => e.stopPropagation()}>
          <div className="confirm-header-locked">
            <AlertCircle className="confirm-icon-locked" size={20} />
            <h2 className="confirm-title-locked">{title}</h2>
          </div>
          <div className="confirm-body-locked">
            <p>{description}</p>
          </div>
          <div className="confirm-footer-locked">
            <button className="confirm-cancel-locked" onClick={onCancel}>{cancelText}</button>
            <button className="confirm-action-locked" onClick={onConfirm} autoFocus>{confirmText}</button>
          </div>
        </div>
      </div>
    </>
  );
}
