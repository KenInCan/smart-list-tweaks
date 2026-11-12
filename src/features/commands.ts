/**
 * Replaces the behavior of built-in editor commands while keeping their IDs,
 * names and hotkeys. The originals are restored when the plugin unloads.
 */
import { EditorView } from '@codemirror/view';
import { Editor } from 'obsidian';
import type SmartListTweaksPlugin from '../main';
import { indentAction } from './indent';
import { moveLines } from './moveLine';
import { isSmartListsOn, wrapEditorCommand } from '../utils/obsidianInternals';

/** Returns true if it handled the command, false to run the original. */
type Handler = (view: EditorView) => boolean;

function cmOf(editor: Editor): EditorView | undefined {
	const cm = (editor as unknown as { cm?: unknown }).cm;
	return cm instanceof EditorView ? cm : undefined;
}

export function patchBuiltInCommands(plugin: SmartListTweaksPlugin): void {
	const s = () => plugin.settings;
	const smartOn = () => isSmartListsOn(plugin.app);

	const move = (dir: -1 | 1): Handler => (view) => {
		const opt = { withChildren: s().moveWithChildren, skipBlank: s().moveSkipBlankLines };
		// Both on = Obsidian 1.15's own list-aware move. With Smart lists off,
		// Obsidian's command is plain line swapping, so our version is used.
		if (opt.withChildren && opt.skipBlank && smartOn()) return false;
		return moveLines(view, dir, opt);
	};
	const indent = (dir: 1 | -1): Handler => (view) => indentAction(view, dir, s().indentWithChildren, smartOn());

	const patches: Array<[string, Handler]> = [
		['editor:swap-line-up', move(-1)],
		['editor:swap-line-down', move(1)],
		['editor:indent-list', indent(1)],
		['editor:unindent-list', indent(-1)],
	];

	const missing: string[] = [];
	for (const [id, handler] of patches) {
		const restore = wrapEditorCommand(plugin.app, id, (original) => (editor, ctx) => {
			const view = cmOf(editor);
			if (view && handler(view)) return;
			return original(editor, ctx);
		});
		if (restore) plugin.register(restore);
		else missing.push(id);
	}
	if (missing.length) {
		console.warn(`[smart-list-tweaks] Built-in commands not found, left unchanged: ${missing.join(', ')}`);
	}
}
