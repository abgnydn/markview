'use client';

import { Html } from '@react-three/drei';

interface BubbleProps {
  text: string | null;
  position: [number, number, number];
  variant: 'visitor' | 'face';
}

function Bubble({ text, position, variant }: BubbleProps): React.JSX.Element | null {
  if (!text) return null;
  const isFace = variant === 'face';
  return (
    <Html
      position={position}
      center
      occlude={false}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 'max-content',
          maxWidth: 360,
          minWidth: 80,
          padding: '10px 14px',
          borderRadius: 14,
          background: isFace
            ? 'linear-gradient(180deg, rgba(40, 18, 8, 0.92), rgba(20, 8, 4, 0.92))'
            : 'linear-gradient(180deg, rgba(8, 6, 22, 0.86), rgba(4, 4, 14, 0.86))',
          color: isFace ? '#ffe7c0' : '#e8edf6',
          border: `1px solid ${isFace ? 'rgba(255, 215, 150, 0.35)' : 'rgba(180, 200, 255, 0.25)'}`,
          fontFamily: isFace
            ? 'ui-serif, "Iowan Old Style", "Apple Garamond", Palatino, "Times New Roman", serif'
            : 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif',
          fontSize: 14,
          fontStyle: isFace ? 'italic' : 'normal',
          lineHeight: 1.45,
          letterSpacing: isFace ? '0.01em' : 'normal',
          boxShadow: isFace
            ? '0 12px 40px rgba(255, 180, 100, 0.18), 0 0 0 1px rgba(0,0,0,0.4) inset'
            : '0 12px 40px rgba(120, 160, 240, 0.14), 0 0 0 1px rgba(0,0,0,0.4) inset',
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'normal',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

export interface TempleBubblesProps {
  visitorText: string | null;
  faceText: string | null;
  /** Visitor world position. Bubble floats above their head. */
  visitorAnchor?: [number, number, number];
  /** Face world position. Bubble floats below the face. */
  faceAnchor?: [number, number, number];
}

export function TempleBubbles({
  visitorText,
  faceText,
  visitorAnchor = [0, 1.95, 1.5],
  faceAnchor = [0, 8.5 - 12 - 1.0, -36 + 0.2],
}: TempleBubblesProps): React.JSX.Element {
  return (
    <>
      <Bubble text={visitorText} position={visitorAnchor} variant="visitor" />
      <Bubble text={faceText} position={faceAnchor} variant="face" />
    </>
  );
}
