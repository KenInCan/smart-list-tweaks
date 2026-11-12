/**
 * Access to undocumented Obsidian internals, kept in one place.
 * Every accessor fails soft (returns a neutral value) if the internal is missing.
 */
import { App, Editor } from 'obsidian';

interface VaultWithConfig {
	getConfig?: (key: string) => unknown;
}

/** Whether "Settings → Editor → Smart lists" is on. */
export function isSmartListsOn(app: App): boolean {
	const vault = app.vault as unknown as VaultWithConfig;
	return typeof vault.getConfig === 'function' && vault.getConfig('smartIndentList') === true;
}

/**
 * Calls one of Obsidian's own editor routines that are not in the public API, e.g.
 * `newlineAndIndentContinueMarkdownList` (Enter in a list) or `newlineAndIndentOnly`
 * (Shift-Enter in a list). They work whether or not Smart lists is on.
 * Returns false if the routine is not available.
 */
export function callEditorMethod(editor: Editor | undefined, name: string): boolean {
	const fn = (editor as unknown as Record<string, unknown> | undefined)?.[name];
	if (typeof fn !== 'function') return false;
	(fn as () => void).call(editor);
	return true;
}

export type EditorCommandCallback = (editor: Editor, ctx: unknown) => unknown;

interface InternalCommand {
	id: string;
	editorCallback?: EditorCommandCallback;
}

interface AppWithCommands {
	commands?: { commands?: Record<string, InternalCommand | undefined> };
}

/**
 * Wraps the editorCallback of a built-in command. Returns a function that restores
 * the original callback, or null if the command was not found.
 */
export function wrapEditorCommand(
	app: App,
	id: string,
	wrap: (original: EditorCommandCallback) => EditorCommandCallback,
): (() => void) | null {
	const command = (app as unknown as AppWithCommands).commands?.commands?.[id];
	const original = command?.editorCallback;
	if (!command || typeof original !== 'function') return null;
	const wrapped = wrap(original);
	command.editorCallback = wrapped;
	return () => {
		// Only restore if nobody replaced our wrapper in the meantime.
		if (command.editorCallback === wrapped) command.editorCallback = original;
	};
}
