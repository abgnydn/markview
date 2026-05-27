
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { FileText, Trash2, ChevronRight, ChevronDown, Folder, FolderOpen, Share2, GripVertical, Sun, Moon, Monitor } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollabStore } from '@/stores/collab-store';
import { useThemeStore } from '@/stores/theme-store';
import { THEME_PRESETS } from '@/lib/themes/presets';
import { ShareDialog } from '@/components/collab/share-dialog';
import {
  isAtmosphereMuted,
  setAtmosphereMuted,
  getAtmosphereVolume,
  setAtmosphereVolume,
  unlockAtmosphereAudio,
  setAtmosphereAudio,
} from '@/lib/atmosphere/audio';
import {
  getTimeTintMode,
  setTimeTintMode,
  type TimeTintMode,
} from '@/lib/atmosphere/time-of-day';
import { Volume2, VolumeX, Sunrise, Sun as SunIcon, Sunset, Moon as MoonIcon, CircleDot, RefreshCw } from 'lucide-react';
import {
  nextPaintingFor,
  shufflePaintingFor,
  resetPaintingFor,
  ATMOSPHERES,
  getRotationTempo,
  setRotationTempo,
  type RotationTempo,
} from '@/components/atmosphere/atmospheres';
import { Shuffle, Pin } from 'lucide-react';
import '@/components/collab/collab.css';

const ATMOSPHERE_LABELS: Record<string, string> = {
  none: 'Pure zen paper, no ambient layer',
  fuji: 'Hokusai · Red Fuji + drifting cherry blossom petals',
  wave: 'Hokusai · The Great Wave off Kanagawa',
  snow: 'Hiroshige · Snowy Evening at Kanbara',
  fields: 'Van Gogh · Wheat Field with Cypresses',
};

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  fileId?: string;
  children: TreeNode[];
}

function buildTree(files: { id: string; filename: string; displayName: string }[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');

      const existing = current.find((n) => n.name === name && n.isFolder === !isLast);
      if (existing) {
        current = existing.children;
      } else {
        const node: TreeNode = {
          name: isLast ? (file.displayName || name) : name,
          path,
          isFolder: !isLast,
          fileId: isLast ? file.id : undefined,
          children: [],
        };
        current.push(node);
        current = node.children;
      }
    }
  }

  // Sort: folders first, then alphabetical
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map((n) => ({ ...n, children: sortNodes(n.children) }));
  };

  return sortNodes(root);
}

