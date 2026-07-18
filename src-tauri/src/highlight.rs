//! Pure highlight-range processing for the slide overlay.
//!
//! This module is the single source of truth for "which lines, and which
//! char-from/char-to inside each line" a highlight covers, plus the slicing
//! of the Shiki/Merustmar highlighted HTML into per-line clone fragments.
//!
//! It deliberately has **no** Tauri or sqlx dependencies so it stays fully
//! unit-testable — the Tauri commands in `commands/highlight.rs` are thin
//! wrappers over these functions.
//!
//! Contract with the frontend:
//! - Char offsets are **UTF-16 code units**, i.e. plain JavaScript string
//!   indices — the same units the textarea selection APIs and Shiki output
//!   use. (A line with an emoji therefore counts 2 units for that emoji on
//!   both sides.)
//! - Line indices are 0-based, end offsets are exclusive.
//! - Highlighted HTML entities (`&lt;`, `&#x3C;`, …) count as **one**
//!   visible char each — the pre-Rust frontend got this wrong, which broke
//!   cloning on lines containing `<`, `>` or `&`.

use serde::{Deserialize, Serialize};

/// 0-based line/char span over the raw code text (frontend `Highlight`
/// geometry without the visual options).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RangeSpec {
    pub start_line: i64,
    pub start_char: i64,
    pub end_line: i64,
    pub end_char: i64,
}

/// One line of a computed highlight plan.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanLine {
    /// 0-based index of this line in the source code.
    pub line_index: usize,
    /// Clamped selection start (UTF-16 units) inside this line.
    pub start_char: usize,
    /// Clamped selection end (exclusive) inside this line.
    pub end_char: usize,
    /// Syntax-colored HTML for the selected slice (spans balanced, entities
    /// preserved). Falls back to escaped plain text when the line could not
    /// be sliced out of the highlighted HTML.
    pub html: String,
    /// Selected raw text of this line ("" when nothing is selected here).
    pub plain_text: String,
    /// True when the selection covers no chars of this line (e.g. an empty
    /// middle line) — the overlay skips erasing/cloning it but the entry is
    /// kept so every covered line maps 1:1 to a plan line.
    pub is_empty: bool,
}

/// Everything the overlay needs to render one highlight step.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanPayload {
    pub lines: Vec<PlanLine>,
    /// Slide background color mixed toward black by the dim amount — the
    /// exact color the eraser boxes must paint to be invisible over the
    /// dimmed card.
    pub eraser_color: String,
    /// Selected text across all lines joined by '\n' (panel snippets).
    pub selected_text: String,
}

/* ------------------------------------------------------------------------ *
 * UTF-16 helpers
 * ------------------------------------------------------------------------ */

/// Length of `s` in UTF-16 code units (JS `string.length`).
fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// Slice `s` by UTF-16 code-unit offsets [start, end) — the Rust twin of
/// `String.prototype.slice` on JS-side char offsets.
fn slice_utf16(s: &str, start: usize, end: usize) -> String {
    if start >= end {
        return String::new();
    }
    let mut out = String::new();
    let mut pos = 0usize;
    for ch in s.chars() {
        let next = pos + ch.len_utf16();
        if next > start && pos < end {
            out.push(ch);
        }
        pos = next;
        if pos >= end {
            break;
        }
    }
    out
}

fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

/* ------------------------------------------------------------------------ *
 * Range decomposition — "which lines, which char from which char"
 * ------------------------------------------------------------------------ */

/// One covered line's clamped char range (UTF-16 units).
#[derive(Debug, Clone, Copy)]
struct LineRange {
    line_index: usize,
    start: usize,
    end: usize,
}

