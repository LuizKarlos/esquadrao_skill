// Canonical caption templates and deterministic FFmpeg filter builder.
// All geometry is authored on a 640x360 reference canvas and scaled by width.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const FONT_DIR = path.join(PACKAGE_ROOT, 'assets', 'fonts');

export const REFERENCE_CANVAS = Object.freeze({ width: 640, height: 360 });

const HOME_DIR = os.homedir();
const SYSTEM_FONT_PATHS = {
  'LiberationSans-Bold.ttf': [
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    path.join(HOME_DIR, '.hermes/cache/libs/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
  ],
  'DejaVuSansMono-Bold.ttf': [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
    path.join(HOME_DIR, '.hermes/cache/libs/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'),
  ],
};

const BASE = {
  fontFamily: 'Anton',
  fontFile: 'Anton-Regular.ttf',
  fontSize: 64,
  fill: '#FFE600',
  stroke: { color: '#000000', width: 7 },
  shadow: { x: 4, y: 4, color: '#000000', opacity: 0.8 },
  lines: 2,
  y: [100, 170],
  lineGap: 1.1,
  uppercase: true,
  animation: { type: 'fade', durationMs: 400 },
  rule: null,
  glitch: null,
};

export const CAPTION_TEMPLATES = Object.freeze([
  { ...BASE, id: 'mrbeast-yellow', name: 'MrBeast Yellow' },
  {
    ...BASE,
    id: 'tiktok-white',
    lineGap: 1.2963,
    name: 'TikTok White',
    fontFamily: 'Poppins',
    fontFile: 'Poppins-Bold.ttf',
    fontSize: 54,
    fill: '#FFFFFF',
    stroke: { color: '#000000', width: 8 },
    shadow: { x: 3, y: 3, color: '#000000', opacity: 0.7 },
    y: [105, 175],
  },
  {
    ...BASE,
    id: 'gold-stroke',
    name: 'Gold Stroke',
    fontSize: 64,
    fill: '#FFF6D6',
    stroke: { color: '#FFC400', width: 5 },
    shadow: { x: 3, y: 3, color: '#000000', opacity: 0.85 },
  },
  {
    ...BASE,
    id: 'green-stroke',
    lineGap: 0.9714,
    name: 'Green Stroke',
    fontFamily: 'Bebas Neue',
    fontFile: 'BebasNeue-Regular.ttf',
    fontSize: 70,
    fill: '#FFFFFF',
    stroke: { color: '#00E676', width: 6 },
    shadow: { x: 3, y: 3, color: '#000000', opacity: 0.85 },
    y: [108, 176],
  },
  {
    ...BASE,
    id: 'neon-glitch',
    lineGap: 1.129,
    name: 'Neon Glitch',
    fontSize: 62,
    fill: '#FFFFFF',
    stroke: { color: '#000000', width: 3 },
    shadow: null,
    glitch: {
      offsets: [
        { x: -4, y: 2, color: '#00E5FF' },
        { x: 4, y: -2, color: '#FF00E5' },
      ],
    },
  },
  {
    ...BASE,
    id: 'minimal-lower-third',
    name: 'Minimal Lower Third',
    fontFamily: 'Liberation Sans',
    fontFile: 'LiberationSans-Bold.ttf',
    fontSize: 40,
    fill: '#FFFFFF',
    stroke: { color: '#000000', width: 3 },
    shadow: { x: 2, y: 2, color: '#000000', opacity: 0.9 },
    lines: 1,
    y: [276],
    rule: { y: 252, width: 500, height: 2, color: '#FFFFFF', opacity: 0.9 },
  },
  {
    ...BASE,
    id: 'red-stroke',
    lineGap: 1.2963,
    name: 'Red Stroke',
    fontFamily: 'Poppins',
    fontFile: 'Poppins-Bold.ttf',
    fontSize: 54,
    fill: '#FFFFFF',
    stroke: { color: '#E11D2E', width: 6 },
    shadow: { x: 3, y: 3, color: '#000000', opacity: 0.85 },
    y: [105, 175],
  },
  {
    ...BASE,
    id: 'heavy-white',
    lineGap: 1.2167,
    name: 'Heavy White',
    fontFamily: 'Poppins',
    fontFile: 'Poppins-Bold.ttf',
    fontSize: 60,
    fill: '#FFFFFF',
    stroke: { color: '#000000', width: 8 },
    shadow: { x: 4, y: 4, color: '#000000', opacity: 0.9 },
    y: [105, 178],
  },
  {
    ...BASE,
    id: 'mono-clean',
    lineGap: 1.375,
    name: 'Mono Clean',
    fontFamily: 'DejaVu Sans Mono',
    fontFile: 'DejaVuSansMono-Bold.ttf',
    fontSize: 48,
    fill: '#FFFFFF',
    stroke: { color: '#000000', width: 9 },
    shadow: { x: 4, y: 4, color: '#000000', opacity: 0.85 },
    y: [112, 178],
  },
]);

export function getCaptionTemplate(id) {
  const key = String(id || '').trim().toLowerCase();
  const template = CAPTION_TEMPLATES.find((item) => item.id === key);
  if (!template) {
    throw new Error(`Unknown caption template '${id}'. Available: ${CAPTION_TEMPLATES.map((item) => item.id).join(', ')}`);
  }
  return template;
}

export function resolveTemplateFont(template) {
  const bundled = path.join(FONT_DIR, template.fontFile);
  if (fs.existsSync(bundled)) return bundled;

  for (const candidate of SYSTEM_FONT_PATHS[template.fontFile] || []) {
    if (fs.existsSync(candidate)) return candidate;
  }

  for (const fallback of ['Poppins-Bold.ttf', 'Anton-Regular.ttf', 'BebasNeue-Regular.ttf']) {
    const candidate = path.join(FONT_DIR, fallback);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

export function listCaptionTemplates() {
  return CAPTION_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    font: template.fontFamily,
    font_file: template.fontFile,
    font_available: Boolean(resolveTemplateFont(template)),
    font_size: template.fontSize,
    line_gap: template.lineGap,
    fill: template.fill,
    stroke: template.stroke,
    shadow: template.shadow,
    lines: template.lines,
    y: template.y,
    animation: template.animation,
    rule: template.rule,
    glitch: template.glitch,
  }));
}

