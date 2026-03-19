import React from 'react';

export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-primary, #0d1117)',
        color: '#fff',
      }}
    >
      <img
        src="/icon-192.png"
        alt="Loading MarkView..."
        style={{
          width: 80,
          height: 80,
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          borderRadius: 20,
          boxShadow: '0 0 40px rgba(99, 102, 241, 0.2)',
        }}
      />
      <h2
        style={{
          marginTop: 24,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          opacity: 0.8,
        }}
      >
        MarkView
      </h2>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
