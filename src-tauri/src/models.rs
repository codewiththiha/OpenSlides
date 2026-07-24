//! Shared data models for OpenSlides (Rust ↔ frontend JSON).

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// Slide timing defaults shared by create/import paths.
pub const DEFAULT_SLIDE_DURATION_MS: i64 = 3000;
pub const DEFAULT_SLIDE_TRANSITION_MS: i64 = 750;
pub const DEFAULT_SLIDE_STAGGER: i64 = 5;

/// A highlight is a "sub-slide" effect that focuses on a specific text range
/// within the slide's code, dimming everything else and optionally scaling up
/// the selected text.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    /// 0-based start line
    pub start_line: i64,
    /// 0-based start character within start_line
    pub start_char: i64,
    /// 0-based end line
    pub end_line: i64,
    /// 0-based end character within end_line
    pub end_char: i64,
    /// Dim amount for non-selected text (0-100)
    #[serde(default = "default_dim_amount")]
    pub dim_amount: i64,
    /// Whether to scale up the selected text
    #[serde(default = "default_true")]
    pub size_up_enabled: bool,
    /// Scale-up amount in percent (100 = unchanged, 125 = default pop)
    #[serde(default = "default_size_up_amount")]
    pub size_up_amount: i64,
    /// Whether to use custom transition durations (otherwise defaults)
    #[serde(default)]
    pub use_custom_transition: bool,
    /// Dim animation duration in ms
    #[serde(default = "default_dim_transition")]
    pub dim_transition: i64,
    /// Scale-up animation duration in ms
    #[serde(default = "default_size_up_transition")]
    pub size_up_transition: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    pub id: String,
    pub code: String,
    /// Derived from project settings on read — export / API compatibility only.
    /// The per-slide DB column was dropped in migration v6; never stored again.
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
    /// Highlight effects attached to this slide (sub-slide focus effects).
    #[serde(default)]
    pub highlights: Vec<Highlight>,
    /// Cached, truncated Shiki HTML for the slide-strip thumbnail.
    #[serde(default)]
    pub thumbnail_html: String,
    /// Section/group ID if this slide is part of a slide stack.
    #[serde(default)]
    pub section_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    #[serde(default = "default_show_line_numbers")]
    pub show_line_numbers: bool,
    #[serde(default)]
    pub use_black_code_background: bool,
    #[serde(default = "default_show_highlight_step_indicator")]
    pub show_highlight_step_indicator: bool,
    #[serde(default = "default_font_size")]
    pub font_size: i64,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    #[serde(default = "default_editor_font_size")]
    pub editor_font_size: i64,
    #[serde(default = "default_true")]
    pub use_global_transition: bool,
    #[serde(default = "default_transition")]
    pub global_transition_duration: i64,
    #[serde(default = "default_true")]
    pub use_global_stagger: bool,
    #[serde(default = "default_stagger")]
    pub global_stagger: i64,
    /// Global highlight controls (dim + pop size)
    #[serde(default = "default_true")]
    pub use_global_highlight: bool,
    #[serde(default = "default_global_dim_amount")]
    pub global_dim_amount: i64,
    #[serde(default = "default_global_size_up_amount")]
    pub global_size_up_amount: i64,
    /// "black" | "theme"
    #[serde(default = "default_highlight_dim_color")]
    pub highlight_dim_color: String,
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
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub first_slide_id: String,
    #[serde(default)]
    pub first_slide_code: String,
    #[serde(default)]
    pub first_slide_thumbnail: String,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub group_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSlideSettingsPayload {
    pub duration: Option<i64>,
    pub transition_duration: Option<i64>,
    pub stagger: Option<i64>,
    pub name: Option<String>,
    pub highlights: Option<Vec<Highlight>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSlidePayload {
    pub project_id: String,
    pub code: Option<String>,
    pub name: Option<String>,
}

/// Flat import payload. Export/import files place project settings at the top
/// level rather than nesting them under `settings`, so this serde layer lets
/// the import command reuse the same default functions that create/new DB rows
/// use instead of hand-rolling `unwrap_or(...)` chains.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProjectPayload {
    #[serde(default = "default_import_project_name")]
    pub name: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_show_line_numbers")]
    pub show_line_numbers: bool,
    #[serde(default)]
    pub use_black_code_background: bool,
    #[serde(default = "default_show_highlight_step_indicator")]
    pub show_highlight_step_indicator: bool,
    #[serde(default = "default_font_size")]
    pub font_size: i64,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    #[serde(default = "default_editor_font_size")]
    pub editor_font_size: i64,
    #[serde(default = "default_true")]
    pub use_global_transition: bool,
    #[serde(default = "default_transition")]
    pub global_transition_duration: i64,
    #[serde(default = "default_true")]
    pub use_global_stagger: bool,
    #[serde(default = "default_stagger")]
    pub global_stagger: i64,
    #[serde(default = "default_true")]
    pub use_global_highlight: bool,
    #[serde(default = "default_global_dim_amount")]
    pub global_dim_amount: i64,
    #[serde(default = "default_global_size_up_amount")]
    pub global_size_up_amount: i64,
    #[serde(default = "default_highlight_dim_color")]
    pub highlight_dim_color: String,
    #[serde(default)]
    pub current_slide_id: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default = "default_code_align")]
    pub code_align: String,
    #[serde(default)]
    pub slides: Vec<JsonValue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSlidePayload {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_import_slide_code")]
    pub code: String,
    #[serde(default = "default_slide_duration")]
    pub duration: i64,
    #[serde(default = "default_slide_transition")]
    pub transition_duration: i64,
    #[serde(default = "default_slide_stagger")]
    pub stagger: i64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub section_id: Option<String>,
}

