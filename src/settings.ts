import { App, PluginSettingTab, SettingDefinitionItem, SettingGroupItem } from 'obsidian';
import type SmartListTweaksPlugin from './main';

/**
 * Every switch reads the same way: on = that behavior happens. The switches work
 * whether Obsidian's own "Smart lists" setting is on or off.
 * Defaults give Obsidian 1.14's behavior, except where 1.15 is a plain improvement.
 */
export interface SmartListTweaksSettings {
	/** Tab / Shift-Tab / Mod-] / Mod-[ / "Indent list" also move nested items (1.15). */
	indentWithChildren: boolean;
	/** "Move line up/down" moves a list item together with its nested items (1.15). */
	moveWithChildren: boolean;
	/** "Move line up/down" jumps over blank lines, leaving them in place (1.15). */
	moveSkipBlankLines: boolean;
	/** Enter in a list item starts a new item with the same marker (1.14 and 1.15). */
	enterContinuesList: boolean;
	/** Enter at the end of an item with nested items adds a new first nested item (1.15). */
	enterAsFirstChild: boolean;
	/** Enter at the end of a folded item adds the new item after the folded range (1.15). */
	enterAfterFold: boolean;
	/** Smart lists renumbers numbered lists after edits (1.14 and 1.15). */
	autoRenumber: boolean;
}

export const DEFAULT_SETTINGS: SmartListTweaksSettings = {
	indentWithChildren: false,
	moveWithChildren: false,
	moveSkipBlankLines: false,
	enterContinuesList: true,
	enterAsFirstChild: false,
	enterAfterFold: true,
	autoRenumber: true,
};

/** Settings as saved by 0.1.0 / 0.2.0, where some switches had the opposite meaning. */
interface LegacySettings {
	lineOnlyIndent?: boolean;
	lineOnlyMove?: boolean;
	enterSiblingWithChildren?: boolean;
	enterSiblingWhenFolded?: boolean;
	disableRenumber?: boolean;
}

export function migrateSettings(saved: unknown): Partial<SmartListTweaksSettings> {
	const data = { ...((saved ?? {}) as Partial<SmartListTweaksSettings> & LegacySettings) };
	const flip = (oldKey: keyof LegacySettings, newKey: keyof SmartListTweaksSettings) => {
		const old = data[oldKey];
		if (typeof old === 'boolean' && data[newKey] === undefined) data[newKey] = !old;
		delete data[oldKey];
	};
	flip('lineOnlyIndent', 'indentWithChildren');
	flip('enterSiblingWithChildren', 'enterAsFirstChild');
	flip('enterSiblingWhenFolded', 'enterAfterFold');
	flip('disableRenumber', 'autoRenumber');
	// 0.1.0's single "lineOnlyMove" switch: off meant Obsidian's own behavior.
	if (data.lineOnlyMove === false && data.moveWithChildren === undefined) {
		data.moveWithChildren = true;
		data.moveSkipBlankLines = true;
	}
	delete data.lineOnlyMove;
	return data;
}

type Key = keyof SmartListTweaksSettings;

function toggle(name: string, desc: string, key: Key): SettingGroupItem<Key> {
	return { name, desc, control: { type: 'toggle', key, defaultValue: DEFAULT_SETTINGS[key] } };
}

export class SmartListTweaksSettingTab extends PluginSettingTab {
	plugin: SmartListTweaksPlugin;

	constructor(app: App, plugin: SmartListTweaksPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<Key>[] {
		return [
			{
				type: 'group',
				heading: 'Indent',
				items: [
					toggle(
						'Indent nested items along',
						'Tab, Shift-Tab, Mod-], Mod-[ and the "Indent list" / "Unindent list" commands also move the nested items (Obsidian 1.15). Off: only the current line or the selected lines are indented.',
						'indentWithChildren',
					),
				],
			},
			{
				type: 'group',
				heading: 'Move line',
				items: [
					toggle(
						'Move nested items along',
						'"Move line up" / "Move line down" move a list item together with its nested items. Off: only the current line or the selected lines move.',
						'moveWithChildren',
					),
					toggle(
						'Skip blank lines',
						'"Move line up" / "Move line down" jump over blank lines and leave them in place. Off: a blank line is swapped like any other line. With both options on, Obsidian 1.15\'s own behavior is used.',
						'moveSkipBlankLines',
					),
				],
			},
			{
				type: 'group',
				heading: 'Enter',
				items: [
					toggle(
						'Continue the list',
						'Enter in a list item starts a new item with the same bullet, the next number or an empty checkbox. Off: a plain line break that keeps the indentation, as with Smart lists off. The two options below only apply while this is on.',
						'enterContinuesList',
					),
					toggle(
						'Add as first nested item',
						'Enter at the end of an item that has nested items adds the new item as its first nested item (Obsidian 1.15). Off: a new item at the same level right below it.',
						'enterAsFirstChild',
					),
					toggle(
						'Add after folded items',
						'Enter at the end of a folded item adds the new item after the folded range (Obsidian 1.15). Off: right below the folded item\'s first line, inside the folded range.',
						'enterAfterFold',
					),
				],
			},
			{
				type: 'group',
				heading: 'Numbered lists',
				items: [
					toggle(
						'Renumber automatically',
						'Renumber the following items whenever a numbered list is edited. Off: the numbers you typed are kept.',
						'autoRenumber',
					),
				],
			},
		];
	}
}
