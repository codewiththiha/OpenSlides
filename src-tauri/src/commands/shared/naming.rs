//! Naming helpers and default constants used by command modules.

pub const DEFAULT_CODE: &str = r#"// Every presentation starts with one clear idea.
const opening = "Make code memorable";

console.log(opening);"#;

pub const DEFAULT_LANGUAGE: &str = "typescript";

const SUPPORTED_LANGUAGES: &[&str] = &[
    "typescript", "javascript", "tsx", "jsx", "python", "java", "go", "rust", "php",
    "css", "html", "json", "yaml", "sql", "bash", "markdown", "merustmar",
];

pub const SUPPORTED_THEMES: &[&str] = &[
    "dark-plus", "dracula", "github-dark", "github-light", "nord", "poimandres",
    "min-light", "min-dark", "monokai", "solarized-dark", "solarized-light", "andromeeda",
    "aurora-x", "catppuccin-latte", "catppuccin-mocha", "night-owl",
];

pub fn is_supported_language(input: &str) -> bool {
    SUPPORTED_LANGUAGES.contains(&input)
}

pub fn is_supported_theme(input: &str) -> bool {
    SUPPORTED_THEMES.contains(&input)
}

/// Import data from older/unknown files safely falls back to the default.
pub fn normalize_language(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed == "dynamic" || !is_supported_language(trimmed) {
        DEFAULT_LANGUAGE.to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn normalize_code_align(input: &str) -> String {
    match input {
        "center" => "center".to_string(),
        _ => "left".to_string(),
    }
}

pub fn default_slide_name(order_index: i64) -> String {
    format!("Slide {}", order_index + 1)
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn sanitize_filename(name: &str) -> String {
    const MAX_FILENAME_STEM_CHARS: usize = 80;

    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim();
    let stem = if trimmed.is_empty() {
        "openslides-export".to_string()
    } else {
        trimmed.replace(' ', "-")
    };

    stem.chars().take(MAX_FILENAME_STEM_CHARS).collect()
}
