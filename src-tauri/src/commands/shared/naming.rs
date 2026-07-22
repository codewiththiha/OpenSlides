//! Naming helpers and default constants used by command modules.

pub const DEFAULT_CODE: &str = r#"// Every presentation starts with one clear idea.
const opening = "Make code memorable";

console.log(opening);"#;

pub const DEFAULT_LANGUAGE: &str = "typescript";

pub fn normalize_language(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed == "dynamic" {
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
    if trimmed.is_empty() {
        "openslides-export".into()
    } else {
        trimmed.replace(' ', "-")
    }
}
