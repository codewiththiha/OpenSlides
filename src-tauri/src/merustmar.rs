//! Rust port of the FROZEN Merustmar fallback highlighter
//! (`src/lib/merustmar-highlight.ts`, per repo policy that file must not be
//! modified — it remains as the frontend fallback when IPC fails).
//!
//! Why this exists: highlighting runs on keystroke-debounce in the editor,
//! on every highlight step in the preview, and on every render of the
//! Merustmar `SlidePreview` branch — all on the WebView main thread. Doing
//! the same work in Rust moves it to the async IPC runtime and keeps one
//! authoritative implementation shape (the frontend falls back to the frozen
//! JS only when the command itself fails).
//!
//! The port is BYTE-EXACT — including the reference's quirks — proven by
//! parity fixtures generated from the frozen JS itself
//! (`src-tauri/tests/fixtures/merustmar/parity.json`, see the `parity` test
//! below). Fidelity notes (do NOT "fix" these, they are reference behavior):
//!
//!  * All indexing is UTF-16 code units (JS string semantics). Rust `&str`
//!    byte/char indexing would diverge for astral characters, so each line
//!    is converted to `Vec<u16>` and all scanning/positions are unit-based.
//!
//!  * The JS `tryMatch` runs an UNANCHORED regex on `line.slice(pos)` — the
//!    match may start AFTER `pos`, yet the boundary checks still use
//!    `pos - 1` and `pos + m[0].length` (not the real match position). When a
//!    keyword sits further ahead than its own UTF-16 length, the checks
//!    pass "early": the keyword is emitted at the wrong position and the
//!    intervening characters are skipped (the JS duplicates text that way,
//!    e.g. `"    ပတ်"` renders the keyword twice). We reproduce this exactly:
//!    candidate search is unanchored, bounds are checked against `pos`, and
//!    the caller advances by the MATCH length, not the match position.
//!
//!  * JS alternation `A|B|C` is leftmost-match, ties broken by list order —
//!    emulated literally, alternatives tried implicitly by earliest valid
//!    occurrence then declaration order.
//!
//!  * `\b` around the ASCII builtins uses regex `\w` semantics ([A-Za-z0-9_],
//!    NO Myanmar), while the JS `isWordChar` also includes U+1000..=U+109F.
//!    Two distinct helpers keep that difference intact.
//!
//!  * Lone-surrogate edge: an astral character + wide whitespace + keyword
//!    can split a surrogate pair inside the JS output; Rust strings cannot
//!    hold lone surrogates, so `from_utf16_lossy` emits U+FFFD there —
//!    visually identical to what the browser renders for a raw lone
//!    surrogate. The fixture corpus deliberately avoids that single case.

/// JS `isWordChar`: Myanmar block + ASCII `[a-zA-Z0-9_]`.
fn is_word_char(u: u16) -> bool {
    (0x1000..=0x109f).contains(&u) || is_regex_word(u)
}

/// Regex `\w` used by `\b` in the ASCII-builtin pattern: ASCII only.
fn is_regex_word(u: u16) -> bool {
    u == 0x5f // '_'
        || (0x30..=0x39).contains(&u) // 0-9
        || (0x41..=0x5a).contains(&u) // A-Z
        || (0x61..=0x7a).contains(&u) // a-z
}

const SLASH: u16 = '/' as u16;
const STAR: u16 = '*' as u16;
const HASH: u16 = '#' as u16;
const QUOTE: u16 = '"' as u16;
const BACKSLASH: u16 = '\\' as u16;
const DOT: u16 = '.' as u16;
/// '။' (Myanmar sign section, U+104B)
const MYANMAR_SECTION: u16 = 0x104b;

#[derive(Clone, Copy)]
struct Palette {
    keyword: &'static str,
    boolean: &'static str,
    builtin: &'static str,
    string: &'static str,
    number: &'static str,
    comment: &'static str,
    operator: &'static str,
    default: &'static str,
}

const DARK: Palette = Palette {
    keyword: "#c678dd",
    boolean: "#d19a66",
    builtin: "#61afef",
    string: "#98c379",
    number: "#d19a66",
    comment: "#5c6370",
    operator: "#56b6c2",
    default: "#abb2bf",
};

