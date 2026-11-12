/**
 * Indent / unindent: line by line (Obsidian 1.14, or 1.15 with Smart lists off),
 * or block by block with nested items (Obsidian 1.15 with Smart lists on).
 */
import { ChangeSpec, EditorSelection, EditorState, Line, countColumn } from '@codemirror/state';
import { getIndentUnit, indentString, indentUnit } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { blockEnd, indentOf, isBlankLine, isListItemLine } from '../utils/listBlocks';
import { selectionTouchesListItem } from '../utils/listSyntax';

type LineChange = (line: Line, changes: ChangeSpec[]) => void;

function changeSelectedLines(state: EditorState, f: LineChange) {
	let lastLine = -1;
	return state.changeByRange((range) => {
		const changes: ChangeSpec[] = [];
		for (let pos = range.from; pos <= range.to; ) {
			const line = state.doc.lineAt(pos);
			if (line.number > lastLine && (range.empty || range.to > line.from)) {
				f(line, changes);
				lastLine = line.number;
			}
			pos = line.to + 1;
		}
		const set = state.changes(changes);
		return {
			changes,
			range: EditorSelection.range(set.mapPos(range.anchor, 1), set.mapPos(range.head, 1)),
		};
	});
}

const QUOTE_PREFIX_RE = /^[\s>]+/;

/** Position right after the blockquote markers ("> > ") of a line. */
function afterQuotes(line: Line): number {
	const m = QUOTE_PREFIX_RE.exec(line.text);
	if (!m) return line.from;
	let i = m[0].lastIndexOf('>');
	if (i === -1) return line.from;
	if (m[0].charAt(i + 1) === ' ') i++;
	return line.from + i + 1;
}

function indentOp(state: EditorState): LineChange {
	const unit = state.facet(indentUnit);
	return (line, changes) => {
		changes.push({ from: afterQuotes(line), insert: unit });
	};
}

function dedentAt(state: EditorState, line: Line, pos: number, changes: ChangeSpec[]) {
	const ws = /^[ \t]*/.exec(line.text.substring(pos - line.from))?.[0] ?? '';
	if (!ws) return;
	const cols = countColumn(ws, state.tabSize);
	const target = indentString(state, Math.max(0, cols - getIndentUnit(state)));
	let same = 0;
	while (same < ws.length && same < target.length && ws.charCodeAt(same) === target.charCodeAt(same)) same++;
	changes.push({ from: pos + same, to: pos + ws.length, insert: target.slice(same) });
}

function dedentOp(state: EditorState): LineChange {
	return (line, changes) => {
		const m = QUOTE_PREFIX_RE.exec(line.text);
		if (!m) return;
		const prefix = m[0];
		const firstQuote = prefix.indexOf('>');
		if (firstQuote > 0) {
			// Whitespace before the blockquote marker: remove it.
			changes.push({ from: line.from, to: line.from + firstQuote, insert: '' });
			return;
		}
		if (prefix === '> ') return;
		let lastQuote = prefix.lastIndexOf('>');
		if (lastQuote !== -1 && prefix.charAt(lastQuote + 1) === ' ') lastQuote++;
		dedentAt(state, line, line.from + lastQuote + 1, changes);
	};
}

function run(view: EditorView, spec: ReturnType<EditorState['changeByRange']>, userEvent: string): boolean {
	view.dispatch(view.state.update(spec, { userEvent }));
	return true;
}

/** Indent only the current / selected lines (Obsidian 1.14, or 1.15 with Smart lists off). */
export function indentLines(view: EditorView): boolean {
	const { state } = view;
	if (state.readOnly) return false;
	return run(view, changeSelectedLines(state, indentOp(state)), 'input.indent');
}

export function unindentLines(view: EditorView): boolean {
	const { state } = view;
	if (state.readOnly) return false;
	return run(view, changeSelectedLines(state, dedentOp(state)), 'delete.dedent');
}

/**
 * Like Obsidian 1.15 with Smart lists on: a list item is indented together with
 * its nested lines. `canMove` decides per item (unindent skips items already at
 * the left edge, whose nested lines are then handled one by one).
 */
function changeBlocks(state: EditorState, f: LineChange, canMove: (lineNo: number) => boolean) {
	let done = -1;
	return state.changeByRange((range) => {
		const changes: ChangeSpec[] = [];
		const toLine = state.doc.lineAt(range.to);
		const last = !range.empty && range.to === toLine.from && toLine.number > 1 ? toLine.number - 1 : toLine.number;
		for (let c = Math.max(state.doc.lineAt(range.from).number, done + 1); c <= last; ) {
			if (!isListItemLine(state, c)) {
				f(state.doc.line(c), changes);
				done = c++;
			} else if (canMove(c)) {
				const end = blockEnd(state, c);
				for (let n = c; n <= end; n++) if (!isBlankLine(state, n)) f(state.doc.line(n), changes);
				done = end;
				c = end + 1;
			} else c++;
		}
		const set = state.changes(changes);
		return {
			changes,
			range: EditorSelection.range(set.mapPos(range.anchor, 1), set.mapPos(range.head, 1)),
		};
	});
}

export function indentBlocks(view: EditorView): boolean {
	const { state } = view;
	if (state.readOnly) return false;
	return run(view, changeBlocks(state, indentOp(state), () => true), 'input.indent');
}

export function unindentBlocks(view: EditorView): boolean {
	const { state } = view;
	if (state.readOnly) return false;
	return run(view, changeBlocks(state, dedentOp(state), (n) => indentOf(state, n) > 0), 'delete.dedent');
}

/**
 * Tab / Shift-Tab / Mod-] / Mod-[ and the "Indent list" commands.
 * Returns false where Obsidian's own handling already does what the setting asks:
 *   Smart lists on  + with nested items -> Obsidian (1.15 block indent)
 *   Smart lists off + line only         -> Obsidian (line indent)
 * and outside lists, where both behave the same.
 */
export function indentAction(view: EditorView, dir: 1 | -1, withChildren: boolean, smartListsOn: boolean): boolean {
	if (withChildren === smartListsOn) return false;
	if (!selectionTouchesListItem(view.state)) return false;
	if (withChildren) return dir > 0 ? indentBlocks(view) : unindentBlocks(view);
	return dir > 0 ? indentLines(view) : unindentLines(view);
}
