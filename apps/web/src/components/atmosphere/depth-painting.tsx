// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth, isWebGLSupported } from '@/lib/atmosphere/depth';

interface DepthPaintingProps {
  src: string;
  /** Painting key — re-derives a depth map when this changes. */
  paintingKey: string;
  /** Image opacity at idle (matches the plain <img> opacity). */
  opacity?: number;
  className?: string;
  /** Inline style passthrough (used for filter, mask, etc.). */
  style?: React.CSSProperties;
}

/**
 * DepthPainting — renders an atmosphere painting with depth-aware
 * parallax. The painting is sampled as a WebGL texture; a depth map
 * computed by Depth Anything v2 (cached per painting) drives a UV
 * offset based on cursor position + a slow ambient noise. Net effect:
 * the painting subtly "tilts" toward the cursor and breathes on its
 * own. The mountain stays put while the sky drifts.
 *
 * Falls back to a plain <img> when WebGL or the depth pipeline isn't
 * available — same DOM rectangle, so the surrounding atmosphere layer
 * is unaffected.
 */
export function DepthPainting({ src, paintingKey, opacity = 1, className, style }: DepthPaintingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  // The depth pipeline can take 1-3s the first time; until it lands we
  // show the plain image so there's never a blank frame.
  const [fallback, setFallback] = useState(true);

  useEffect(() => {
    if (!isWebGLSupported()) { setFallback(true); return; }
    let cancelled = false;
    let rafId = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      const depthResult = await ensureDepth(src);
      if (cancelled || !depthResult) {
        setFallback(true);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
      if (!gl) { setFallback(true); return; }

      // ─── Shaders ───────────────────────────────────────────────
      const vsSrc = `#version 300 es
        in vec2 a_pos;
        out vec2 v_uv;
        void main() {
          v_uv = vec2(a_pos.x * 0.5 + 0.5, 1.0 - (a_pos.y * 0.5 + 0.5));
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;
      const fsSrc = `#version 300 es
        precision mediump float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_paint;
        uniform sampler2D u_depth;
        uniform vec2 u_cursor;       // -1..1
        uniform float u_time;        // seconds
        uniform float u_intensity;   // 0..1
        uniform float u_paintAspect; // w/h of painting
        uniform float u_canvasAspect; // w/h of canvas

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        void main() {
          // cover-fit the painting to the canvas (object-fit: cover).
          vec2 uv = v_uv;
          float ar = u_paintAspect / u_canvasAspect;
          if (ar > 1.0) { uv.x = (uv.x - 0.5) / ar + 0.5; }
          else          { uv.y = (uv.y - 0.5) * ar + 0.5; }

          float depth = texture(u_depth, uv).r;
          // Depth as signed: nearer to camera = positive offset.
          float depthS = depth - 0.5;

          // Cursor-driven parallax — closer pixels move opposite to the
          // cursor (typical depth-photo behavior).
          vec2 cursorOff = -u_cursor * depthS * 0.018 * u_intensity;

          // Ambient breath via cheap noise — wave-y for high-depth (sky),
          // still for low-depth (foreground).
          float t = u_time * 0.05;
          vec2 wob = vec2(
            noise(vec2(t, depth * 7.0)) - 0.5,
            noise(vec2(depth * 9.0, t)) - 0.5
          ) * abs(depthS) * 0.012 * u_intensity;

          vec2 finalUv = uv + cursorOff + wob;
          outColor = texture(u_paint, finalUv);
        }
      `;

      const compile = (type: number, src: string): WebGLShader | null => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn('[depth] shader compile error', gl.getShaderInfoLog(s));
          gl.deleteShader(s);
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) { setFallback(true); return; }
      const prog = gl.createProgram();
      if (!prog) { setFallback(true); return; }
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setFallback(true); return; }
      gl.useProgram(prog);

      // Fullscreen quad
      const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      // Load painting texture
      const paintImg = new Image();
      paintImg.crossOrigin = 'anonymous';
      paintImg.src = src;
      await paintImg.decode();
      if (cancelled) return;

      const makeTex = (image: TexImageSource): WebGLTexture | null => {
        const tex = gl.createTexture();
        if (!tex) return null;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
      };
      const paintTex = makeTex(paintImg);
      const depthTex = makeTex(depthResult.bitmap);
      if (!paintTex || !depthTex) { setFallback(true); return; }

      const uPaint = gl.getUniformLocation(prog, 'u_paint');
      const uDepth = gl.getUniformLocation(prog, 'u_depth');
      const uCursor = gl.getUniformLocation(prog, 'u_cursor');
      const uTime = gl.getUniformLocation(prog, 'u_time');
      const uIntensity = gl.getUniformLocation(prog, 'u_intensity');
      const uPaintAr = gl.getUniformLocation(prog, 'u_paintAspect');
      const uCanvasAr = gl.getUniformLocation(prog, 'u_canvasAspect');
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, paintTex); gl.uniform1i(uPaint, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, depthTex); gl.uniform1i(uDepth, 1);

      const paintAspect = paintImg.width / paintImg.height;
      gl.uniform1f(uPaintAr, paintAspect);
      gl.uniform1f(uIntensity, 1.0);

      // Cursor tracking — store target + ease toward it each frame.
      let cursorTarget = { x: 0, y: 0 };
      let cursorCurrent = { x: 0, y: 0 };
      const onMove = (e: MouseEvent) => {
        cursorTarget = {
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: (e.clientY / window.innerHeight) * 2 - 1,
        };
      };
      window.addEventListener('mousemove', onMove);

      // Resize handler — adapt canvas DPR-aware.
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(uCanvasAr, canvas.width / canvas.height);
      };
      resize();
      window.addEventListener('resize', resize);

      const start = performance.now();
      const draw = () => {
        cursorCurrent.x += (cursorTarget.x - cursorCurrent.x) * 0.06;
        cursorCurrent.y += (cursorTarget.y - cursorCurrent.y) * 0.06;
        gl.uniform2f(uCursor, cursorCurrent.x, cursorCurrent.y);
        gl.uniform1f(uTime, (performance.now() - start) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        rafId = requestAnimationFrame(draw);
      };
      rafId = requestAnimationFrame(draw);

      cleanup = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(rafId);
        gl.deleteProgram(prog);
        gl.deleteTexture(paintTex);
        gl.deleteTexture(depthTex);
        gl.deleteBuffer(buf);
      };

      setReady(true);
      setFallback(false);
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      cleanup?.();
    };
  }, [src, paintingKey]);

  return (
    <>
      {/* Always-on plain <img> while depth is computing / when WebGL
          isn't supported. Once the canvas is ready it overlays this
          element exactly, so the user sees a seamless transition. */}
      {fallback && (
        <img
          className={className}
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          style={{ ...style, opacity }}
        />
      )}
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{
          ...style,
          opacity: ready && !fallback ? opacity : 0,
          transition: 'opacity 700ms ease',
          pointerEvents: 'none',
          // Sits on top of the fallback image at the same rectangle.
          position: 'absolute',
          inset: 0,
        }}
      />
    </>
  );
}