const LIGHT: Palette = Palette {
    keyword: "#a626a4",
    boolean: "#986801",
    builtin: "#4078f2",
    string: "#50a14f",
    number: "#986801",
    comment: "#a0a1a7",
    operator: "#0184bc",
    default: "#383a42",
};

/// Alternation tables as UTF-16 units, in the exact JS declaration order
/// (ties in leftmost-match are broken by this order, so it matters).
struct Tables {
    keywords: Vec<Vec<u16>>,
    booleans: Vec<Vec<u16>>,
    ascii_builtins: Vec<Vec<u16>>,
    myanmar_builtin: Vec<Vec<u16>>,
}

impl Tables {
    fn new() -> Self {
        let t = |list: &[&str]| -> Vec<Vec<u16>> {
            list.iter().map(|s| s.encode_utf16().collect()).collect()
        };
        Tables {
            keywords: t(&[
                "တကယ်လို့", "မဟုတ်ရင်", "လို့ထား", "ဒါယူ", "ခါပတ်", "ထား", "ပတ်", "ဖန်ရှင်",
            ]),
            booleans: t(&["မှန်", "မှား"]),
            ascii_builtins: t(&[
                "len", "first", "last", "rest", "push", "terminal_init", "terminal_end",
                "clear", "terminal_size", "print_at", "print_at_center", "draw_border",
                "flush", "read_key", "poll_key", "sleep", "rand", "now_ms", "input",
                "is_string", "is_int", "is_double", "to_integer", "to_double",
            ]),
            myanmar_builtin: t(&["ရေး"]),
        }
    }
}

/// First index at which `needle` occurs in `hay` at/after `from`.
fn find_units(hay: &[u16], from: usize, needle: &[u16]) -> Option<usize> {
    if needle.is_empty() || from + needle.len() > hay.len() {
        return None;
    }
    (from..=hay.len() - needle.len()).find(|&q| &hay[q..q + needle.len()] == needle)
}

/// Regex `\b` at the START of an alternative match: the alternative's first
/// char is always `\w`, so a boundary exists iff the preceding char is not
/// `\w` (or the match starts at the string start).
fn boundary_start(slice: &[u16], q: usize) -> bool {
    q == 0 || !is_regex_word(slice[q - 1])
}

/// Regex `\b` at the END of a match: last matched char is always `\w`, so a
/// boundary exists iff the following char is not `\w` (or string end).
fn boundary_end(slice: &[u16], e: usize) -> bool {
    e == slice.len() || !is_regex_word(slice[e])
}

/// One styled run of text: raw (unescaped) UTF-8 content + palette color.
/// The IPC payload — slicing happens on token CONTENT on the frontend and
/// HTML escaping happens at render time, so entity-cutting is impossible.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct MerustmarToken {
    pub content: String,
    pub color: String,
}

/// Emulates UNANCHORED `slice.match(/A|B|C/)` for literal alternations:
/// leftmost match wins; equal start positions break ties by declaration
/// order. With `word_boundaries` each candidate occurrence must satisfy the
/// pattern's `\b` anchors (the ASCII builtins). Returns the match START in
/// the slice plus the DECLARATION index of the winning alternative.
fn js_alt_match(slice: &[u16], alts: &[Vec<u16>], word_boundaries: bool) -> Option<(usize, usize)> {
    let mut best: Option<(usize, usize)> = None;
    for (ai, alt) in alts.iter().enumerate() {
        let mut from = 0usize;
        while let Some(q) = find_units(slice, from, alt) {
            if !word_boundaries || (boundary_start(slice, q) && boundary_end(slice, q + alt.len())) {
                // Each alternative contributes only its earliest VALID
                // occurrence to the leftmost comparison.
                match best {
                    Some((bq, _)) if q >= bq => {}
                    _ => best = Some((q, ai)),
                }
                break;
            }
            from = q + 1;
        }
    }
    best
}

