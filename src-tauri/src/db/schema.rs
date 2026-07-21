//! Base database schema.

pub const BASE_SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'dark-plus',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    group_id TEXT DEFAULT NULL,
    group_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS slides (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    code TEXT NOT NULL,
    transition_duration INTEGER NOT NULL DEFAULT 750,
    stagger INTEGER NOT NULL DEFAULT 5,
    duration INTEGER NOT NULL DEFAULT 3000,
    name TEXT NOT NULL DEFAULT '',
    highlights TEXT NOT NULL DEFAULT '[]',
    thumbnail_html TEXT NOT NULL DEFAULT '',
    section_id TEXT DEFAULT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slides_project ON slides(project_id, order_index);
"#;
