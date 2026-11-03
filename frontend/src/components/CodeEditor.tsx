import { useEffect, useRef, type CSSProperties } from "react";
import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
  type DecorationSet,
} from "@codemirror/view";
import {
  addCursorAbove,
  addCursorBelow,
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
  selectNextOccurrence,
} from "@codemirror/search";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** "python" enables syntax colors and Python indentation after ":". */
  language?: "python" | "text";
  readOnly?: boolean;
  /** Line to highlight as the current execution step (1-based). */
  activeLine?: number | null;
  /**
   * Where a run failed: a 1-based line, optionally narrowed to the failing
   * expression by 0-based columns. Shown in red.
   */
  errorRange?: {
    line: number;
    startCol?: number | null;
    endCol?: number | null;
  } | null;
  placeholder?: string;
  fontSize: number;
  onZoom?: (delta: -1 | 0 | 1) => void;
  /** Ctrl/Cmd+Enter. */
  onRun?: () => void;
  /** Ctrl/Cmd+S. */
  onSave?: () => void;
  ariaLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Line highlights for the execution step and the failing line.        */
/* ------------------------------------------------------------------ */

interface LineMarks {
  active: number | null;
  error: {
    line: number;
    startCol: number | null;
    endCol: number | null;
  } | null;
}

const setLineMarks = StateEffect.define<LineMarks>();
const activeLineDeco = Decoration.line({ class: "cm-run-active-line" });
const errorLineDeco = Decoration.line({ class: "cm-run-error-line" });
const errorSpanDeco = Decoration.mark({ class: "cm-run-error-span" });

function buildMarks(state: EditorState, marks: LineMarks): DecorationSet {
  const ranges = [];
  const lineCount = state.doc.lines;
  const validLine = (n: number | null | undefined): n is number =>
    !!n && n >= 1 && n <= lineCount;

  if (validLine(marks.active)) {
    ranges.push(activeLineDeco.range(state.doc.line(marks.active).from));
  }
  if (marks.error && validLine(marks.error.line)) {
    const line = state.doc.line(marks.error.line);
    ranges.push(errorLineDeco.range(line.from));
    // Narrow the red to the failing expression when columns are known.
    const { startCol, endCol } = marks.error;
    if (startCol != null && endCol != null && endCol > startCol) {
      const from = line.from + Math.min(startCol, line.length);
      const to = line.from + Math.min(endCol, line.length);
      if (to > from) ranges.push(errorSpanDeco.range(from, to));
    }
  }
  return Decoration.set(ranges, true);
}

const lineMarksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setLineMarks)) return buildMarks(tr.state, effect.value);
    }
    return value.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

/* ------------------------------------------------------------------ */
/* Theme: dark editor surface, JetBrains Mono / Fira Code, ligatures.  */
/* ------------------------------------------------------------------ */

const FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace";

const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#0b1120",
      color: "#e2e8f0",
    },
    ".cm-scroller": {
      fontFamily: FONT_FAMILY,
      fontSize: "var(--editor-font-size, 14px)",
      lineHeight: "1.65",
      // Programming ligatures (e.g. "=>", "!=", "<=") where the font has them.
      fontVariantLigatures: "contextual",
      fontFeatureSettings: '"calt" 1, "liga" 1',
      WebkitFontSmoothing: "antialiased",
      textRendering: "optimizeLegibility",
    },
    ".cm-content": { caretColor: "#a5b4fc", padding: "12px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#a5b4fc" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(99, 102, 241, 0.35) !important",
    },
    ".cm-gutters": {
      backgroundColor: "#0b1120",
      color: "#475569",
      border: "none",
      paddingLeft: "6px",
    },
    ".cm-activeLine": { backgroundColor: "rgba(148, 163, 184, 0.06)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#cbd5e1" },
    ".cm-run-active-line": {
      backgroundColor: "rgba(251, 191, 36, 0.16)",
      boxShadow: "inset 3px 0 0 #fbbf24",
    },
    ".cm-run-error-line": {
      backgroundColor: "rgba(244, 63, 94, 0.10)",
      boxShadow: "inset 3px 0 0 #f43f5e",
    },
    ".cm-run-error-span": {
      backgroundColor: "rgba(244, 63, 94, 0.35)",
      borderRadius: "3px",
      boxShadow: "0 1px 0 #fb7185",
    },
    ".cm-placeholder": { color: "#64748b", fontStyle: "italic" },
    ".cm-matchingBracket": { backgroundColor: "rgba(99, 102, 241, 0.3)", color: "inherit" },
    ".cm-selectionMatch": { backgroundColor: "rgba(148, 163, 184, 0.2)" },
    ".cm-searchMatch": { backgroundColor: "rgba(250, 204, 21, 0.25)", outline: "none" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(250, 204, 21, 0.5)" },
    ".cm-panels": { backgroundColor: "#111827", color: "#e2e8f0", borderColor: "#1f2937" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid #1f2937" },
    ".cm-textfield": {
      backgroundColor: "#0b1120",
      border: "1px solid #334155",
      borderRadius: "6px",
      color: "#e2e8f0",
    },
    ".cm-button": {
      backgroundImage: "none",
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "6px",
      color: "#e2e8f0",
    },
  },
  { dark: true },
);

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "#c4b5fd" },
  { tag: [t.string, t.special(t.string)], color: "#86efac" },
  { tag: [t.number, t.bool, t.atom, t.null], color: "#fdba74" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#64748b", fontStyle: "italic" },
  { tag: [t.operator, t.operatorKeyword, t.punctuation], color: "#94a3b8" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#93c5fd" },
  { tag: [t.typeName, t.className], color: "#67e8f9" },
  { tag: [t.propertyName], color: "#7dd3fc" },
  { tag: t.invalid, color: "#f43f5e" },
]);