/// Decompose a (possibly stale) range into per-line char spans, clamped to
/// the *current* code — a highlight can outlive edits, so out-of-bounds
/// lines/chars must never panic, just clamp.
fn decompose(code: &str, range: &RangeSpec) -> Vec<LineRange> {
    let code_lines: Vec<&str> = code.split('\n').collect();
    let total = code_lines.len() as i64;
    let start_line = range.start_line.clamp(0, total - 1);
    let end_line = range.end_line.clamp(start_line, total - 1);

    let mut out = Vec::new();
    for i in start_line..=end_line {
        let li = i as usize;
        let line_len = utf16_len(code_lines[li]) as i64;
        let raw_start = if i == start_line { range.start_char } else { 0 };
        let raw_end = if i == end_line {
            range.end_char
        } else {
            i64::MAX
        };
        let start = raw_start.clamp(0, line_len) as usize;
        let end = raw_end.clamp(start as i64, line_len) as usize;
        out.push(LineRange {
            line_index: li,
            start,
            end,
        });
    }
    out
}

/// Convert flat UTF-16 text offsets (textarea `selectionStart`) to a
/// line/char position. Mirrors the previous inline editor math:
/// `line = # of '\n' before offset`, `char = offset - (last '\n' pos + 1)`.
fn offset_to_line_char(code: &str, offset: usize) -> (i64, i64) {
    let mut line = 0i64;
    let mut col = 0i64;
    let mut pos = 0usize;
    for ch in code.chars() {
        if pos >= offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            col = 0;
        } else {
            col += ch.len_utf16() as i64;
        }
        pos += ch.len_utf16();
    }
    (line, col)
}

/// Convert a flat [start, end) text selection into a line/char range.
pub fn selection_to_range(code: &str, start: usize, end: usize) -> RangeSpec {
    let (start_line, start_char) = offset_to_line_char(code, start.min(end));
    let (end_line, end_char) = offset_to_line_char(code, start.max(end));
    RangeSpec {
        start_line,
        start_char,
        end_line,
        end_char,
    }
}

/// Selected raw text of a range, lines joined by '\n'.
fn selected_text_of(code: &str, range: &RangeSpec) -> String {
    let code_lines: Vec<&str> = code.split('\n').collect();
    decompose(code, range)
        .iter()
        .map(|lr| slice_utf16(code_lines[lr.line_index], lr.start, lr.end))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Plain-text snippet for each range (highlight settings panel rows).
pub fn snippets(code: &str, ranges: &[RangeSpec]) -> Vec<String> {
    ranges.iter().map(|r| selected_text_of(code, r)).collect()
}

/* ------------------------------------------------------------------------ *
 * HTML tokenizer — tag / visible-char tokens with UTF-16 units & entities
 * ------------------------------------------------------------------------ */

#[derive(Debug)]
enum Tok {
    Tag(String),
    /// `raw` is the source text as it must be re-emitted (entities kept
    /// escaped), `units` is its visible width in UTF-16 code units.
    Char {
        raw: String,
        units: usize,
    },
}

/// Parse `&name;` / `&#123;` / `&#x2F;` at byte offset `at` (which points at
/// `&`). Returns the raw entity text and its decoded UTF-16 width (always 1
/// for the entities Shiki emits, but generic numeric refs may decode to a
/// surrogate pair).
fn parse_entity(html: &str, at: usize) -> Option<(String, usize)> {
    let rest = html.get(at..)?;
    debug_assert!(rest.starts_with('&'));
    let semi_rel = rest.find(';')?;
    // Sanity cap: longest real entity is ~10 chars ("&#x10FFFF;").
    if semi_rel > 10 {
        return None;
    }
    let body = &rest[1..semi_rel];
    if body.is_empty() {
        return None;
    }
    let decoded: char = if let Some(num) = body.strip_prefix('#') {
        let cp: u32 = if let Some(hex) = num.strip_prefix('x').or_else(|| num.strip_prefix('X')) {
            if hex.is_empty() || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
                return None;
            }
            u32::from_str_radix(hex, 16).ok()?
        } else {
            if num.is_empty() || !num.bytes().all(|b| b.is_ascii_digit()) {
                return None;
            }
            num.parse::<u32>().ok()?
        };
        // from_u32 rejects surrogates and > U+10FFFF.
        char::from_u32(cp)?
    } else {
        match body {
            "amp" => '&',
            "lt" => '<',
            "gt" => '>',
            "quot" => '"',
            "apos" => '\'',
            _ => return None,
        }
    };
    Some((rest[..=semi_rel].to_string(), decoded.len_utf16()))
}

