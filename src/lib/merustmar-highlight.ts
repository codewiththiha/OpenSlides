/**
 * merustmar-highlight.ts
 * Custom syntax highlighter fallback for Merustmar.
 * Produces HTML strings with inline styles matching Shiki's output format.
 *
 * Used only when Shiki fails to load the merustmar grammar.
 */

const KEYWORDS = /တကယ်လို့|မဟုတ်ရင်|လို့ထား|ဒါယူ|ခါပတ်|ထား|ပတ်|ဖန်ရှင်/;
const BOOLEANS = /မှန်|မှား/;
const ASCII_BUILTINS =
  /\b(len|first|last|rest|push|terminal_init|terminal_end|clear|terminal_size|print_at|print_at_center|draw_border|flush|read_key|poll_key|sleep|rand|now_ms|input|is_string|is_int|is_double|to_integer|to_double)\b/;
const MYANMAR_BUILTIN = /ရေး/;

function isWordChar(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 0x1000 && c <= 0x109f) || /[a-zA-Z0-9_]/.test(ch);
}

function tryMatch(line: string, pos: number, pattern: RegExp): string | null {
  const m = line.slice(pos).match(pattern);
  if (!m) return null;
  if (pos > 0 && isWordChar(line[pos - 1])) return null;
  if (pos + m[0].length < line.length && isWordChar(line[pos + m[0].length])) return null;
  return m[0];
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DARK: Record<string, string> = {
  keyword: '#c678dd',
  boolean: '#d19a66',
  builtin: '#61afef',
  string: '#98c379',
  number: '#d19a66',
  comment: '#5c6370',
  operator: '#56b6c2',
  default: '#abb2bf',
};

const LIGHT: Record<string, string> = {
  keyword: '#a626a4',
  boolean: '#986801',
  builtin: '#4078f2',
  string: '#50a14f',
  number: '#986801',
  comment: '#a0a1a7',
  operator: '#0184bc',
  default: '#383a42',
};

function highlightLine(line: string, c: Record<string, string>): string {
  const parts: string[] = [];
  let i = 0;
  let plain = '';

  const flush = () => {
    if (plain) {
      parts.push(`<span style="color:${c.default}">${esc(plain)}</span>`);
      plain = '';
    }
  };

  const s = (color: string, text: string) =>
    `<span style="color:${color}">${esc(text)}</span>`;

  while (i < line.length) {
    if (line[i] === '/' && line[i + 1] === '/') {
      flush(); parts.push(s(c.comment, line.slice(i))); return parts.join('');
    }
    if (line[i] === '#') {
      flush(); parts.push(s(c.comment, line.slice(i))); return parts.join('');
    }
    if (line[i] === '/' && line[i + 1] === '*') {
      flush(); parts.push(s(c.comment, line.slice(i))); return parts.join('');
    }
    if (line[i] === '"') {
      flush();
      let j = i + 1;
      while (j < line.length && line[j] !== '"') { if (line[j] === '\\') j++; j++; }
      j = Math.min(j + 1, line.length);
      parts.push(s(c.string, line.slice(i, j)));
      i = j; continue;
    }
    const kw = tryMatch(line, i, KEYWORDS);
    if (kw) { flush(); parts.push(s(c.keyword, kw)); i += kw.length; continue; }
    const bl = tryMatch(line, i, BOOLEANS);
    if (bl) { flush(); parts.push(s(c.boolean, bl)); i += bl.length; continue; }
    const ab = tryMatch(line, i, ASCII_BUILTINS);
    if (ab) { flush(); parts.push(s(c.builtin, ab)); i += ab.length; continue; }
    const mb = tryMatch(line, i, MYANMAR_BUILTIN);
    if (mb) { flush(); parts.push(s(c.builtin, mb)); i += mb.length; continue; }
    if (line[i] === '=' && line[i + 1] === '=') { flush(); parts.push(s(c.operator, '==')); i += 2; continue; }
    if (line[i] === '!' && line[i + 1] === '=') { flush(); parts.push(s(c.operator, '!=')); i += 2; continue; }
    if (line[i] === '<' && line[i + 1] === '=') { flush(); parts.push(s(c.operator, '<=')); i += 2; continue; }
    if (line[i] === '>' && line[i + 1] === '=') { flush(); parts.push(s(c.operator, '>=')); i += 2; continue; }
    if (line[i] === '&' && line[i + 1] === '&') { flush(); parts.push(s(c.operator, '&&')); i += 2; continue; }
    if (line[i] === '|' && line[i + 1] === '|') { flush(); parts.push(s(c.operator, '||')); i += 2; continue; }
    if ('<>+-*/%='.includes(line[i])) { flush(); parts.push(s(c.operator, line[i])); i++; continue; }
    const floatM = line.slice(i).match(/^\d+\.\d+/);
    if (floatM && (i === 0 || !isWordChar(line[i - 1]))) {
      flush(); parts.push(s(c.number, floatM[0])); i += floatM[0].length; continue;
    }
    const intM = line.slice(i).match(/^\d+/);
    if (intM && (i === 0 || !isWordChar(line[i - 1])) && (i + intM[0].length >= line.length || !/[a-zA-Z]/.test(line[i + intM[0].length]))) {
      flush(); parts.push(s(c.number, intM[0])); i += intM[0].length; continue;
    }
    const myNumM = line.slice(i).match(/^[၀-၉]+/);
    if (myNumM) { flush(); parts.push(s(c.number, myNumM[0])); i += myNumM[0].length; continue; }
    if (line[i] === '။') { flush(); parts.push(s(c.default, '။')); i++; continue; }
    if ('{}(),'.includes(line[i])) { flush(); parts.push(s(c.default, line[i])); i++; continue; }
    plain += line[i]; i++;
  }
  flush();
  return parts.join('');
}

export function highlightMerustmarCode(code: string, isDark: boolean = true): string {
  const c = isDark ? DARK : LIGHT;
  return code.split('\n').map(line => `<span class="line">${highlightLine(line, c)}</span>`).join('\n');
}