function TreeItem({
  node,
  depth,
  activeFileId,
  onSelect,
  onRemove,
}: {
  node: TreeNode;
  depth: number;
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onRemove: (fileId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (node.isFolder) {
    return (
      <div className="tree-folder">
        <div
          className="sidebar-item sidebar-folder-item"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setIsOpen((v) => !v)}
          role="button"
          tabIndex={0}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {isOpen ? <FolderOpen size={14} className="sidebar-item-icon folder-icon" /> : <Folder size={14} className="sidebar-item-icon folder-icon" />}
          <span className="sidebar-item-name">{node.name}</span>
        </div>
        {isOpen && (
          <div className="tree-children">
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFileId={activeFileId}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`sidebar-item ${activeFileId === node.fileId ? 'sidebar-item-active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => node.fileId && onSelect(node.fileId)}
      title={node.path}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && node.fileId) onSelect(node.fileId); }}
    >
      <FileText size={14} className="sidebar-item-icon" />
      <span className="sidebar-item-name">{node.name}</span>
      <button
        className="sidebar-item-remove"
        onClick={(e) => {
          e.stopPropagation();
          if (node.fileId) onRemove(node.fileId);
        }}
        title="Remove file"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function Sidebar({ onFileSelect, className }: { onFileSelect?: () => void; className?: string }) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const removeFile = useWorkspaceStore((s) => s.removeFile);
  const reorderFiles = useWorkspaceStore((s) => s.reorderFiles);
  const collabIsActive = useCollabStore((s) => s.isActive);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { mode, setMode, colorScheme, setColorScheme, atmosphere, setAtmosphere } = useThemeStore();

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);

  const tree = useMemo(() => buildTree(files), [files]);

  // Check if we have nested paths at all
  const hasNesting = useMemo(() => files.some((f) => f.filename.includes('/')), [files]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Plain-text payload = the source index (used by intra-sidebar reorder).
    e.dataTransfer.setData('text/plain', String(index));
    // Rich payload = the file id (used by workspace tabs to drop the file
    // into a different workspace). A separate MIME type means cross-target
    // drops can recognize "this is a markview file" without confusing the
    // intra-list reorder logic.
    const file = files[index];
    if (file) {
      e.dataTransfer.setData('application/x-markview-file', file.id);
    }
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [files]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragCounter.current++;
    setDropIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDropIndex(null);
      dragCounter.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderFiles(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  }, [reorderFiles]);

  if (!activeWorkspace) return null;

  return (
    <>
    <aside className={`sidebar ${className || ''}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">{activeWorkspace.title}</h2>
        <button
          className={`collab-share-btn ${collabIsActive ? 'collab-sharing' : ''}`}
          onClick={() => setShowShareDialog(true)}
          title={collabIsActive ? 'Sharing — click to manage' : 'Share workspace'}
        >
          <Share2 size={12} />
          {collabIsActive ? 'Sharing' : 'Share'}
        </button>
      </div>
      <nav className="sidebar-nav">
        {hasNesting ? (
          // Nested file tree — no drag reorder for tree structure
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activeFileId={activeFileId}
              onSelect={(id) => { setActiveFile(id); onFileSelect?.(); }}
              onRemove={removeFile}
            />
          ))
        ) : (
          // Flat list — draggable for reorder
          files.map((file, index) => (
            <div
              key={file.id}
              className={`sidebar-item sidebar-item-draggable ${activeFileId === file.id ? 'sidebar-item-active' : ''} ${dragIndex === index ? 'sidebar-item-dragging' : ''} ${dropIndex === index && dragIndex !== index ? 'sidebar-item-drop-target' : ''}`}
              onClick={() => { setActiveFile(file.id); onFileSelect?.(); }}
              title={file.filename}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveFile(file.id); }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={() => handleDragEnter(index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <span className="sidebar-drag-handle" onMouseDown={(e) => e.stopPropagation()}>
                <GripVertical size={12} />
              </span>
              <FileText size={14} className="sidebar-item-icon" />
              <span className="sidebar-item-name">{file.displayName || file.filename}</span>
              <button
                className="sidebar-item-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                title="Remove file"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </nav>
      
      <AtmosphereControls atmosphere={atmosphere} setAtmosphere={setAtmosphere} />

      {/* Inline settings (hidden on desktop via css or just acting as footer settings) */}
      <div className="sidebar-mobile-settings mobile-only" style={{ paddingTop: 20, paddingBottom: 24, borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appearance</span>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, border: '1px solid var(--border-muted)' }}>
              {['light', 'dark', 'system'].map((m) => {
                const ItemIcon = m === 'dark' ? Moon : m === 'light' ? Sun : Monitor;
                return (
                  <button key={m} onClick={() => setMode(m as 'dark' | 'light' | 'system')} style={{ padding: '6px 12px', borderRadius: 4, background: mode === m ? 'var(--bg-hover)' : 'transparent', color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }} title={m}>
                    <ItemIcon size={14} />
                  </button>
                );
              })}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 140 }}>
              {THEME_PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => setColorScheme(preset.id)} style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${preset.dark['--bg-primary'] || '#0d1117'} 50%, ${preset.dark['--accent-blue'] || '#58a6ff'} 50%)`, border: colorScheme === preset.id ? '2px solid var(--text-primary)' : '2px solid transparent', boxShadow: '0 0 0 1px var(--border-muted)', cursor: 'pointer' }} title={preset.name} />
              ))}
            </div>
          </div>

          {/* Atmosphere controls live in their own component above this
              mobile-only block so desktop users see them too. */}
        </div>
      </div>
    </aside>
    {showShareDialog && <ShareDialog onClose={() => setShowShareDialog(false)} />}
    </>
  );
}

// ─── Atmosphere controls ─────────────────────────────────────────────
interface AtmosphereControlsProps {
  atmosphere: 'none' | 'fuji' | 'wave' | 'snow' | 'fields';
  setAtmosphere: (a: 'none' | 'fuji' | 'wave' | 'snow' | 'fields') => void;
}
function AtmosphereControls({ atmosphere, setAtmosphere }: AtmosphereControlsProps) {
  const [muted, setMuted] = useState<boolean>(() => isAtmosphereMuted());
  const [volume, setVolume] = useState<number>(() => getAtmosphereVolume());
  const [tintMode, setTintModeState] = useState<TimeTintMode>(() => getTimeTintMode());
  const [tempo, setTempo] = useState<RotationTempo>(() => getRotationTempo());

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAtmosphereMuted(next);
    if (!next && atmosphere !== 'none') {
      // Unlock + re-apply current atmosphere so audio actually starts.
      unlockAtmosphereAudio();
      setAtmosphereAudio(atmosphere);
    }
  };
  const onVolume = (v: number) => {
    setVolume(v);
    setAtmosphereVolume(v);
  };
  const onTint = (m: TimeTintMode) => {
    setTintModeState(m);
    setTimeTintMode(m);
  };
  const onTempo = (t: RotationTempo) => {
    setTempo(t);
    setRotationTempo(t);
    // If switching to a non-manual tempo, drop the pin so rotation actually flows.
    if (t !== 'manual' && atmosphere !== 'none') {
      resetPaintingFor(atmosphere as Exclude<typeof atmosphere, 'none'>);
      window.dispatchEvent(new Event('markview:cycle-painting'));
    }
    window.dispatchEvent(new Event('markview:rotation-tempo-changed'));
  };

  return (
    <div className="sidebar-atmosphere" style={{ marginTop: 'auto', paddingTop: 16, paddingBottom: 16, borderTop: '1px solid var(--border-muted)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Painting picker */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'var(--zen-mono)', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--zen-fg-faint)' }}>Atmosphere</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {(['none', 'fuji', 'wave', 'snow', 'fields'] as const).map((id) => {
            const isActive = atmosphere === id;
            return (
              <button
                key={id}
                onClick={() => setAtmosphere(id)}
                title={ATMOSPHERE_LABELS[id] || id}
                style={{
                  padding: '6px 0',
                  borderRadius: 3,
                  background: isActive ? 'var(--zen-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--zen-accent)' : 'var(--zen-fg-faint)',
                  border: isActive ? '1px solid var(--zen-accent-soft)' : '1px solid var(--zen-paper-line)',
                  cursor: 'pointer',
                  fontFamily: 'var(--zen-mono)',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audio mute + volume + next-painting cycle. Hidden when atmosphere === 'none'. */}
      {atmosphere !== 'none' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleMute}
              title={muted ? 'Unmute ambient audio' : 'Mute ambient audio'}
              style={{ background: 'transparent', border: '1px solid var(--zen-paper-line)', borderRadius: 3, padding: '6px 8px', color: 'var(--zen-fg-faint)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolume(parseFloat(e.target.value))}
              disabled={muted}
              style={{ flex: 1, accentColor: 'var(--zen-accent)' }}
              title="Ambient audio volume"
            />
            <button
              onClick={() => {
                nextPaintingFor(atmosphere as Exclude<typeof atmosphere, 'none'>);
                window.dispatchEvent(new Event('markview:cycle-painting'));
              }}
              title={`Next painting in the ${ATMOSPHERES[atmosphere as Exclude<typeof atmosphere, 'none'>].label} pack`}
              style={{ background: 'transparent', border: '1px solid var(--zen-paper-line)', borderRadius: 3, padding: '6px 8px', color: 'var(--zen-fg-faint)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => {
                shufflePaintingFor(atmosphere as Exclude<typeof atmosphere, 'none'>);
                window.dispatchEvent(new Event('markview:cycle-painting'));
              }}
              title="Shuffle to a random painting in the pack"
              style={{ background: 'transparent', border: '1px solid var(--zen-paper-line)', borderRadius: 3, padding: '6px 8px', color: 'var(--zen-fg-faint)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              <Shuffle size={14} />
            </button>
            <button
              onClick={() => {
                resetPaintingFor(atmosphere as Exclude<typeof atmosphere, 'none'>);
                window.dispatchEvent(new Event('markview:cycle-painting'));
              }}
              title="Unpin — let rotation tempo pick the painting"
              style={{ background: 'transparent', border: '1px solid var(--zen-paper-line)', borderRadius: 3, padding: '6px 8px', color: 'var(--zen-fg-faint)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              <Pin size={14} />
            </button>
          </div>
          {/* Rotation tempo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--zen-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--zen-fg-faint)', textTransform: 'uppercase' }}>Rotation</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {(['manual', 'session', 'daily', 'hourly', 'minutes-15', 'minutes-5'] as const).map((t) => {
                const isActive = tempo === t;
                const labels: Record<RotationTempo, string> = {
                  manual: 'manual',
                  session: 'session',
                  daily: 'daily',
                  hourly: 'hourly',
                  'minutes-15': '15m',
                  'minutes-5': '5m',
                };
                return (
                  <button
                    key={t}
                    onClick={() => onTempo(t)}
                    title={`Rotate ${labels[t]}`}
                    style={{
                      padding: '5px 0',
                      borderRadius: 3,
                      background: isActive ? 'var(--zen-accent-soft)' : 'transparent',
                      color: isActive ? 'var(--zen-accent)' : 'var(--zen-fg-faint)',
                      border: isActive ? '1px solid var(--zen-accent-soft)' : '1px solid var(--zen-paper-line)',
                      cursor: 'pointer',
                      fontFamily: 'var(--zen-mono)',
                      fontSize: 9.5,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>
          </div>
          <span style={{ fontFamily: 'var(--zen-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--zen-fg-faint)', textTransform: 'uppercase' }}>
            {ATMOSPHERES[atmosphere as Exclude<typeof atmosphere, 'none'>].paintings.length} paintings
          </span>
        </div>
      )}

      {/* Time-of-day tint selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'var(--zen-mono)', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--zen-fg-faint)' }}>Time of day</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {(['auto', 'dawn', 'day', 'dusk', 'night', 'off'] as const).map((m) => {
            const Icon = TINT_ICONS[m];
            const isActive = tintMode === m;
            return (
              <button
                key={m}
                onClick={() => onTint(m)}
                title={TINT_LABELS[m]}
                style={{
                  padding: '6px 0',
                  borderRadius: 3,
                  background: isActive ? 'var(--zen-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--zen-accent)' : 'var(--zen-fg-faint)',
                  border: isActive ? '1px solid var(--zen-accent-soft)' : '1px solid var(--zen-paper-line)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={12} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TINT_LABELS: Record<TimeTintMode, string> = {
  auto:  'Auto — follows local clock',
  dawn:  'Dawn — warm pink wash',
  day:   'Day — neutral',
  dusk:  'Dusk — amber light',
  night: 'Night — deep blue',
  off:   'Off — no time tint',
};
const TINT_ICONS: Record<TimeTintMode, React.ComponentType<{ size?: number }>> = {
  auto:  CircleDot,
  dawn:  Sunrise,
  day:   SunIcon,
  dusk:  Sunset,
  night: MoonIcon,
  off:   CircleDot,
};
