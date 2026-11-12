/**
 * "A list item and its nested lines" as a block of line numbers.
 * Used by moving lines and by indenting with nested items.
 */
import { EditorState } from '@codemirror/state';
import { LIST_RE } from './listSyntax';

const BLANK_RE = /^[\s>]*$/;
const QUOTE_RE = /^(?:\s*>\s?)*/;

export function isBlankLine(state: EditorState, n: number): boolean {
	return BLANK_RE.test(state.doc.line(n).text);
}

/** Indent columns after any blockquote markers. */
export function indentOf(state: EditorState, n: number): number {
	const text = state.doc.line(n).text;
	const rest = text.substring(QUOTE_RE.exec(text)?.[0].length ?? 0);
	let col = 0;
	for (const ch of rest) {
		if (ch === ' ') col++;
		else if (ch === '\t') col += state.tabSize - (col % state.tabSize);
		else break;
	}
	return col;
}

export function isListItemLine(state: EditorState, n: number): boolean {
	return !!LIST_RE.exec(state.doc.line(n).text)?.[2];
}

/**
 * Last line of the item on line `n` including its nested lines. Blank lines are
 * included only when deeper lines follow them; trailing blank lines are not.
 */
export function blockEnd(state: EditorState, n: number): number {
	if (!isListItemLine(state, n)) return n;
	const base = indentOf(state, n);
	let end = n;
	for (let k = n + 1; k <= state.doc.lines; k++) {
		if (isBlankLine(state, k)) continue;
		if (indentOf(state, k) <= base) break;
		end = k;
	}
	return end;
}