/// Lex an HTML fragment into tag and visible-char tokens. `>` inside quoted
/// tag attributes is honored; unknown/invalid entities pass through as a
/// single `&` char.
fn lex(html: &str) -> Vec<Tok> {
    let bytes = html.as_bytes();
    let n = bytes.len();
    let mut toks = Vec::new();
    let mut i = 0usize;
    while i < n {
        match bytes[i] {
            b'<' => {
                let mut j = i + 1;
                let mut quote: Option<u8> = None;
                while j < n {
                    let c = bytes[j];
                    match quote {
                        Some(q) => {
                            if c == q {
                                quote = None;
                            }
                        }
                        None => {
                            if c == b'"' || c == b'\'' {
                                quote = Some(c);
                            } else if c == b'>' {
                                break;
                            }
                        }
                    }
                    j += 1;
                }
                let end = usize::min(j + 1, n);
                toks.push(Tok::Tag(html[i..end].to_string()));
                i = end;
            }
            b'&' => {
                if let Some((raw, units)) = parse_entity(html, i) {
                    i += raw.len();
                    toks.push(Tok::Char { raw, units });
                } else {
                    toks.push(Tok::Char {
                        raw: "&".to_string(),
                        units: 1,
                    });
                    i += 1;
                }
            }
            _ => {
                let ch = html[i..].chars().next().unwrap(); // i is always a char boundary
                toks.push(Tok::Char {
                    raw: ch.to_string(),
                    units: ch.len_utf16(),
                });
                i += ch.len_utf8();
            }
        }
    }
    toks
}

/// Lowercased tag name of a raw tag token (`</span>` → `span`).
fn tag_name(raw: &str) -> String {
    let inner = raw.trim_start_matches('<');
    let inner = inner.strip_prefix('/').unwrap_or(inner);
    let inner = inner.trim_start();
    let end = inner
        .find(|c: char| !c.is_ascii_alphanumeric())
        .unwrap_or(inner.len());
    inner[..end].to_ascii_lowercase()
}

/* ------------------------------------------------------------------------ *
 * Shiki / Merustmar HTML splitting + slicing
 * ------------------------------------------------------------------------ */

fn is_span_open(raw: &str) -> bool {
    matches!(
        raw.strip_prefix("<span").and_then(|r| r.chars().next()),
        Some(' ') | Some('>') | Some('/')
    )
}

fn is_span_close(raw: &str) -> bool {
    raw.starts_with("</span")
}

/// Does the tag carry `class` containing the whole word `line`?
fn class_contains_line(raw: &str) -> bool {
    let Some(pos) = raw.find("class=\"") else {
        return false;
    };
    let rest = &raw[pos + 7..];
    let Some(end) = rest.find('"') else {
        return false;
    };
    rest[..end].split_whitespace().any(|w| w == "line")
}

/// Split full highlighted HTML into per-line **inner** HTML (line wrappers
/// stripped). Both Shiki (`<pre><code><span class="line">…</span>\n…`) and
/// the Merustmar fallback (`<span class="line">…</span>` joined by `\n`)
/// emit `<span class="line">` blocks with nested token spans, so we count
/// span depth instead of doing a (fragile) regex split. Returns an empty
/// vec when no line spans are present — callers then fall back to plain
/// escaped code text.
pub fn split_line_spans(html: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut depth = 0usize;
    let mut capturing = false;
    let mut buf = String::new();

    for tok in lex(html) {
        if let Tok::Tag(raw) = &tok {
            if is_span_open(raw) {
                if depth == 0 && !capturing && class_contains_line(raw) {
                    capturing = true;
                    buf.clear();
                    depth = 1;
                    continue;
                }
                if depth > 0 {
                    depth += 1;
                }
                if capturing {
                    buf.push_str(raw);
                }
                continue;
            }
            if is_span_close(raw) {
                if depth == 1 && capturing {
                    lines.push(std::mem::take(&mut buf));
                    capturing = false;
                    depth = 0;
                    continue;
                }
                if depth > 0 {
                    depth -= 1;
                }
                if capturing {
                    buf.push_str(raw);
                }
                continue;
            }
            // Non-span tag inside a line (kept verbatim when capturing).
        }
        if capturing {
            match &tok {
                Tok::Tag(raw) => buf.push_str(raw),
                Tok::Char { raw, .. } => buf.push_str(raw),
            }
        }
    }
    lines
}

