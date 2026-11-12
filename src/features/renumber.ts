/**
 * Turns off Smart lists' automatic renumbering of numbered lists.
 *
 * Obsidian renumbers lists in a transaction filter that adds number changes to
 * the user's transaction. We cannot remove that filter, so we wrap it:
 *  - a lowest-precedence filter (runs before Obsidian's) records the document the
 *    user's edit would produce;
 *  - a highest-precedence filter (runs after Obsidian's) compares the result with
 *    the recorded one and, if the only differences are list numbers, changes those
 *    numbers back in the same transaction.
 * If anything other than list numbers differs (e.g. another plugin's filter), we
 * leave the transaction alone.
 */
import { ChangeSpec, EditorState, Extension, Prec, Text } from '@codemirror/state';
import { blockquoteDepth, indentLevel, LIST_RE } from '../utils/listSyntax';

const NUMBERED_RE = /^([>\s]*)(\d+)([.)] )/;

export function createRenumberBlocker(isEnabled: () => boolean): Extension {
	const intended = new WeakMap<EditorState, Text>();

	const record = EditorState.transactionFilter.of((tr) => {
		if (tr.docChanged && isEnabled()) intended.set(tr.startState, tr.newDoc);
		return tr;
	});

	const revert = EditorState.transactionFilter.of((tr) => {
		if (!tr.docChanged) return tr;
		const expected = intended.get(tr.startState);
		if (!expected) return tr;
		intended.delete(tr.startState);
		if (!isEnabled() || expected.eq(tr.newDoc)) return tr;
		const changes = numberOnlyDiff(expected, tr.newDoc);
		return changes && changes.length ? [tr, { changes, sequential: true }] : tr;
	});

	return [Prec.lowest(record), Prec.highest(revert)];
}

/**
 * Changes (in `actual` coordinates) that turn `actual` back into `expected`, or
 * null if the two differ in anything other than list numbers.
 */
function numberOnlyDiff(expected: Text, actual: Text): ChangeSpec[] | null {
	if (expected.lines !== actual.lines) return null;
	const changes: ChangeSpec[] = [];
	const a = expected.iterLines();
	let lineNo = 0;
	for (const actualIter = actual.iterLines(); !actualIter.next().done; ) {
		a.next();
		lineNo++;
		const want = a.value;
		const got = actualIter.value;
		if (want === got) continue;
		const mw = NUMBERED_RE.exec(want);
		const mg = NUMBERED_RE.exec(got);
		if (!mw || !mg) return null;
		const [allW, prefixW = '', numW = '', delimW = ''] = mw;
		const [allG, prefixG = '', numG = '', delimG = ''] = mg;
		if (prefixW !== prefixG || delimW !== delimG) return null;
		if (want.substring(allW.length) !== got.substring(allG.length)) return null;
		const from = actual.line(lineNo).from + prefixG.length;
		changes.push({ from, to: from + numG.length, insert: numW });
	}
	return changes;
}


/*
 * ---------------------------------------------------------------------------
 * Automatic renumbering for when Smart lists is off.
 * A port of the transaction filter Obsidian 1.15 adds while Smart lists is on:
 * after an edit, each changed numbered item gets "previous sibling + 1" (or keeps
 * its list's start number), and the following siblings are renumbered until one
 * already has the right number.
 * ---------------------------------------------------------------------------
 */
type ListMatch = RegExpExecArray;