pub(crate) fn default_dim_amount() -> i64 {
    75
}
pub(crate) fn default_true() -> bool {
    true
}
pub(crate) fn default_size_up_amount() -> i64 {
    125
}
pub(crate) fn default_dim_transition() -> i64 {
    500
}
pub(crate) fn default_size_up_transition() -> i64 {
    600
}
pub(crate) fn default_show_line_numbers() -> bool {
    true
}
pub(crate) fn default_show_highlight_step_indicator() -> bool {
    false
}
pub(crate) fn default_font_size() -> i64 {
    16
}
pub(crate) fn default_line_height() -> f64 {
    1.5
}
pub(crate) fn default_editor_font_size() -> i64 {
    14
}
pub(crate) fn default_transition() -> i64 {
    700
}
pub(crate) fn default_stagger() -> i64 {
    3
}
pub(crate) fn default_global_dim_amount() -> i64 {
    80
}
pub(crate) fn default_global_size_up_amount() -> i64 {
    105
}
pub(crate) fn default_highlight_dim_color() -> String {
    "theme".into()
}
pub(crate) fn default_language() -> String {
    "typescript".into()
}
pub(crate) fn default_code_align() -> String {
    "left".into()
}
pub(crate) fn default_theme() -> String {
    "dark-plus".into()
}
pub(crate) fn default_import_project_name() -> String {
    "Imported Presentation".into()
}
pub(crate) fn default_import_slide_code() -> String {
    "// empty".into()
}
pub(crate) fn default_slide_duration() -> i64 {
    DEFAULT_SLIDE_DURATION_MS
}
pub(crate) fn default_slide_transition() -> i64 {
    DEFAULT_SLIDE_TRANSITION_MS
}
pub(crate) fn default_slide_stagger() -> i64 {
    DEFAULT_SLIDE_STAGGER
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            show_line_numbers: default_show_line_numbers(),
            use_black_code_background: false,
            show_highlight_step_indicator: default_show_highlight_step_indicator(),
            font_size: default_font_size(),
            line_height: default_line_height(),
            editor_font_size: default_editor_font_size(),
            use_global_transition: default_true(),
            global_transition_duration: default_transition(),
            use_global_stagger: default_true(),
            global_stagger: default_stagger(),
            use_global_highlight: default_true(),
            global_dim_amount: default_global_dim_amount(),
            global_size_up_amount: default_global_size_up_amount(),
            highlight_dim_color: default_highlight_dim_color(),
            current_slide_id: None,
            language: default_language(),
            code_align: default_code_align(),
        }
    }
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
    let mut value = serde_json::to_value(existing)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
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