/// Extract the visible chars [start, end) (UTF-16 units; `None` end = "to
/// end of line") from one line's inner HTML **keeping the token spans
/// balanced**: spans that opened before the range are re-emitted as a
/// prefix, spans left open at the range end are closed in a suffix —
/// otherwise the clone text loses its syntax colors the moment a selection
/// starts or ends mid-token.
pub fn extract_visible(line_html: &str, start: usize, end: Option<usize>) -> String {
    let toks = lex(line_html);
    let mut char_index = 0usize;
    let mut body = String::new();
    let mut prefix = String::new();
    let mut opened = false;
    // Open spans: (raw text, tag name, emitted?) — `emitted` marks spans
    // already written to `body`/`prefix`, so the suffix only closes those.
    let mut stack: Vec<(String, String, bool)> = Vec::new();
    let in_range = |idx: usize| idx >= start && end.map_or(true, |e| idx < e);

    for tok in &toks {
        if opened {
            if let Some(e) = end {
                if char_index >= e {
                    break;
                }
            }
        }
        match tok {
            Tok::Tag(raw) => {
                if raw.starts_with("</") {
                    let name = tag_name(raw);
                    if let Some(pos) = stack.iter().rposition(|(_, n, _)| n == &name) {
                        let (_, _, emitted) = stack.remove(pos);
                        // A closing tag is only emitted when its opener was;
                        // otherwise we'd emit an unbalanced `</span>`.
                        if emitted {
                            body.push_str(raw);
                        }
                    }
                    continue;
                }
                let is_self_closing = {
                    let t = raw.strip_suffix('>').unwrap_or(raw).trim_end();
                    t.ends_with('/')
                };
                let emit_this = opened || in_range(char_index);
                if emit_this {
                    body.push_str(raw);
                }
                if !is_self_closing {
                    stack.push((raw.clone(), tag_name(raw), emit_this));
                }
            }
            Tok::Char { raw, units } => {
                if in_range(char_index) {
                    if !opened {
                        // Range begins inside already-open spans: re-open them
                        // (once) so the slice carries its syntax colors.
                        for entry in stack.iter_mut() {
                            if !entry.2 {
                                prefix.push_str(&entry.0);
                                entry.2 = true;
                            }
                        }
                        opened = true;
                    }
                    body.push_str(raw);
                }
                char_index += units;
            }
        }
    }

    let mut tail = String::new();
    for (_, name, emitted) in stack.iter().rev() {
        if *emitted {
            tail.push_str("</");
            tail.push_str(name);
            tail.push('>');
        }
    }
    let mut out = prefix;
    out.push_str(&body);
    out.push_str(&tail);
    out
}

/* ------------------------------------------------------------------------ *
 * Eraser color
 * ------------------------------------------------------------------------ */

/// Mix a `#rrggbb` background toward black by `dim_percent` — the overlay
/// erasers must match the *dimmed* card, not the raw slide background.
/// Non-hex input is returned unchanged (matches the old frontend helper).
pub fn mix_toward_black(bg: &str, dim_percent: i64) -> String {
    let t = (dim_percent.clamp(0, 100)) as f64 / 100.0;
    let hex = bg.trim().trim_start_matches('#');
    if hex.len() == 6 && hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        let channel = |i: usize| -> i64 {
            let v = i64::from_str_radix(&hex[i..i + 2], 16).unwrap_or(0);
            ((v as f64) * (1.0 - t)).round() as i64
        };
        format!("rgb({}, {}, {})", channel(0), channel(2), channel(4))
    } else {
        bg.to_string()
    }
}

