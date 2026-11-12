/**
 * Markdown list helpers. The rules mirror the ones Obsidian's editor uses
 * (same list regex, same "blockquote depth / indent level" model).
 */
import { EditorState, Line } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

/** Same shape as Obsidian's list regex: [all, prefix, marker, bullet, number, delimiter, checkbox]. */
export const LIST_RE = /^([>\s]*)(([*+-] |(\d+)([.)] ))(?:\[(.)\] )?)?/;
const BLANK_RE = /^[\s>]*$/;

interface LineInfo {
	blank: boolean;
	isItem: boolean;
	/** Indent level after the last ">" (tab or 4 spaces = 1 level). */
	indent: number;
	/** Number of ">" in the prefix. */
	blockquote: number;
	/** Indent columns after the blockquote markers. */
	columns: number;
	prefix: string;
}

export function blockquoteDepth(prefix: string): number {
	return (prefix.match(/>/g) ?? []).length;
}

export function indentLevel(prefix: string): number {
	let level = 0;
	let rest = prefix;
	const eat = () => {
		for (;;) {
			if (rest.startsWith('\t')) rest = rest.substring(1);
			else if (rest.startsWith('    ')) rest = rest.substring(4);
			else break;
			level++;
		}
	};
	const lastQuote = rest.lastIndexOf('>');
	if (lastQuote !== -1) {
		rest = rest.substring(lastQuote + 1);
		eat();
		if (rest.startsWith(' ')) rest = rest.substring(1);
	}
	eat();
	return level;
}

function columnsAfterQuotes(prefix: string, depth: number): number {
	let rest = prefix;
	for (let i = 0; i < depth; i++) rest = rest.substring(rest.indexOf('>') + 1).replace(/^ /, '');
	const ws = /^[ \t]*/.exec(rest)?.[0] ?? '';
	let col = 0;
	for (const ch of ws) col = ch === '\t' ? col + 4 - (col % 4) : col + 1;
	return col;
}

const BLOCK_TOKENS = ['HyperMD-codeblock', 'HyperMD-math', 'hmd-indented-code', 'HyperMD-table-2'];

/**
 * True if the range touches a code block, math block or table row — places where
 * Smart lists does not continue lists. Checks node names and string node props,
 * since Obsidian stores its line/token classes in node props.
 */
export function isInCodeMathOrTable(state: EditorState, from: number, to: number): boolean {
	let found = false;
	syntaxTree(state).iterate({
		from,
		to,
		enter: (node) => {
			const texts: string[] = [node.type.name];
			const props = (node.type as unknown as { props?: Record<string, unknown> }).props;
			if (props) for (const v of Object.values(props)) if (typeof v === 'string') texts.push(v);
			if (texts.some((t) => BLOCK_TOKENS.some((token) => t.includes(token)))) {
				found = true;
				return false;
			}
			return undefined;
		},
	});
	return found;
}

function lineInfo(state: EditorState, lineNo: number): LineInfo {
	const line = state.doc.line(lineNo);
	if (BLANK_RE.test(line.text)) {
		return { blank: true, isItem: false, indent: 0, blockquote: 0, columns: 0, prefix: '' };
	}
	const m = LIST_RE.exec(line.text);
	const all = m?.[0] ?? '';
	const prefix = m?.[1] ?? '';
	const depth = blockquoteDepth(prefix);
	return {
		blank: false,
		isItem: !!m?.[2] && !isInCodeMathOrTable(state, line.from, line.from + all.length),
		indent: indentLevel(prefix),
		blockquote: depth,
		columns: columnsAfterQuotes(prefix, depth),
		prefix,
	};
}

function isNestedUnder(child: LineInfo, parent: LineInfo): boolean {
	if (child.blockquote === parent.blockquote) {
		return child.isItem ? child.indent > parent.indent : child.columns > parent.columns;
	}
	return (
		child.blockquote > parent.blockquote &&
		columnsAfterQuotes(child.prefix, parent.blockquote) > parent.columns
	);
}

/** Line number of the first nested list item of the item on `lineNo`, or null (same rule as Obsidian 1.15). */
export function firstNestedItemLine(state: EditorState, lineNo: number): number | null {
	const parent = lineInfo(state, lineNo);
	if (!parent.isItem) return null;
	for (let n = lineNo + 1; n <= state.doc.lines; n++) {
		const info = lineInfo(state, n);
		if (info.blank) continue;
		return info.isItem && info.blockquote === parent.blockquote && isNestedUnder(info, parent) ? n : null;
	}
	return null;
}

export function hasNestedItem(state: EditorState, lineNo: number): boolean {
	return firstNestedItemLine(state, lineNo) !== null;
}

/** True if `line` is a list item with text after its marker. */
export function isNonEmptyListItem(line: Line): boolean {
	const m = LIST_RE.exec(line.text);
	return !!m?.[2] && line.text.substring(m[0].length).trim() !== '';
}

/** True if any line touched by the selection is a list item. */
export function selectionTouchesListItem(state: EditorState): boolean {
	for (const range of state.selection.ranges) {
		const first = state.doc.lineAt(range.from).number;
		const last = state.doc.lineAt(range.to).number;
		for (let n = first; n <= last; n++) {
			if (LIST_RE.exec(state.doc.line(n).text)?.[2]) return true;
		}
	}
	return false;
}