/// Port of the frozen JS `tryMatch` (see module docs: the match is
/// unanchored but the boundary checks use `pos` and `pos + len`, NOT the
/// real match position — this asymmetry is preserved on purpose).
/// Returns `(len, alt_index)` of the alternative to emit/advance by.
fn try_match(
    line: &[u16],
    pos: usize,
    alts: &[Vec<u16>],
    word_boundaries: bool,
) -> Option<(usize, usize)> {
    let (_start, ai) = js_alt_match(&line[pos..], alts, word_boundaries)?;
    let len = alts[ai].len();
    if pos > 0 && is_word_char(line[pos - 1]) {
        return None;
    }
    if pos + len < line.len() && is_word_char(line[pos + len]) {
        return None;
    }
    Some((len, ai))
}

/// JS `esc()`: escapes `&`, `<`, `>`, `"` only.
/// HTML compose path — retained for the byte-exact parity tests only
/// (production renders from tokens in the frontend).
#[cfg(test)]
fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Decode UTF-16 units to a Rust string (lossy only for the documented
/// lone-surrogate edge — see module docs).
fn decode(units: &[u16]) -> String {
    String::from_utf16_lossy(units)
}

/// Render one line of tokens to `<span style="color:…">…</span>` HTML
/// (escaping at render time — token content is stored raw).
/// Parity-test-only: the production IPC payload is the raw token list.
#[cfg(test)]
fn render_line_tokens(tokens: &[MerustmarToken]) -> String {
    tokens.iter().fold(String::new(), |mut out, t| {
        out.push_str(&format!(
            "<span style=\"color:{}\">{}</span>",
            t.color,
            esc(t.content.as_str())
        ));
        out
    })
}

/// JS `flush()`: close the pending plain-text token, if any.
fn flush(tokens: &mut Vec<MerustmarToken>, plain: &mut Vec<u16>, color: &'static str) {
    if !plain.is_empty() {
        tokens.push(MerustmarToken {
            content: decode(plain),
            color: color.to_string(),
        });
        plain.clear();
    }
}

/// `^\d+\.\d+` (ASCII digits) anchored at the slice start. Returns match len.
fn match_ascii_float(slice: &[u16]) -> Option<usize> {
    let mut k = 0;
    while k < slice.len() && (0x30..=0x39).contains(&slice[k]) {
        k += 1;
    }
    if k == 0 || k >= slice.len() || slice[k] != DOT {
        return None;
    }
    let mut m = k + 1;
    let start = m;
    while m < slice.len() && (0x30..=0x39).contains(&slice[m]) {
        m += 1;
    }
    if m == start {
        return None;
    }
    Some(m)
}

/// `^\d+` (ASCII digits) anchored at the slice start. Returns match len.
fn match_ascii_int(slice: &[u16]) -> Option<usize> {
    let mut k = 0;
    while k < slice.len() && (0x30..=0x39).contains(&slice[k]) {
        k += 1;
    }
    (k > 0).then_some(k)
}

/// `^[၀-၉]+` (U+1040..=U+1049) anchored at the slice start. No boundary
/// guards in the reference — this intentionally colors digits even when
/// glued to letters (e.g. `x၄` colors the `၄`).
fn match_myanmar_digits(slice: &[u16]) -> Option<usize> {
    let mut k = 0;
    while k < slice.len() && (0x1040..=0x1049).contains(&slice[k]) {
        k += 1;
    }
    (k > 0).then_some(k)
}

fn is_ascii_letter(u: u16) -> bool {
    (0x41..=0x5a).contains(&u) || (0x61..=0x7a).contains(&u)
}

/// Port of the frozen JS `highlightLine` — same branch order, same guards,
/// same quirks. Returns tokens (raw content); rendering is a separate,
/// trivially-verifiable step.
fn highlight_line(line: &[u16], c: &Palette, tables: &Tables) -> Vec<MerustmarToken> {
    let mut tokens: Vec<MerustmarToken> = Vec::new();
    let mut plain: Vec<u16> = Vec::new();
    let mut i = 0usize;

    macro_rules! tok {
        ($color:expr, $units:expr) => {
            tokens.push(MerustmarToken {
                content: decode($units),
                color: $color.to_string(),
            })
        };
    }

    while i < line.len() {
        // -- comments (all three styles consume the rest of the line) --
        if line[i] == SLASH && i + 1 < line.len() && line[i + 1] == SLASH {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.comment, &line[i..]);
            return tokens;
        }
        if line[i] == HASH {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.comment, &line[i..]);
            return tokens;
        }
        if line[i] == SLASH && i + 1 < line.len() && line[i + 1] == STAR {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.comment, &line[i..]);
            return tokens;
        }

        // -- string (unterminated consumes to end of line; `\` escapes) --
        if line[i] == QUOTE {
            flush(&mut tokens, &mut plain, c.default);
            let mut j = i + 1;
            while j < line.len() && line[j] != QUOTE {
                if line[j] == BACKSLASH {
                    j += 1;
                }
                j += 1;
            }
            j = (j + 1).min(line.len());
            tok!(c.string, &line[i..j]);
            i = j;
            continue;
        }

        // -- keywords / booleans / builtins (unanchored tryMatch, see docs) --
        if let Some((len, ai)) = try_match(line, i, &tables.keywords, false) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.keyword, &tables.keywords[ai]);
            i += len;
            continue;
        }
        if let Some((len, ai)) = try_match(line, i, &tables.booleans, false) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.boolean, &tables.booleans[ai]);
            i += len;
            continue;
        }
        if let Some((len, ai)) = try_match(line, i, &tables.ascii_builtins, true) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.builtin, &tables.ascii_builtins[ai]);
            i += len;
            continue;
        }
        if let Some((len, ai)) = try_match(line, i, &tables.myanmar_builtin, false) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.builtin, &tables.myanmar_builtin[ai]);
            i += len;
            continue;
        }

        // -- operators (two-char first, then singles) --
        if i + 1 < line.len() {
            let two = match (line[i], line[i + 1]) {
                (b, b2) if b == '=' as u16 && b2 == '=' as u16 => Some("=="),
                (b, b2) if b == '!' as u16 && b2 == '=' as u16 => Some("!="),
                (b, b2) if b == '<' as u16 && b2 == '=' as u16 => Some("<="),
                (b, b2) if b == '>' as u16 && b2 == '=' as u16 => Some(">="),
                (b, b2) if b == '&' as u16 && b2 == '&' as u16 => Some("&&"),
                (b, b2) if b == '|' as u16 && b2 == '|' as u16 => Some("||"),
                _ => None,
            };
            if let Some(op) = two {
                flush(&mut tokens, &mut plain, c.default);
                tokens.push(MerustmarToken {
                    content: op.to_string(),
                    color: c.operator.to_string(),
                });
                i += 2;
                continue;
            }
        }
        // '<>+-*/%=' single-char operators
        if matches!(line[i], u if [b'<' as u16, b'>' as u16, b'+' as u16, b'-' as u16, b'*' as u16, b'/' as u16, b'%' as u16, b'=' as u16].contains(&u))
        {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.operator, &line[i..i + 1]);
            i += 1;
            continue;
        }

        // -- numbers --
        // `^\d+\.\d+` (guard: previous char not a word char)
        if let Some(len) = match_ascii_float(&line[i..]) {
            if i == 0 || !is_word_char(line[i - 1]) {
                flush(&mut tokens, &mut plain, c.default);
                tok!(c.number, &line[i..i + len]);
                i += len;
                continue;
            }
        }
        // `^\d+` (guards: prev not word char; next not an ASCII letter)
        if let Some(len) = match_ascii_int(&line[i..]) {
            let next_ok = i + len >= line.len() || !is_ascii_letter(line[i + len]);
            if (i == 0 || !is_word_char(line[i - 1])) && next_ok {
                flush(&mut tokens, &mut plain, c.default);
                tok!(c.number, &line[i..i + len]);
                i += len;
                continue;
            }
        }
        // `^[၀-၉]+` (unguarded in the reference)
        if let Some(len) = match_myanmar_digits(&line[i..]) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.number, &line[i..i + len]);
            i += len;
            continue;
        }

        // -- standalone punctuation --
        if line[i] == MYANMAR_SECTION {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.default, &line[i..i + 1]);
            i += 1;
            continue;
        }
        if matches!(line[i], u if [b'{' as u16, b'}' as u16, b'(' as u16, b')' as u16, b',' as u16].contains(&u))
        {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.default, &line[i..i + 1]);
            i += 1;
            continue;
        }

        plain.push(line[i]);
        i += 1;
    }
    flush(&mut tokens, &mut plain, c.default);
    tokens
}