/* ------------------------------------------------------------------------ *
 * Plan assembly
 * ------------------------------------------------------------------------ */

/// Compute the full render plan for one highlight in one call:
/// per-line clamped char ranges + clone HTML + plain text + eraser color.
pub fn build_plan(
    code: &str,
    html: &str,
    range: &RangeSpec,
    theme_bg: &str,
    dim_percent: i64,
) -> PlanPayload {
    let code_lines: Vec<&str> = code.split('\n').collect();
    let html_lines: Vec<String> = if html.is_empty() {
        Vec::new()
    } else {
        split_line_spans(html)
    };

    let spans = decompose(code, range);
    let mut lines = Vec::with_capacity(spans.len());
    let mut selected_parts: Vec<String> = Vec::new();

    for lr in &spans {
        let raw_line = code_lines[lr.line_index];
        let plain = slice_utf16(raw_line, lr.start, lr.end);
        let is_empty = lr.start >= lr.end;

        let mut slice_html = String::new();
        if !is_empty {
            if let Some(line_html) = html_lines.get(lr.line_index) {
                if !line_html.is_empty() {
                    slice_html = extract_visible(line_html, lr.start, Some(lr.end));
                }
            }
            // No sliceable HTML (language not highlighted, or the line is
            // whitespace-only) → escaped plain text; the clone still shows.
            if slice_html.trim().is_empty() {
                slice_html = escape_html(&plain);
            }
        }
        selected_parts.push(plain.clone());

        lines.push(PlanLine {
            line_index: lr.line_index,
            start_char: lr.start,
            end_char: lr.end,
            html: slice_html,
            plain_text: plain,
            is_empty,
        });
    }

    PlanPayload {
        lines,
        eraser_color: mix_toward_black(theme_bg, dim_percent),
        selected_text: selected_parts.join("\n"),
    }
}

