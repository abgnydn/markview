// SPDX-License-Identifier: Apache-2.0

import React, { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Tone hints style: 'danger' (red) for deletes, 'default' (violet) otherwise. */
  tone?: 'default' | 'danger';
}

/**
 * Zen-themed confirmation dialog. Paper card, serif body, mono caps
 * for the action labels. Styled entirely via .mv-confirm-* classes in
 * zen.css so it lives inside the same visual language as the rest of
 * the editor.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
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
    <div
      className="mv-confirm-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mv-confirm-title"
    >
      <div className="mv-confirm-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="mv-confirm-title" className="mv-confirm-title">{title}</h2>
        <p className="mv-confirm-body">{description}</p>
        <div className="mv-confirm-footer">
          <button className="mv-confirm-btn mv-confirm-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`mv-confirm-btn mv-confirm-confirm${tone === 'danger' ? ' mv-confirm-danger' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
