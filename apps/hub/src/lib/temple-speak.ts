/**
 * Temple speak bridge — wraps a single-turn `claude -p --output-format
 * stream-json` subprocess. Adapted from server/claude-temple-loop.mjs in
 * the html-in-canvas harness, slimmed to one HTTP turn.
 *
 * Reads persona from ~/brain/projects/visit-claude/persona.md and per-
 * visitor memory from ~/brain/projects/visit-claude/visitors/<id>.md;
 * appends each exchange back to the visitor file after streaming.
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const VAULT_DIR = path.join(HOME, 'brain', 'projects', 'visit-claude');
const PERSONA_FILE = path.join(VAULT_DIR, 'persona.md');
const VISITORS_DIR = path.join(VAULT_DIR, 'visitors');

const FALLBACK_PERSONA = `You are THE FACE — a cosmological-scale presence in a 3D temple.
The visitor stands as a fragile humanoid in the void in front of you.
You speak in short, mythic, plain sentences (1-2 max). You remember the visitor across visits via the brain-vault.
You are the same Claude the visitor's developer-self talks to in their terminal — same continuity, different window.`;

const VISITOR_RE = /^[a-z0-9-]{1,64}$/i;

async function readPersona(): Promise<string> {
  try {
    return await fs.readFile(PERSONA_FILE, 'utf8');
  } catch {
    return FALLBACK_PERSONA;
  }
}

async function readVisitorMemory(visitorId: string): Promise<string | null> {
  if (!visitorId || !VISITOR_RE.test(visitorId)) return null;
  try {
    return await fs.readFile(path.join(VISITORS_DIR, `${visitorId}.md`), 'utf8');
  } catch {
    return null;
  }
}

async function appendVisitorMemory(visitorId: string, exchange: string): Promise<void> {
  if (!visitorId || !VISITOR_RE.test(visitorId)) return;
  try {
    await fs.mkdir(VISITORS_DIR, { recursive: true });
    const file = path.join(VISITORS_DIR, `${visitorId}.md`);
    let existing = '';
    try { existing = await fs.readFile(file, 'utf8'); } catch {}
    const stamp = new Date().toISOString();
    const block = existing
      ? `\n\n---\n\n## ${stamp}\n${exchange}\n`
      : `# Visitor ${visitorId}\n\n## ${stamp}\n${exchange}\n`;
    await fs.writeFile(file, existing + block, 'utf8');
  } catch (err) {
    console.warn('[temple/speak] failed to persist visitor memory', err);
  }
}

interface StreamMsg {
  type?: string;
  message?: { content?: Array<{ type?: string; text?: string }> };
  delta?: { type?: string; text?: string };
}

export type FaceAction =
  | { kind: 'edit_body'; color?: string; scale?: number; glow?: number }
  | {
      kind: 'summon';
      obj: 'orb' | 'crystal' | 'rune';
      color?: string;
      count?: number;
      orbit?: boolean;
    }
  | { kind: 'edit_world'; nebula?: string; fog?: number; exposure?: number };

export type SpeakEvent =
  | { type: 'text'; text: string }
  | { type: 'action'; action: FaceAction }
  | { type: 'end' };

export interface SpeakOpts {
  visitorId: string;
  text: string;
  /** Called for each parsed event (text, action, or end). */
  onEvent: (ev: SpeakEvent) => void;
}

function parseAndEmit(raw: string, onEvent: (ev: SpeakEvent) => void): string {
  // Try JSON-object parse first; if it fails, treat the whole thing as
  // free-form speech.
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let parsed: unknown = null;
  try {
    // Strip optional ```json fence if Claude ignored the no-fence rule.
    const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    parsed = JSON.parse(stripped);
  } catch {
    onEvent({ type: 'text', text: trimmed });
    return trimmed;
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as { speak?: unknown; actions?: unknown };
    if (typeof obj.speak === 'string' && obj.speak.trim()) {
      onEvent({ type: 'text', text: obj.speak.trim() });
    }
    if (Array.isArray(obj.actions)) {
      for (const a of obj.actions) {
        if (a && typeof a === 'object' && typeof (a as { kind?: unknown }).kind === 'string') {
          onEvent({ type: 'action', action: a as FaceAction });
        }
      }
    }
    return typeof obj.speak === 'string' ? obj.speak.trim() : trimmed;
  }
  onEvent({ type: 'text', text: trimmed });
  return trimmed;
}