/* ------------------------------------------------------------------------ *
 * Tests — run with `cargo test` inside src-tauri.
 * ------------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;

    const CODE: &str = "console.error('Error:', error);\nconst xs = list.map(x => x + 1);\n\nif (a < b && c > d) {\n  console.log(\"cmp\");\n}";

    fn range(sl: i64, sc: i64, el: i64, ec: i64) -> RangeSpec {
        RangeSpec {
            start_line: sl,
            start_char: sc,
            end_line: el,
            end_char: ec,
        }
    }

    /* ------------------------- decomposition ------------------------- */

    #[test]
    fn decompose_single_line() {
        let d = decompose(CODE, &range(0, 14, 0, 22));
        assert_eq!(d.len(), 1);
        assert_eq!((d[0].line_index, d[0].start, d[0].end), (0, 14, 22));
    }

    #[test]
    fn decompose_multi_line_covers_every_line() {
        // From char 8 of line 0 to char 6 of line 4 — an entry per line,
        // including the empty middle line 2 (start == end there).
        let d = decompose(CODE, &range(0, 8, 4, 6));
        assert_eq!(d.len(), 5);
        assert_eq!((d[0].line_index, d[0].start, d[0].end), (0, 8, 31));
        assert_eq!((d[1].line_index, d[1].start, d[1].end), (1, 0, 32));
        assert_eq!((d[2].line_index, d[2].start, d[2].end), (2, 0, 0));
        assert_eq!((d[3].line_index, d[3].start, d[3].end), (3, 0, 21));
        assert_eq!((d[4].line_index, d[4].start, d[4].end), (4, 0, 6));
    }

    #[test]
    fn decompose_clamps_stale_ranges() {
        // Line 99 / char 999 no longer exist — clamp, don't panic.
        let d = decompose(CODE, &range(0, 3, 99, 999));
        assert_eq!(d.len(), 6);
        let last = d.last().unwrap();
        assert_eq!((last.line_index, last.start, last.end), (5, 0, 1));

        let d = decompose(CODE, &range(99, 0, 120, 5));
        assert_eq!(d.len(), 1);
        assert_eq!((d[0].line_index, d[0].start, d[0].end), (5, 0, 1));

        // Single-line shrink: start clamps to line length, end ≥ start.
        let d = decompose("ab", &range(0, 5, 0, 99));
        assert_eq!((d[0].start, d[0].end), (2, 2));
    }

    /* ------------------------ selection math ------------------------- */

    #[test]
    fn selection_offsets_to_line_char() {
        let r = selection_to_range(CODE, 14, 22);
        assert_eq!(
            (r.start_line, r.start_char, r.end_line, r.end_char),
            (0, 14, 0, 22)
        );
        // Exactly at a newline boundary.
        let r = selection_to_range(CODE, 31, 32);
        assert_eq!(
            (r.start_line, r.start_char, r.end_line, r.end_char),
            (0, 31, 1, 0)
        );
        // Multi-line span.
        let off_start = 8; // line 0, char 8
        let off_end = 31 + 1 + 32 + 1 + 0 + 1 + 6; // line 3, char 6
        let r = selection_to_range(CODE, off_start, off_end);
        assert_eq!(
            (r.start_line, r.start_char, r.end_line, r.end_char),
            (0, 8, 3, 6)
        );
    }

    #[test]
    fn utf16_units_match_js_indices() {
        assert_eq!(utf16_len("a🦀b"), 4); // JS "a🦀b".length === 4
        assert_eq!(slice_utf16("a🦀b", 1, 3), "🦀");
        assert_eq!(slice_utf16("a🦀b", 0, 4), "a🦀b");
        let code = "let 🦀 = 1;\n🦀 += 1;"; // 11 + 1 + 8 = 20 UTF-16 units
        let r = selection_to_range(code, 4, 15);
        assert_eq!((r.start_line, r.start_char), (0, 4));
        assert_eq!((r.end_line, r.end_char), (1, 3));
    }

    /* ----------------------------- lexer ------------------------------ */

    #[test]
    fn lexer_decodes_entities_as_single_chars() {
        let toks = lex("a &#x3C; &lt; &amp; &quot; &#39; &unknown; &");
        let widths: Vec<usize> = toks
            .iter()
            .filter_map(|t| match t {
                Tok::Char { units, .. } => Some(*units),
                _ => None,
            })
            .collect();
        // 5 decoded entities + 14 plain chars + 8 chars of the unrecognized
        // "&unknown;" (incl. the leading '&' and the ';') — 23 char tokens.
        assert_eq!(
            toks.iter()
                .filter(|t| matches!(t, Tok::Char { .. }))
                .count(),
            23
        );
        assert!(widths.iter().all(|u| *u == 1));
    }

    /* -------------------------- line splitting ------------------------ */

    const SHIKI_LIKE: &str = "<pre class=\"shiki dark-plus\" style=\"background-color:#1E1E1E\"><code>\
<span class=\"line\"><span style=\"color:#9CDCFE\">console</span><span style=\"color:#D4D4D4\">.</span><span style=\"color:#DCDCAA\">error</span></span>\n\
<span class=\"line\"></span>\n\
<span class=\"line\"><span style=\"color:#C586C0\">if</span><span style=\"color:#D4D4D4\"> (</span><span style=\"color:#9CDCFE\">a</span><span style=\"color:#D4D4D4\"> &#x3C; </span><span style=\"color:#9CDCFE\">b</span><span style=\"color:#D4D4D4\"> &#x26;&#x26; c</span></span></code></pre>";

    #[test]
    fn split_lines_handles_nested_spans() {
        let lines = split_line_spans(SHIKI_LIKE);
        assert_eq!(lines.len(), 3);
        assert!(lines[0].starts_with("<span style=\"color:#9CDCFE\">console</span>"));
        assert_eq!(lines[1], "");
        assert!(lines[2].contains("&#x3C;"));
        assert!(!lines[2].contains("class=\"line\""));
    }

    #[test]
    fn split_lines_merustmar_shape() {
        // Merustmar fallback: bare line spans joined by '\n', no pre/code.
        let html = "<span class=\"line\">a</span>\n<span class=\"line\"><span style=\"color:#fff\">b</span></span>";
        let lines = split_line_spans(html);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], "a");
        assert_eq!(lines[1], "<span style=\"color:#fff\">b</span>");
    }

    /* -------------------------- visible slicing ----------------------- */

    fn visible_text(line_html: &str) -> String {
        // Test helper: strip tags, decode entities → the visible text.
        let mut out = String::new();
        for tok in lex(line_html) {
            if let Tok::Char { raw, .. } = tok {
                let decoded = match raw.as_str() {
                    "&lt;" | "&#x3C;" => "<",
                    "&gt;" => ">",
                    "&amp;" | "&#x26;" => "&",
                    "&quot;" => "\"",
                    "&#39;" | "&apos;" => "'",
                    _ => raw.as_str(),
                };
                out.push_str(decoded);
            }
        }
        out
    }

    const L0: &str = "<span style=\"color:#9CDCFE\">console</span><span style=\"color:#D4D4D4\">.</span><span style=\"color:#DCDCAA\">error</span><span style=\"color:#D4D4D4\">(</span><span style=\"color:#CE9178\">'Error:'</span><span style=\"color:#D4D4D4\">, </span><span style=\"color:#9CDCFE\">error</span><span style=\"color:#D4D4D4\">);</span>";
    const L3: &str = "<span style=\"color:#C586C0\">if</span><span style=\"color:#D4D4D4\"> (</span><span style=\"color:#9CDCFE\">a</span><span style=\"color:#D4D4D4\"> &#x3C; </span><span style=\"color:#9CDCFE\">b</span><span style=\"color:#D4D4D4\"> &#x26;&#x26; </span><span style=\"color:#9CDCFE\">c</span><span style=\"color:#D4D4D4\"> > </span><span style=\"color:#9CDCFE\">d</span><span style=\"color:#D4D4D4\">) {</span>";

    #[test]
    fn slices_whole_line_and_char_ranges() {
        assert_eq!(
            visible_text(&extract_visible(L0, 0, None)),
            "console.error('Error:', error);"
        );
        assert_eq!(visible_text(&extract_visible(L0, 0, Some(7))), "console");
        assert_eq!(visible_text(&extract_visible(L0, 14, Some(22))), "'Error:'");
        assert_eq!(visible_text(&extract_visible(L0, 22, None)), ", error);");
        assert_eq!(visible_text(&extract_visible(L0, 3, Some(3))), "");
        assert_eq!(visible_text(&extract_visible(L0, 100, None)), "");
    }

    #[test]
    fn entities_count_as_one_visible_char() {
        // Line "if (a < b && c > d) {" — the JS extractor counted `&#x3C;`
        // as 6 chars and sliced this wrong.
        assert_eq!(visible_text(&extract_visible(L3, 6, Some(14))), "< b && c");
        assert_eq!(visible_text(&extract_visible(L3, 7, Some(14))), " b && c");
        assert_eq!(visible_text(&extract_visible(L3, 0, Some(7))), "if (a <");
    }

    #[test]
    fn slices_are_tag_balanced() {
        let balanced = |h: &str| {
            let opens = h.matches("<span").count();
            let closes = h.matches("</span").count();
            opens == closes
        };
        for (s, e) in [
            (0, None),
            (0, Some(7)),
            (7, Some(14)),
            (5, Some(20)),
            (2, Some(9)),
            (6, Some(14)),
        ] {
            assert!(balanced(&extract_visible(L0, s, e)), "L0 [{s},{e:?})");
            assert!(balanced(&extract_visible(L3, s, e)), "L3 [{s},{e:?})");
        }
        // Slice starting mid-token re-opens the ambient span (keeps colors).
        let sliced = extract_visible(L0, 8, Some(14));
        assert!(sliced.starts_with("<span style=\"color:#DCDCAA\">"));
        assert!(sliced.ends_with("</span>"));
    }

    #[test]
    fn arrow_and_gt_entities_never_cut() {
        // Regression for: highlighting `const filtered = doubled.filter(n => n > 5);`
        // rendered the clone as `…filter(n => n &g` — an entity-blind
        // counter treated each `&gt;` as 4 chars and cut mid-reference.
        // (Browsers re-escape `>` as `&gt;` when re-serializing innerHTML,
        // so we must handle both raw `>` and `&gt;` in the source.)
        let line = "<span style=\"color:#569CD6\">const</span><span style=\"color:#9CDCFE\"> filtered </span><span style=\"color:#D4D4D4\">= doubled.</span><span style=\"color:#DCDCAA\">filter</span><span style=\"color:#D4D4D4\">(n =&gt; n &gt; 5);</span>";
        let full = extract_visible(line, 0, None);
        assert_eq!(
            visible_text(&full),
            "const filtered = doubled.filter(n => n > 5);"
        );
        // No slice may cut mid-entity (this line has no `&amp;`, so any raw
        // `&` left after decoding means a truncated `&gt;`).
        for (s, e) in [(0, None), (32, None), (32, Some(40)), (36, Some(43)), (0, Some(43))] {
            let text = visible_text(&extract_visible(line, s, e));
            assert!(!text.contains('&'), "cut mid-entity at [{s},{e:?}): {text:?}");
        }
        assert_eq!(
            visible_text(&extract_visible(line, 37, Some(44))),
            "n > 5);"
        );
    }

    /* ---------------------------- eraser ------------------------------ */

    #[test]
    fn eraser_color_is_dimmed_bg() {
        assert_eq!(mix_toward_black("#1e1e1e", 75), "rgb(8, 8, 8)");
        assert_eq!(mix_toward_black("#ffffff", 50), "rgb(128, 128, 128)");
        assert_eq!(mix_toward_black("#1e1e1e", 0), "rgb(30, 30, 30)");
        assert_eq!(mix_toward_black("red", 75), "red");
        assert_eq!(mix_toward_black("#1e1e1e", 150), "rgb(0, 0, 0)");
    }

    /* ----------------------------- plan ------------------------------- */

    #[test]
    fn plan_covers_every_line_once() {
        let html = "<pre class=\"shiki\"><code><span class=\"line\">console</span>\n<span class=\"line\">next</span>\n<span class=\"line\"></span>\n<span class=\"line\">last</span></code></pre>";
        let code = "console\nnext\n\nlast";
        let plan = build_plan(code, html, &range(0, 2, 3, 2), "#1e1e1e", 75);
        assert_eq!(plan.lines.len(), 4);
        assert_eq!(plan.eraser_color, "rgb(8, 8, 8)");
        assert_eq!(plan.selected_text, "nsole\nnext\n\nla");
        // Line 2 is empty → is_empty, but the entry exists (1:1 line mapping).
        assert!(!plan.lines[0].is_empty);
        assert!(plan.lines[2].is_empty);
        assert_eq!(plan.lines[3].plain_text, "la");
        // Cloned slices come from the highlighted HTML.
        assert_eq!(visible_text(&plan.lines[0].html), "nsole");
        assert_eq!(visible_text(&plan.lines[1].html), "next");
    }

    #[test]
    fn plan_falls_back_to_escaped_plain_text() {
        let plan = build_plan("a < b", "", &range(0, 0, 0, 5), "#1e1e1e", 75);
        assert_eq!(plan.lines[0].html, "a &lt; b");
    }

    #[test]
    fn snippets_match_selection_text() {
        let out = snippets(
            CODE,
            &[range(0, 0, 0, 7), range(0, 8, 1, 4), range(2, 0, 4, 6)],
        );
        assert_eq!(out[0], "console");
        assert_eq!(out[1], "error('Error:', error);\ncons");
        assert_eq!(out[2], "\nif (a < b && c > d) {\n  cons");
    }
}
