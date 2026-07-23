/**
 * merustmar-language.ts
 * Shiki LanguageRegistration for the Merustmar programming language.
 *
 * Key fixes:
 * - Added `displayName` and `aliases` (Shiki v1 requires these for proper registration)
 * - No lookbehind/lookahead with Unicode ranges (causes Oniguruma WASM to fail)
 * - Longer keywords listed first in alternation to prevent partial matches
 * - Added `balancedBracketSelectors` for `{}` bracket matching
 */
import type { LanguageRegistration } from "shiki";

export const merustmarLanguage: LanguageRegistration = {
  name: "merustmar",
  displayName: "Merustmar",
  scopeName: "source.merustmar",
  aliases: ["mrm"],
  patterns: [
    { include: "#comments" },
    { include: "#strings" },
    { include: "#keywords" },
    { include: "#booleans" },
    { include: "#builtins" },
    { include: "#numbers" },
    { include: "#operators" },
    { include: "#punctuation" },
  ],
  repository: {
    comments: {
      patterns: [
        {
          name: "comment.line.double-slash.merustmar",
          match: "//.*$",
        },
        {
          name: "comment.line.hash.merustmar",
          match: "#.*$",
        },
      ],
    },
    strings: {
      patterns: [
        {
          name: "string.quoted.double.merustmar",
          begin: '"',
          end: '"',
          patterns: [
            {
              name: "constant.character.escape.merustmar",
              match: "\\\\.",
            },
          ],
        },
      ],
    },
    keywords: {
      patterns: [
        {
          name: "keyword.control.merustmar",
          match: "လို့ထား|ခါပတ်|တကယ်လို့|မဟုတ်ရင်|ဒါယူ|ထား|ပတ်|ဖန်ရှင်",
        },
      ],
    },
    booleans: {
      patterns: [
        {
          name: "constant.language.boolean.merustmar",
          match: "မှန်|မှား",
        },
      ],
    },
    builtins: {
      patterns: [
        {
          name: "support.function.merustmar",
          match:
            "\\b(len|first|last|rest|push|terminal_init|terminal_end|clear|terminal_size|print_at|print_at_center|draw_border|flush|read_key|poll_key|sleep|rand|now_ms|input|is_string|is_int|is_double|to_integer|to_double)\\b|ရေး",
        },
      ],
    },
    numbers: {
      patterns: [
        {
          name: "constant.numeric.float.merustmar",
          match: "\\d+\\.\\d+",
        },
        {
          name: "constant.numeric.integer.merustmar",
          match: "\\d+",
        },
        {
          name: "constant.numeric.myanmar.merustmar",
          match: "[၀-၉]+",
        },
      ],
    },
    operators: {
      patterns: [
        {
          name: "keyword.operator.comparison.merustmar",
          match: "==|!=|<=|>=",
        },
        {
          name: "keyword.operator.logical.merustmar",
          match: "&&|\\|\\|",
        },
        {
          name: "keyword.operator.arithmetic.merustmar",
          match: "[+\\-*/%]",
        },
        {
          name: "keyword.operator.comparison.merustmar",
          match: "[<>]",
        },
        {
          name: "keyword.operator.assignment.merustmar",
          match: "=",
        },
      ],
    },
    punctuation: {
      patterns: [
        {
          name: "punctuation.terminator.merustmar",
          match: "။",
        },
        {
          name: "punctuation.section.block.merustmar",
          match: "[{}]",
        },
        {
          name: "punctuation.section.parens.merustmar",
          match: "[()]",
        },
        {
          name: "punctuation.separator.comma.merustmar",
          match: ",",
        },
      ],
    },
  },
  balancedBracketSelectors: ["punctuation.section.block.merustmar"],
  unbalancedBracketSelectors: [],
};
