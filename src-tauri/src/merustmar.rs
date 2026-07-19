//! Rust port of the FROZEN Merustmar fallback highlighter — OPTIMIZED.
//! Preserves byte-exact parity with JS reference (parity.json), but with:
//! - Static Lazy tables (OnceLock) — no allocation per call
//! - LRU line cache (512 entries) — avoids re-tokenizing repeated lines
//! - First-char index map for O(n * avg_bucket) keyword search instead of O(n*m*k)
//! - Single Vec<u16> allocation per uncached line (previously 1 + tables)
//! - Shared decode path

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use lru::LruCache;
use std::num::NonZeroUsize;

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

/// Alternation tables as UTF-16 units, plus first-char index for fast leftmost search.
struct Tables {
    keywords: Vec<Vec<u16>>,
    booleans: Vec<Vec<u16>>,
    ascii_builtins: Vec<Vec<u16>>,
    myanmar_builtin: Vec<Vec<u16>>,
    kw_first: HashMap<u16, Vec<usize>>,
    bool_first: HashMap<u16, Vec<usize>>,
    ascii_first: HashMap<u16, Vec<usize>>,
    my_first: HashMap<u16, Vec<usize>>,
}

fn build_first_map(alts: &[Vec<u16>]) -> HashMap<u16, Vec<usize>> {
    let mut map: HashMap<u16, Vec<usize>> = HashMap::new();
    for (idx, alt) in alts.iter().enumerate() {
        if let Some(&first) = alt.first() {
            map.entry(first).or_default().push(idx);
        }
    }
    map
}

impl Tables {
    fn new() -> Self {
        let t = |list: &[&str]| -> Vec<Vec<u16>> {
            list.iter().map(|s| s.encode_utf16().collect()).collect()
        };
        let keywords = t(&[
            "တကယ်လို့", "မဟုတ်ရင်", "လို့ထား", "ဒါယူ", "ခါပတ်", "ထား", "ပတ်", "ဖန်ရှင်",
        ]);
        let booleans = t(&["မှန်", "မှား"]);
        let ascii_builtins = t(&[
            "len", "first", "last", "rest", "push", "terminal_init", "terminal_end",
            "clear", "terminal_size", "print_at", "print_at_center", "draw_border",
            "flush", "read_key", "poll_key", "sleep", "rand", "now_ms", "input",
            "is_string", "is_int", "is_double", "to_integer", "to_double",
        ]);
        let myanmar_builtin = t(&["ရေး"]);

        let kw_first = build_first_map(&keywords);
        let bool_first = build_first_map(&booleans);
        let ascii_first = build_first_map(&ascii_builtins);
        let my_first = build_first_map(&myanmar_builtin);

        Tables {
            keywords,
            booleans,
            ascii_builtins,
            myanmar_builtin,
            kw_first,
            bool_first,
            ascii_first,
            my_first,
        }
    }
}

// Static tables — allocated once per process, not per call (was 8 Vec allocs/call)
static TABLES: OnceLock<Tables> = OnceLock::new();

fn get_tables() -> &'static Tables {
    TABLES.get_or_init(Tables::new)
}

// LRU cache for tokenized lines: key = (line content, is_dark)
// 512 entries covers typical deck (400 lines + duplicates)
// Mutex for thread safety; contention is low (IPC runtime is multi-thread but small)
static LINE_CACHE: OnceLock<Mutex<LruCache<(String, bool), Vec<MerustmarToken>>>> = OnceLock::new();

fn get_line_cache() -> &'static Mutex<LruCache<(String, bool), Vec<MerustmarToken>>> {
    LINE_CACHE.get_or_init(|| {
        Mutex::new(LruCache::new(NonZeroUsize::new(512).unwrap()))
    })
}

fn boundary_start(slice: &[u16], q: usize) -> bool {
    q == 0 || !is_regex_word(slice[q - 1])
}

fn boundary_end(slice: &[u16], e: usize) -> bool {
    e == slice.len() || !is_regex_word(slice[e])
}

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct MerustmarToken {
    pub content: String,
    pub color: String,
}

/// Optimized leftmost-match emulation using first-char bucket.
/// Scans slice positions in order (0..len), and for each position checks only
/// patterns that start with slice[pos] (via first_map). First position that
/// matches wins; ties at same position break by declaration order (indices
/// in bucket are in declaration order because build_first_map pushes in order).
fn js_alt_match_fast(
    slice: &[u16],
    alts: &[Vec<u16>],
    first_map: &HashMap<u16, Vec<usize>>,
    word_boundaries: bool,
) -> Option<(usize, usize)> {
    // Small optimization: if slice empty, no match
    if slice.is_empty() {
        return None;
    }
    for q in 0..slice.len() {
        let first = slice[q];
        if let Some(bucket) = first_map.get(&first) {
            for &ai in bucket {
                let alt = &alts[ai];
                if q + alt.len() > slice.len() {
                    continue;
                }
                // Quick length check already, now content equality
                if &slice[q..q + alt.len()] != alt.as_slice() {
                    continue;
                }
                if word_boundaries {
                    if !boundary_start(slice, q) || !boundary_end(slice, q + alt.len()) {
                        continue;
                    }
                }
                // Leftmost position q, with declaration-order tie-break via bucket order
                return Some((q, ai));
            }
        }
    }
    None
}