/** Lines that end a "lazy" paragraph continuation: quote, heading, rule, code fence. */
const BREAK_RE = /^\s*(?:> |#{1,6} |([-_*])(\s*\1){2,}\s*$|~~~|```)/;

/** Number of the previous sibling at the same level, or null if there is none. */
function previousNumber(doc: Text, lineNo: number, indent: number, quote: number, parse: (t: string) => ListMatch): number | null {
	let lazy = false;
	for (let s = lineNo - 1; s >= 1; s--) {
		const text = doc.line(s).text;
		const c = parse(text);
		const prefix = c[1] ?? '';
		const d = blockquoteDepth(prefix);
		if (!text || text === prefix) {
			if (quote > d || lazy) break;
			continue;
		}
		if (!c[0]) {
			if (quote || BREAK_RE.test(text)) break;
			lazy = true;
			continue;
		}
		if (!c[2]) {
			lazy = true;
			continue;
		}
		const h = indentLevel(prefix);
		if (h === indent && d === quote) return c[4] ? parseInt(c[4], 10) : null;
		if (h < indent || d < quote) break;
	}
	return null;
}

/** Start number of the list that line `lineNo` (in the old document) belongs to. */
function listStartNumber(doc: Text, lineNo: number, indent: number, quote: number, parse: (t: string) => ListMatch): number {
	let n = 1;
	let lazy = false;
	for (let s = lineNo; s >= 1; s--) {
		const text = doc.line(s).text;
		if (!text) {
			if (quote || lazy) break;
			continue;
		}
		const c = parse(text);
		if (!c[0]) {
			if (quote || BREAK_RE.test(text)) break;
			lazy = true;
			continue;
		}
		if (!c[2]) {
			lazy = true;
			continue;
		}
		const prefix = c[1] ?? '';
		const d = indentLevel(prefix);
		const h = blockquoteDepth(prefix);
		if (d === indent && h === quote && c[4]) n = parseInt(c[4], 10);
		if (d < indent || h < quote) break;
	}
	return n;
}

export function createRenumberer(isEnabled: () => boolean): Extension {
	return EditorState.transactionFilter.of((tr) => {
		if (
			!isEnabled() ||
			!tr.docChanged ||
			tr.isUserEvent('set') ||
			tr.isUserEvent('input.renumber') ||
			tr.isUserEvent('input.type.compose')
		) {
			return tr;
		}
		const doc = tr.newDoc;
		const old = tr.startState.doc;
		const cache = new Map<string, ListMatch>();
		const parse = (text: string): ListMatch => {
			let m = cache.get(text);
			if (!m) cache.set(text, (m = LIST_RE.exec(text) as ListMatch));
			return m;
		};

		const changes: ChangeSpec[] = [];
		const ranges: Array<{ from: number; to: number }> = [];
		let lines: number[] = [];
		tr.changes.iterChangedRanges((_fA, _tA, fromB, toB) => {
			ranges.push({ from: fromB, to: toB });
			const a = doc.lineAt(fromB).number;
			const b = doc.lineAt(toB).number;
			for (let n = a; n <= b + 1; n++) lines.push(n);
		});
		lines = Array.from(new Set(lines)).sort((x, y) => x - y);

		const seen = new Set<number>();
		const visit = (lineNo: number) => {
			if (seen.has(lineNo)) return;
			seen.add(lineNo);
			const line = doc.line(lineNo);
			const u = parse(line.text);
			if (!u[0] || !u[4]) return;
			const prefix = u[1] ?? '';
			const indent = indentLevel(prefix);
			const quote = blockquoteDepth(prefix);
			const delim = u[5] ?? '';

			let num = previousNumber(doc, lineNo, indent, quote, parse);
			if (num === null) {
				// First item of its list: keep a typed start number, or the old list's start.
				num = 1;
				let typed = false;
				for (const r of ranges) {
					if (r.from <= line.to && r.to >= line.from) {
						const before = parse(old.lineAt(tr.changes.invertedDesc.mapPos(line.to)).text);
						if (!before || before[2] !== u[2]) {
							typed = true;
							break;
						}
					}
				}
				if (typed) num = parseInt(u[4], 10);
				else {
					const oldLine = old.lineAt(tr.changes.invertedDesc.mapPos(line.to));
					const e = parse(oldLine.text);
					if (e && indentLevel(e[1] ?? '') === indent) {
						num = listStartNumber(old, oldLine.number, indent, blockquoteDepth(e[1] ?? ''), parse);
					}
				}
			} else num++;

			if (String(num) !== u[4]) {
				changes.push({ from: line.from + prefix.length, to: line.from + prefix.length + (u[3] ?? '').length, insert: num + delim });
			}

			// Following siblings.
			let sawBlank = false;
			for (let w = lineNo + 1; w <= doc.lines && !seen.has(w); w++) {
				const k = doc.line(w);
				if (!k.text) {
					sawBlank = true;
					continue;
				}
				const x = parse(k.text);
				if (!x[0]) {
					if (sawBlank || BREAK_RE.test(k.text)) break;
					continue;
				}
				const xPrefix = x[1] ?? '';
				if (xPrefix && !x[2]) continue; // Continuation text inside an item.
				const e = indentLevel(xPrefix);
				const c = blockquoteDepth(xPrefix);
				if (e === indent && c === quote) {
					if (!x[4]) break;
					num++;
					if (String(num) === x[4]) {
						seen.add(w);
						break;
					}
					changes.push({ from: k.from + xPrefix.length, to: k.from + xPrefix.length + (x[3] ?? '').length, insert: num + (x[5] ?? '') });
					seen.add(w);
				}
				if (e < indent) break;
			}
		};
		for (const n of lines) if (n <= doc.lines) visit(n);

		return changes.length ? [tr, { changes, sequential: true, userEvent: 'input.renumber' }] : tr;
	});
}