export function splitCaptionLines(text, lineCount = 2) {
  const source = String(text ?? '').trim();
  if (!source) return [''];
  if (lineCount <= 1) return [source.replace(/\s+/g, ' ')];

  const explicit = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (explicit.length >= 2) return explicit.slice(0, 2);

  const words = source.replace(/\s+/g, ' ').split(' ');
  if (words.length === 1) return [words[0], ''];

  let bestIndex = 1;
  let bestDelta = Infinity;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(' ').length;
    const right = words.slice(index).join(' ').length;
    const delta = Math.abs(left - right);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')];
}

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function writeTextFile(text, tempFiles) {
  const file = path.join(os.tmpdir(), `usk-tpl-${crypto.randomBytes(6).toString('hex')}.txt`);
  fs.writeFileSync(file, text, 'utf8');
  tempFiles.push(file);
  return file;
}

export function buildTemplateCaptionFilters(caption, template, { width = 1080, height = 1920, tempFiles = [] } = {}) {
  const fontPath = resolveTemplateFont(template);
  if (!fontPath) {
    throw new Error(`Font for caption template '${template.id}' not found; expected ${template.fontFile}`);
  }

  const scale = width / REFERENCE_CANVAS.width;
  const fontSize = Math.max(12, Math.round(template.fontSize * scale));
  const strokeWidth = Math.max(2, Math.round(template.stroke.width * scale));
  const start = ((caption.timeline_start_ms || 0) / 1000).toFixed(3);
  const end = (((caption.timeline_start_ms || 0) + (caption.duration_ms || 1000)) / 1000).toFixed(3);
  const text = template.uppercase ? String(caption.text || '').toUpperCase() : String(caption.text || '');
  const lines = splitCaptionLines(text, template.lines);
  const fontOpt = `:fontfile='${escapeFilterPath(fontPath)}'`;
  const enable = `enable='between(t\\,${start}\\,${end})'`;
  const fade = template.animation?.type === 'fade'
    ? `:alpha='if(lt(t-${start}\\,0.4)\\,(t-${start})/0.4\\,1)'`
    : '';
  const filters = [];

  if (template.rule) {
    const ruleY = Math.round((template.rule.y / REFERENCE_CANVAS.height) * height);
    const ruleW = Math.round(template.rule.width * scale);
    const ruleH = Math.max(1, Math.round(template.rule.height * scale));
    const ruleX = Math.round((width - ruleW) / 2);
    filters.push(`drawbox=x=${ruleX}:y=${ruleY}:w=${ruleW}:h=${ruleH}:color=${template.rule.color}@${template.rule.opacity}:t=fill:${enable}`);
  }

  lines.forEach((line, index) => {
    if (!line) return;
    const y1 = Math.round((template.y[0] / REFERENCE_CANVAS.height) * height);
    const lineGap = Math.round(fontSize * (template.lineGap || 1.1));
    const y = y1 + (index * lineGap);
    const textFile = escapeFilterPath(writeTextFile(line, tempFiles));
    const base = `textfile='${textFile}':expansion=none${fontOpt}:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:${enable}${fade}`;

    if (template.glitch) {
      for (const offset of template.glitch.offsets) {
        const x = offset.x === 0 ? '(w-text_w)/2' : `(w-text_w)/2${offset.x > 0 ? '+' : ''}${offset.x}`;
        const oy = offset.y === 0 ? `${y}` : `${y}${offset.y > 0 ? '+' : ''}${offset.y}`;
        filters.push(`drawtext=${base.replace('x=(w-text_w)/2', `x=${x}`).replace(`y=${y}`, `y=${oy}`)}:fontcolor=${offset.color}`);
      }
      filters.push(`drawtext=${base}:fontcolor=${template.fill}:borderw=${strokeWidth}:bordercolor=${template.stroke.color}`);
      return;
    }

    const shadow = template.shadow
      ? `:shadowx=${Math.max(1, Math.round(template.shadow.x * scale))}:shadowy=${Math.max(1, Math.round(template.shadow.y * scale))}:shadowcolor=${template.shadow.color}@${template.shadow.opacity}`
      : '';
    filters.push(`drawtext=${base}:fontcolor=${template.fill}:borderw=${strokeWidth}:bordercolor=${template.stroke.color}${shadow}`);
  });

  return filters.join(',');
}