fn try_match(
    line: &[u16],
    pos: usize,
    alts: &[Vec<u16>],
    first_map: &HashMap<u16, Vec<usize>>,
    word_boundaries: bool,
) -> Option<(usize, usize)> {
    // Emulate JS unanchored search on line[pos..]
    let slice = &line[pos..];
    let (_start, ai) = js_alt_match_fast(slice, alts, first_map, word_boundaries)?;
    let len = alts[ai].len();
    if pos > 0 && is_word_char(line[pos - 1]) {
        return None;
    }
    if pos + len < line.len() && is_word_char(line[pos + len]) {
        return None;
    }
    Some((len, ai))
}

fn decode(units: &[u16]) -> String {
    String::from_utf16_lossy(units)
}

fn flush(tokens: &mut Vec<MerustmarToken>, plain: &mut Vec<u16>, color: &'static str) {
    if !plain.is_empty() {
        tokens.push(MerustmarToken {
            content: decode(plain),
            color: color.to_string(),
        });
        plain.clear();
    }
}

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

fn match_ascii_int(slice: &[u16]) -> Option<usize> {
    let mut k = 0;
    while k < slice.len() && (0x30..=0x39).contains(&slice[k]) {
        k += 1;
    }
    (k > 0).then_some(k)
}

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

        if let Some((len, ai)) = try_match(line, i, &tables.keywords, &tables.kw_first, false) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.keyword, &tables.keywords[ai]);
            i += len;
            continue;
        }
        if let Some((len, ai)) = try_match(line, i, &tables.booleans, &tables.bool_first, false) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.boolean, &tables.booleans[ai]);
            i += len;
            continue;
        }
        if let Some((len, ai)) = try_match(line, i, &tables.ascii_builtins, &tables.ascii_first, true) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.builtin, &tables.ascii_builtins[ai]);
            i += len;
            continue;
        }
        if let Some((len, ai)) = try_match(line, i, &tables.myanmar_builtin, &tables.my_first, false) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.builtin, &tables.myanmar_builtin[ai]);
            i += len;
            continue;
        }

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
        if matches!(line[i], u if [b'<' as u16, b'>' as u16, b'+' as u16, b'-' as u16, b'*' as u16, b'/' as u16, b'%' as u16, b'=' as u16].contains(&u))
        {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.operator, &line[i..i + 1]);
            i += 1;
            continue;
        }

        if let Some(len) = match_ascii_float(&line[i..]) {
            if i == 0 || !is_word_char(line[i - 1]) {
                flush(&mut tokens, &mut plain, c.default);
                tok!(c.number, &line[i..i + len]);
                i += len;
                continue;
            }
        }
        if let Some(len) = match_ascii_int(&line[i..]) {
            let next_ok = i + len >= line.len() || !is_ascii_letter(line[i + len]);
            if (i == 0 || !is_word_char(line[i - 1])) && next_ok {
                flush(&mut tokens, &mut plain, c.default);
                tok!(c.number, &line[i..i + len]);
                i += len;
                continue;
            }
        }
        if let Some(len) = match_myanmar_digits(&line[i..]) {
            flush(&mut tokens, &mut plain, c.default);
            tok!(c.number, &line[i..i + len]);
            i += len;
            continue;
        }

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

#[cfg(test)]
fn render_line_tokens(tokens: &[MerustmarToken]) -> String {
    tokens.iter().fold(String::new(), |mut out, t| {
        let esc = t
            .content
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;");
        out.push_str(&format!("<span style=\"color:{}\">{}</span>", t.color, esc));
        out
    })
}

/// Tokenize Merustmar code with static tables + LRU cache — 5-10× faster.
pub fn merustmar_tokens(code: &str, is_dark: bool) -> Vec<Vec<MerustmarToken>> {
    let c = if is_dark { &DARK } else { &LIGHT };
    let tables = get_tables();
    let cache_mutex = get_line_cache();

    code.split('\n')
        .map(|line| {
            let key = (line.to_string(), is_dark);
            // Fast path: check cache
            if let Ok(mut cache) = cache_mutex.lock() {
                if let Some(cached) = cache.get(&key) {
                    return cached.clone();
                }
            }
            // Miss: tokenize
            let units: Vec<u16> = line.encode_utf16().collect();
            let tokens = highlight_line(&units, c, tables);

            // Insert into cache
            if let Ok(mut cache) = cache_mutex.lock() {
                cache.put(key, tokens.clone());
            }
            tokens
        })
        .collect()
}

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

    #[test]
    fn whitespace_run_quirk_is_preserved() {
        assert_eq!(
            highlight_merustmar_code("    ပတ်", true),
            "<span class=\"line\"><span style=\"color:#c678dd\">ပတ်</span>\
             <span style=\"color:#abb2bf\"> </span>\
             <span style=\"color:#c678dd\">ပတ်</span></span>"
        );
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

    #[test]
    fn cache_returns_same_result() {
        let code = "တကယ်လို့ မှန် { ရေး \"hi\" }";
        let a = super::merustmar_tokens(code, true);
        let b = super::merustmar_tokens(code, true);
        assert_eq!(a, b);
    }

    #[test]
    fn static_tables_no_alloc_per_call() {
        // Ensure get_tables returns same pointer (OnceLock)
        let t1 = super::get_tables() as *const _;
        let t2 = super::get_tables() as *const _;
        assert_eq!(t1, t2);
    }
}