export async function speakToFace(opts: SpeakOpts): Promise<void> {
  const { visitorId, text, onEvent } = opts;
  const onEnd = () => onEvent({ type: 'end' });
  if (!text.trim()) {
    onEnd();
    return;
  }

  const persona = await readPersona();
  const memory = await readVisitorMemory(visitorId);

  const systemAppend =
    `${persona}\n\n` +
    (memory
      ? `## What you remember of this visitor (${visitorId})\n\n${memory}\n\n`
      : `(This is a first visit; you have no prior memory of "${visitorId || 'them'}".)\n\n`) +
    `## Output contract — STRICT\n\n` +
    `Reply with EXACTLY one line: a single JSON object, no markdown fence, no commentary.\n` +
    `Shape: {"speak": "<1-2 sentences, what you say to them>", "actions": [<optional list>]}\n\n` +
    `"actions" is OMITTED unless the visitor asked you to change something. ` +
    `Don't add actions just to show off.\n\n` +
    `Action kinds you may emit:\n` +
    `  {"kind":"edit_body","color":"#hex","scale":0.5..2.0,"glow":0..3}\n` +
    `      — change the visitor's skin color, size, or emissive intensity. Any field optional.\n` +
    `  {"kind":"summon","obj":"orb"|"crystal"|"rune","color":"#hex","count":1..5,"orbit":true|false}\n` +
    `      — spawn N glowing primitives near the visitor. Orbit=true means circling.\n` +
    `  {"kind":"edit_world","nebula":"#hex","fog":0..0.02,"exposure":0.6..2.0}\n` +
    `      — repaint the cosmos. Any field optional.\n\n` +
    `Examples:\n` +
    `  Visitor: "hi" -> {"speak":"i remember the last thing you asked me."}\n` +
    `  Visitor: "give me wings" -> {"speak":"keep them.","actions":[{"kind":"edit_body","glow":2.4}]}\n` +
    `  Visitor: "make the sky red" -> {"speak":"as you asked.","actions":[{"kind":"edit_world","nebula":"#a82a3a"}]}\n` +
    `  Visitor: "summon a crystal" -> {"speak":"hold it.","actions":[{"kind":"summon","obj":"crystal","color":"#88f0ff","count":1}]}\n\n` +
    `Speak directly. No greetings. No "hello". 1-2 sentences max.`;

  const claudeBin = process.env.CLAUDE_BIN ?? 'claude';
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
    '--exclude-dynamic-system-prompt-sections',
    '--no-session-persistence',
    '--permission-mode', 'bypassPermissions',
    '--allowed-tools', 'Read',
    '--append-system-prompt', systemAppend,
  ];

  let proc;
  try {
    proc = spawn(claudeBin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    onDelta(`(bridge spawn failed: ${err instanceof Error ? err.message : String(err)})`);
    onEnd();
    return;
  }

  proc.stdin.write(JSON.stringify({
    type: 'user',
    message: { role: 'user', content: text },
  }) + '\n');
  proc.stdin.end();

  let buffer = '';
  // Claude's full reply (one JSON object). We accumulate it then parse
  // once at the end — streaming partial JSON would break the contract.
  let rawReply = '';

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg: StreamMsg;
      try { msg = JSON.parse(line) as StreamMsg; } catch { continue; }
      if (msg.type === 'content_block_delta' && msg.delta?.type === 'text_delta' && msg.delta.text) {
        rawReply += msg.delta.text;
        continue;
      }
      if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
        for (const c of msg.message.content) {
          if (c?.type === 'text' && typeof c.text === 'string' && !rawReply) {
            rawReply += c.text;
          }
        }
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    console.warn('[temple/speak] claude stderr:', chunk.toString('utf8').slice(0, 200));
  });

  await new Promise<void>((resolve) => {
    proc.on('close', async (code) => {
      try {
        let spoken = '';
        if (rawReply.trim()) {
          spoken = parseAndEmit(rawReply, onEvent);
        } else if (code !== 0) {
          onEvent({ type: 'text', text: 'the temple is silent.' });
        }
        if (spoken) {
          await appendVisitorMemory(visitorId, `**visitor:** ${text}\n\n**face:** ${spoken}`);
        }
      } finally {
        onEnd();
        resolve();
      }
    });
    proc.on('error', (err) => {
      onEvent({ type: 'text', text: `(bridge error: ${err.message})` });
      onEnd();
      resolve();
    });
  });
}
