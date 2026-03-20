import type { ThemeRegistrationRaw } from "shiki";

/**
 * Shiki theme derived from the Hectoday Light Zed theme.
 * https://github.com/hectoday/zed-theme
 */
export const hectodayLight: ThemeRegistrationRaw = {
  name: "hectoday-light",
  type: "light",
  colors: {
    "editor.background": "#fafafa",
    "editor.foreground": "#242529",
    "editor.lineHighlightBackground": "#ebebecbf",
    "editorLineNumber.foreground": "#b4b4bb",
    "editorLineNumber.activeForeground": "#44454b",
  },
  settings: [
    {
      settings: {
        foreground: "#242529",
        background: "#fafafa",
      },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: {
        foreground: "#3A3A3A",
        background: "#FFF1B8",
      },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.expression",
        "storage",
        "storage.type",
      ],
      settings: {
        foreground: "#273A72",
      },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: {
        foreground: "#FE3702",
        background: "#FE370210",
      },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: {
        foreground: "#1E9F73",
      },
    },
    {
      scope: [
        "string.escape",
        "string.regexp",
        "constant.other.character-class.regexp",
        "constant.character.escape",
      ],
      settings: {
        foreground: "#4FAF8B",
      },
    },
    {
      scope: ["entity.name.type", "support.type", "support.class", "entity.other.inherited-class"],
      settings: {
        foreground: "#5B3FA6",
      },
    },
    {
      scope: ["variable", "variable.other.readwrite"],
      settings: {
        foreground: "#0B0B0B",
      },
    },
    {
      scope: [
        "variable.other.property",
        "variable.other.object.property",
        "support.variable.property",
        "meta.object-literal.key",
      ],
      settings: {
        foreground: "#2B2B2B",
      },
    },
    {
      scope: [
        "punctuation.bracket",
        "punctuation.definition.block",
        "punctuation.definition.parameters",
        "punctuation.definition.array",
        "meta.brace",
      ],
      settings: {
        foreground: "#6A6A6A",
      },
    },
    {
      scope: [
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.delimiter",
        "meta.delimiter",
      ],
      settings: {
        foreground: "#6A6A6A",
      },
    },
    {
      scope: ["entity.name.tag", "support.class.component"],
      settings: {
        foreground: "#1F1F1F",
      },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.other"],
      settings: {
        foreground: "#3A3A3A",
      },
    },
    {
      scope: ["keyword.operator", "punctuation.accessor"],
      settings: {
        foreground: "#3A3A3A",
      },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: {
        foreground: "#3A3A3A",
      },
    },
  ],
};
