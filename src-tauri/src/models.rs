//! Shared data models for OpenSlides (Rust ↔ frontend JSON).

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    pub id: String,
    pub code: String,
    /// Mirrored from project settings for export / API compatibility.
    #[serde(default = "default_language")]
    pub language: String,
    pub duration: i64,
    pub transition_duration: i64,
    pub stagger: i64,
    #[serde(default)]
    pub order_index: i64,
    /// User-facing slide title (defaults to "Slide N" on the frontend if empty).
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    #[serde(default = "default_show_line_numbers")]
    pub show_line_numbers: bool,
    #[serde(default = "default_font_size")]
    pub font_size: i64,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    #[serde(default = "default_editor_font_size")]
    pub editor_font_size: i64,
    #[serde(default)]
    pub use_global_transition: bool,
    #[serde(default = "default_transition")]
    pub global_transition_duration: i64,
    #[serde(default)]
    pub use_global_stagger: bool,
    #[serde(default = "default_stagger")]
    pub global_stagger: i64,
    #[serde(default)]
    pub current_slide_id: Option<String>,
    /// Project-wide language (source of truth; no longer per-slide).
    #[serde(default = "default_language")]
    pub language: String,
    /// How the code block is positioned on the slide stage.
    /// "left" | "center" — centers the *block*, not text-align of lines.
    #[serde(default = "default_code_align")]
    pub code_align: String,
}

fn default_show_line_numbers() -> bool {
    true
}
fn default_font_size() -> i64 {
    16
}
fn default_line_height() -> f64 {
    1.5
}
fn default_editor_font_size() -> i64 {
    14
}
fn default_transition() -> i64 {
    750
}
fn default_stagger() -> i64 {
    5
}
fn default_language() -> String {
    "typescript".into()
}
fn default_code_align() -> String {
    "left".into()
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            show_line_numbers: true,
            font_size: 16,
            line_height: 1.5,
            editor_font_size: 14,
            use_global_transition: false,
            global_transition_duration: 750,
            use_global_stagger: false,
            global_stagger: 5,
            current_slide_id: None,
            language: default_language(),
            code_align: default_code_align(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub theme: String,
    pub settings: ProjectSettings,
    pub slides: Vec<Slide>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Lightweight list row (dashboard).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub theme: String,
    pub slide_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSlideSettingsPayload {
    pub duration: Option<i64>,
    pub transition_duration: Option<i64>,
    pub stagger: Option<i64>,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSlidePayload {
    pub project_id: String,
    pub code: Option<String>,
    pub name: Option<String>,
}

/// Parse settings JSON blob from DB into typed struct.
pub fn parse_settings(raw: &str) -> ProjectSettings {
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn settings_to_json(settings: &ProjectSettings) -> Result<String, String> {
    serde_json::to_string(settings).map_err(|e| e.to_string())
}

/// Merge a partial JSON object into existing settings.
/// Returns Err on malformed patches so the frontend can toast an error
/// instead of silently no-op'ing.
pub fn merge_settings(
    existing: &ProjectSettings,
    patch: &JsonValue,
) -> Result<ProjectSettings, String> {
    let mut value =
        serde_json::to_value(existing).map_err(|e| format!("Failed to serialize settings: {e}"))?;
    if let (Some(obj), Some(patch_obj)) = (value.as_object_mut(), patch.as_object()) {
        for (k, v) in patch_obj {
            // theme is a project column, not a settings field — skip here
            if k == "theme" {
                continue;
            }
            obj.insert(k.clone(), v.clone());
        }
    }
    serde_json::from_value(value).map_err(|e| format!("Invalid settings payload: {e}"))
}