/* ------------------------------------------------------------------ */
/* Keyboard handling.                                                  */
/* Returning true from a keymap command tells CodeMirror the key was   */
/* handled, which calls preventDefault so the browser's own shortcut   */
/* (Ctrl+D bookmark, Ctrl+S save page) does not also fire.             */
/* Ctrl+W/Ctrl+T/Cmd+N are reserved by browsers and cannot be blocked  */
/* by a web page; they are swallowed here only when the editor has     */
/* focus and the browser passes them through.                          */
/* ------------------------------------------------------------------ */

function buildKeymap(ref: { current: CodeEditorProps }): Extension {
  const zoom = (delta: -1 | 0 | 1) => () => {
    ref.current.onZoom?.(delta);
    return true;
  };
  return keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        if (!ref.current.onRun) return false;
        ref.current.onRun();
        return true;
      },
    },
    {
      key: "Mod-s",
      run: () => {
        if (!ref.current.onSave) return false;
        ref.current.onSave();
        return true;
      },
    },
    { key: "Mod-d", run: selectNextOccurrence },
    { key: "Mod-w", run: () => true },
    { key: "Mod-=", run: zoom(1) },
    { key: "Mod-+", run: zoom(1) },
    { key: "Mod--", run: zoom(-1) },
    { key: "Mod-0", run: zoom(0) },
    { key: "Mod-Alt-ArrowUp", run: addCursorAbove },
    { key: "Mod-Alt-ArrowDown", run: addCursorBelow },
    // Tab indents the selection (or inserts 4 spaces); Shift+Tab outdents.
    indentWithTab,
    ...searchKeymap,
    ...historyKeymap,
    ...defaultKeymap,
  ]);
}

function buildExtensions(ref: { current: CodeEditorProps }): Extension[] {
  const { language = "python", readOnly = false, placeholder: hint } = ref.current;
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    bracketMatching(),
    highlightSelectionMatches(),
    search({ top: true }),
    // Four spaces everywhere: the Tab key, auto-indent, and the unit that
    // Enter uses after a line ending in ":".
    EditorState.tabSize.of(4),
    indentUnit.of("    "),
    syntaxHighlighting(highlightStyle),
    editorTheme,
    lineMarksField,
    language === "python" ? python() : [],
    hint ? placeholder(hint) : [],
    buildKeymap(ref),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) ref.current.onChange?.(update.state.doc.toString());
    }),
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
  ];
}

/**
 * CodeMirror 6 editor. Enter keeps the current indentation (and adds one
 * level after a Python block opener), Tab indents with 4 spaces, Cmd/Ctrl+F
 * searches, Cmd/Ctrl+D selects the next occurrence, and Alt+Cmd/Ctrl+Arrow
 * adds cursors.
 */
export default function CodeEditor(props: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Callbacks and values are read through this ref so keymaps and the update
  // listener always see the latest props without recreating the editor.
  const propsRef = useRef(props);
  propsRef.current = props;

  const { language = "python", readOnly = false } = props;

  // Create the editor once per mode. Changing language or read-only mode
  // recreates it, which resets undo history for that switch only.
  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: propsRef.current.value,
        extensions: buildExtensions(propsRef),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readOnly]);

  // Push external value changes (switching files, loading a sample) into
  // the document. Typing already matches, so this does nothing then.
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== props.value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: props.value },
      });
    }
  }, [props.value]);

  // Highlight the execution step / failing expression and keep it on screen.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const error = props.errorRange ?? null;
    view.dispatch({
      effects: setLineMarks.of({
        active: props.activeLine ?? null,
        error: error
          ? {
              line: error.line,
              startCol: error.startCol ?? null,
              endCol: error.endCol ?? null,
            }
          : null,
      }),
    });
    const target = props.activeLine ?? error?.line ?? null;
    if (target && target >= 1 && target <= view.state.doc.lines) {
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.doc.line(target).from, {
          y: "center",
        }),
      });
    }
  }, [
    props.activeLine,
    props.errorRange?.line,
    props.errorRange?.startCol,
    props.errorRange?.endCol,
    language,
    readOnly,
  ]);

  const style = { "--editor-font-size": `${props.fontSize}px` } as CSSProperties;
  return (
    <div
      ref={hostRef}
      aria-label={props.ariaLabel ?? "Code editor"}
      className="h-full min-h-0 w-full overflow-hidden"
      style={style}
    />
  );
}
