export interface LanguageOption {
  value: string;
  label: string;
}

/**
 * Frontend fallback list for boot / browser contexts. In Tauri, the live
 * supported-language list is fetched from the backend and cached at runtime.
 */
export const FALLBACK_SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "React (TSX)" },
  { value: "jsx", label: "React (JSX)" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "groovy", label: "Groovy" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash/Shell" },
  { value: "markdown", label: "Markdown" },
  { value: "merustmar", label: "Merustmar" },
] as const;