/// Tokenize Merustmar code: one token list per line (`\n`-split). This is
/// the IPC payload — the frontend slices these tokens for highlights and
/// renders them itself.
pub fn merustmar_tokens(code: &str, is_dark: bool) -> Vec<Vec<MerustmarToken>> {
    let c = if is_dark { &DARK } else { &LIGHT };
    let tables = Tables::new();
    code.split('\n')
        .map(|line| {
            let units: Vec<u16> = line.encode_utf16().collect();
            highlight_line(&units, c, &tables)
        })
        .collect()
}

/// Port of the frozen JS `highlightMerustmarCode`:
/// `<span class="line">…</span>` per line, joined by `\n`.
/// Parity-test-only anchor against the frozen JS fixtures; production
/// consumes `merustmar_tokens` and renders client-side.
#[cfg(test)]
pub fn highlight_merustmar_code(code: &str, is_dark: bool) -> String {
    merustmar_tokens(code, is_dark)
        .iter()
        .map(|line| format!("<span class=\"line\">{}</span>", render_line_tokens(line)))
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    /// Byte-exact parity with the FROZEN JS reference implementation.
    /// Fixtures were generated by running `src/lib/merustmar-highlight.ts`
    /// (via esbuild) over a corpus covering every branch and quirk; they
    /// live in `tests/fixtures/merustmar/parity.json`.
    #[test]
    fn parity_with_frozen_js() {
        let raw = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/merustmar/parity.json"
        ));
        let fixtures: Value = serde_json::from_str(raw).expect("fixture JSON parses");
        let fixtures = fixtures.as_array().expect("fixtures array");
        assert!(fixtures.len() >= 20, "corpus must stay comprehensive");
        for f in fixtures {
            let name = f["name"].as_str().unwrap();
            let code = f["code"].as_str().unwrap();
            let dark = f["dark"].as_str().unwrap();
            let light = f["light"].as_str().unwrap();
            assert_eq!(
                highlight_merustmar_code(code, true),
                dark,
                "dark parity failed for fixture {name:?}"
            );
            assert_eq!(
                highlight_merustmar_code(code, false),
                light,
                "light parity failed for fixture {name:?}"
            );
        }
    }

    #[test]
    fn empty_code_is_one_empty_line() {
        assert_eq!(
            highlight_merustmar_code("", true),
            "<span class=\"line\"></span>"
        );
    }

    /// Quirk lock-in: four spaces before the 3-unit keyword `ပတ်` trips the
    /// unanchored-tryMatch behavior — the JS emits the keyword early and then
    /// again at its real position. Reference output, preserved deliberately.
    #[test]
    fn whitespace_run_quirk_is_preserved() {
        assert_eq!(
            highlight_merustmar_code("    ပတ်", true),
            "<span class=\"line\"><span style=\"color:#c678dd\">ပတ်</span>\
             <span style=\"color:#abb2bf\"> </span>\
             <span style=\"color:#c678dd\">ပတ်</span></span>"
        );
        // Three spaces is not enough to trip it (deferred to real position):
        assert_eq!(
            highlight_merustmar_code("   ထား", true),
            "<span class=\"line\"><span style=\"color:#abb2bf\">   </span>\
             <span style=\"color:#c678dd\">ထား</span></span>"
        );
    }

    #[test]
    fn themes_differ_only_in_colors() {
        let out_dark = highlight_merustmar_code("မှန်", true);
        let out_light = highlight_merustmar_code("မှန်", false);
        assert!(out_dark.contains("#d19a66"));
        assert!(out_light.contains("#986801"));
    }
}
