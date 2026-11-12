/**
 * Enter (and Shift-Enter) in lists, independent of the Smart lists setting.
 *
 * Obsidian's own Enter with Smart lists on (1.15):
 *   code/table/math line   -> newline keeping indentation only
 *   folded item, at end    -> new item after the folded range        (new in 1.15)
 *   item with nested items -> new first nested item                  (new in 1.15)
 *   otherwise              -> "continue the list" routine (as in 1.14)
 * With Smart lists off, Enter is a plain newline that keeps the indentation.
 *
 * When Smart lists is on we only step in where the settings differ from what
 * Obsidian does; when it is off we provide the whole behavior ourselves, calling
 * Obsidian's own "continue the list" routine (it works regardless of the setting).
 */
import { EditorState, StateEffect } from '@codemirror/state';
import { foldEffect, foldedRanges } from '@codemirror/language';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import { callEditorMethod } from '../utils/obsidianInternals';
import {
	firstNestedItemLine,
	isInCodeMathOrTable,
	isNonEmptyListItem,
	LIST_RE,
} from '../utils/listSyntax';

export interface EnterOptions {
	smartListsOn: boolean;
	/** Off: Enter in a list item is a plain newline that keeps the indentation. */
	continueList: boolean;
	/** On: Enter at the end of an item with nested items adds a new first nested item. */
	asFirstChild: boolean;
	/** On: Enter at the end of a folded item adds the new item after the folded range. */
	afterFold: boolean;
}

const continueList = (view: EditorView) =>
	callEditorMethod(view.state.field(editorInfoField, false)?.editor, 'newlineAndIndentContinueMarkdownList');

/** The folded range that starts at `pos`, if any. */
function foldStartingAt(state: EditorState, pos: number): { from: number; to: number } | null {
	let found: { from: number; to: number } | null = null;
	foldedRanges(state).between(pos, pos, (from, to) => {
		if (from === pos && !found) found = { from, to };
	});
	return found;
}

export function handleEnter(view: EditorView, o: EnterOptions): boolean {
	const { state } = view;
	const head = state.selection.main.head;
	const line = state.doc.lineAt(head);

	if (!o.continueList) {
		// Smart lists off already gives a plain newline; with it on, we make one.
		if (!o.smartListsOn || !LIST_RE.exec(line.text)?.[2]) return false;
		if (isInCodeMathOrTable(state, line.from, line.to)) return false;
		return insertNewlineAndIndent(view);
	}

	// Code, math and tables: leave Enter to Obsidian in both modes.
	if (isInCodeMathOrTable(state, line.from, line.to)) return false;

	const single = !state.readOnly && state.selection.ranges.length === 1 && state.selection.main.empty;
	if (single && head === line.to && isNonEmptyListItem(line)) {
		const fold = foldStartingAt(state, head);
		if (fold) {
			if (o.afterFold) return o.smartListsOn ? false : insertAfterFold(view, fold);
			return continueList(view);
		}
		const child = firstNestedItemLine(state, line.number);
		if (child !== null) {
			if (o.asFirstChild) return o.smartListsOn ? false : insertFirstChild(view, child);
			return continueList(view);
		}
	}
	return o.smartListsOn ? false : continueList(view);
}

/** Shift-Enter: Smart lists' "newline keeping indentation only". */
export function handleShiftEnter(view: EditorView, o: EnterOptions): boolean {
	if (o.smartListsOn || !o.continueList) return false;
	const line = view.state.doc.lineAt(view.state.selection.main.head);
	if (isInCodeMathOrTable(view.state, line.from, line.to)) return false;
	return callEditorMethod(view.state.field(editorInfoField, false)?.editor, 'newlineAndIndentOnly');
}

/** Port of Obsidian 1.15's "Enter on a folded item": new item after the folded range. */
function insertAfterFold(view: EditorView, fold: { from: number; to: number }): boolean {
	const { state } = view;
	const { to } = fold;
	if (to !== state.doc.lineAt(to).to) return continueList(view);
	const m = LIST_RE.exec(state.doc.lineAt(fold.from).text);
	if (!m?.[2]) return continueList(view);
	const [, prefix = '', , marker = '', num, delim = '', checkbox] = m;
	const item = prefix + (num !== undefined ? `${+num + 1}${delim}` : marker) + (checkbox !== undefined ? '[ ] ' : '');
	const atEnd = to === state.doc.length;
	// Inserting at the very end of the document would extend the fold; restore it.
	const refold: StateEffect<unknown>[] = [];
	if (atEnd) {
		foldedRanges(state).between(to, to, (from, end) => {
			if (end === to) refold.push(foldEffect.of({ from, to: end }));
		});
	}
	view.dispatch(
		state.update({
			changes: atEnd ? { from: to, insert: '\n' + item } : { from: to + 1, insert: item + '\n' },
			selection: { anchor: to + 1 + item.length },
			scrollIntoView: true,
			userEvent: 'input.type',
		}),
	);
	if (refold.length) view.dispatch(view.state.update({ effects: refold }));
	return true;
}

/** Port of Obsidian 1.15's "Enter on an item with nested items": new first nested item. */
function insertFirstChild(view: EditorView, childLine: number): boolean {
	const { state } = view;
	const line = state.doc.lineAt(state.selection.main.head);
	const m = LIST_RE.exec(state.doc.line(childLine).text);
	if (!m?.[2]) return continueList(view);
	const [, prefix = '', , marker = '', , , checkbox] = m;
	const insert = '\n' + prefix + marker + (checkbox !== undefined ? '[ ] ' : '');
	view.dispatch(
		state.update({
			changes: { from: line.to, insert },
			selection: { anchor: line.to + insert.length },
			scrollIntoView: true,
			userEvent: 'input.type',
		}),
	);
	return true;
}
