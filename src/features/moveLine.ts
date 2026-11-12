/**
 * "Move line up/down" with two independent options:
 *  - withChildren: move a list item together with its nested lines;
 *  - skipBlank: jump over blank lines (they stay where they are).
 * Both off is plain line swapping (CodeMirror's moveLineUp/Down, as in 1.14).
 * Both on is Obsidian 1.15's own behavior; the caller runs the original command then.
 */
import { EditorSelection, EditorState } from '@codemirror/state';
import { moveLineDown, moveLineUp } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { blockEnd, indentOf, isBlankLine as isBlank } from '../utils/listBlocks';

export interface MoveOptions {
	withChildren: boolean;
	skipBlank: boolean;
}

interface Span {
	from: number; // first line number
	to: number; // last line number
}

function neighborAbove(state: EditorState, unit: Span, opt: MoveOptions): Span | null {
	let p = unit.from - 1;
	if (opt.skipBlank) while (p >= 1 && isBlank(state, p)) p--;
	if (p < 1) return null;
	if (!opt.withChildren || isBlank(state, p)) return { from: p, to: p };
	// The block that ends at p: walk up to the first line no deeper than the unit's head.
	const head = indentOf(state, unit.from);
	for (let q = p; q >= 1; q--) {
		if (isBlank(state, q) || indentOf(state, q) > head) continue;
		return { from: q, to: p };
	}
	return { from: p, to: p };
}

function neighborBelow(state: EditorState, unit: Span, opt: MoveOptions): Span | null {
	let p = unit.to + 1;
	if (opt.skipBlank) while (p <= state.doc.lines && isBlank(state, p)) p++;
	if (p > state.doc.lines) return null;
	if (!opt.withChildren || isBlank(state, p)) return { from: p, to: p };
	return { from: p, to: blockEnd(state, p) };
}

function sliceLines(state: EditorState, span: Span): string {
	return state.doc.sliceString(state.doc.line(span.from).from, state.doc.line(span.to).to);
}

export function moveLines(view: EditorView, dir: -1 | 1, opt: MoveOptions): boolean {
	const { state } = view;
	if (!opt.withChildren && !opt.skipBlank) return dir < 0 ? moveLineUp(view) : moveLineDown(view);
	if (state.readOnly) return false;
	// Several cursors: keep it simple and predictable.
	if (state.selection.ranges.length > 1) return dir < 0 ? moveLineUp(view) : moveLineDown(view);

	const sel = state.selection.main;
	const first = state.doc.lineAt(sel.from).number;
	const lastLine = state.doc.lineAt(sel.to);
	let last = !sel.empty && sel.to === lastLine.from && lastLine.number > first ? lastLine.number - 1 : lastLine.number;
	if (opt.withChildren) {
		for (let k = first, end = last; k <= end; k++) last = Math.max(last, blockEnd(state, k));
	}
	const unit: Span = { from: first, to: last };
	const other = dir < 0 ? neighborAbove(state, unit, opt) : neighborBelow(state, unit, opt);
	if (!other) return true; // At the edge of the document: nothing to do.

	const [top, bottom] = dir < 0 ? [other, unit] : [unit, other];
	const middle: Span = { from: top.to + 1, to: bottom.from - 1 };
	const midText = middle.from <= middle.to ? sliceLines(state, middle) + '\n' : '';
	const unitText = sliceLines(state, unit);
	const otherText = sliceLines(state, other);

	const from = state.doc.line(top.from).from;
	const to = state.doc.line(bottom.to).to;
	const insert = dir < 0 ? `${unitText}\n${midText}${otherText}` : `${otherText}\n${midText}${unitText}`;
	const unitStartNew = dir < 0 ? from : from + otherText.length + 1 + midText.length;
	const shift = unitStartNew - state.doc.line(unit.from).from;

	view.dispatch(
		state.update({
			changes: { from, to, insert },
			selection: EditorSelection.range(sel.anchor + shift, sel.head + shift),
			scrollIntoView: true,
			userEvent: 'move.line',
		}),
	);
	return true;
}
