//! Naming helpers and default constants used by command modules.

use serde::Serialize;

pub const DEFAULT_CODE: &str = r#"// Every presentation starts with one clear idea.
const opening = "Make code memorable";

console.log(opening);"#;

pub const DEFAULT_LANGUAGE: &str = "typescript";
pub const DEFAULT_THEME: &str = "dark-plus";

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedLanguageOption {
    pub value: &'static str,
    pub label: &'static str,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedThemeOption {
    pub value: &'static str,
    pub label: &'static str,
    pub background: &'static str,
    pub light: bool,
}

const SUPPORTED_LANGUAGES: &[SupportedLanguageOption] = &[
    SupportedLanguageOption { value: "typescript", label: "TypeScript" },
    SupportedLanguageOption { value: "javascript", label: "JavaScript" },
    SupportedLanguageOption { value: "tsx", label: "React (TSX)" },
    SupportedLanguageOption { value: "jsx", label: "React (JSX)" },
    SupportedLanguageOption { value: "python", label: "Python" },
    SupportedLanguageOption { value: "java", label: "Java" },
    SupportedLanguageOption { value: "go", label: "Go" },
    SupportedLanguageOption { value: "rust", label: "Rust" },
    SupportedLanguageOption { value: "php", label: "PHP" },
    SupportedLanguageOption { value: "groovy", label: "Groovy" },
    SupportedLanguageOption { value: "css", label: "CSS" },
    SupportedLanguageOption { value: "html", label: "HTML" },
    SupportedLanguageOption { value: "json", label: "JSON" },
    SupportedLanguageOption { value: "yaml", label: "YAML" },
    SupportedLanguageOption { value: "sql", label: "SQL" },
    SupportedLanguageOption { value: "bash", label: "Bash/Shell" },
    SupportedLanguageOption { value: "markdown", label: "Markdown" },
    SupportedLanguageOption { value: "merustmar", label: "Merustmar" },
];

pub const SUPPORTED_THEMES: &[SupportedThemeOption] = &[
    SupportedThemeOption {
        value: "dark-plus",
        label: "Dark+",
        background: "#1e1e1e",
        light: false,
    },
    SupportedThemeOption {
        value: "dracula",
        label: "Dracula",
        background: "#282a36",
        light: false,
    },
    SupportedThemeOption {
        value: "github-dark",
        label: "GitHub Dark",
        background: "#24292e",
        light: false,
    },
    SupportedThemeOption {
        value: "github-light",
        label: "GitHub Light",
        background: "#ffffff",
        light: true,
    },
    SupportedThemeOption {
        value: "nord",
        label: "Nord",
        background: "#2e3440",
        light: false,
    },
    SupportedThemeOption {
        value: "poimandres",
        label: "Poimandres",
        background: "#1b1e28",
        light: false,
    },
    SupportedThemeOption {
        value: "min-dark",
        label: "Min Dark",
        background: "#1f1f1f",
        light: false,
    },
    SupportedThemeOption {
        value: "min-light",
        label: "Min Light",
        background: "#ffffff",
        light: true,
    },
    SupportedThemeOption {
        value: "monokai",
        label: "Monokai",
        background: "#272822",
        light: false,
    },
    SupportedThemeOption {
        value: "solarized-dark",
        label: "Solarized Dark",
        background: "#002b36",
        light: false,
    },
    SupportedThemeOption {
        value: "solarized-light",
        label: "Solarized Light",
        background: "#fdf6e3",
        light: true,
    },
    SupportedThemeOption {
        value: "andromeeda",
        label: "Andromeeda",
        background: "#23262e",
        light: false,
    },
    SupportedThemeOption {
        value: "aurora-x",
        label: "Aurora X",
        background: "#07090f",
        light: false,
    },
    SupportedThemeOption {
        value: "catppuccin-latte",
        label: "Catppuccin Latte",
        background: "#eff1f5",
        light: true,
    },
    SupportedThemeOption {
        value: "catppuccin-mocha",
        label: "Catppuccin Mocha",
        background: "#1e1e2e",
        light: false,
    },
    SupportedThemeOption {
        value: "night-owl",
        label: "Night Owl",
        background: "#011627",
        light: false,
    },
];

pub fn is_supported_language(input: &str) -> bool {
    SUPPORTED_LANGUAGES.iter().any(|language| language.value == input)
}

pub fn is_supported_theme(input: &str) -> bool {
    SUPPORTED_THEMES.iter().any(|theme| theme.value == input)
}

pub fn supported_languages() -> Vec<SupportedLanguageOption> {
    SUPPORTED_LANGUAGES.to_vec()
}

pub fn supported_themes() -> Vec<SupportedThemeOption> {
    SUPPORTED_THEMES.to_vec()
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
