import { Plugin } from 'obsidian';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import {
	DEFAULT_SETTINGS,
	migrateSettings,
	SmartListTweaksSettings,
	SmartListTweaksSettingTab,
} from './settings';
import { indentAction } from './features/indent';
import { EnterOptions, handleEnter, handleShiftEnter } from './features/enter';
import { createRenumberBlocker, createRenumberer } from './features/renumber';
import { patchBuiltInCommands } from './features/commands';
import { isSmartListsOn } from './utils/obsidianInternals';

export default class SmartListTweaksPlugin extends Plugin {
	settings!: SmartListTweaksSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SmartListTweaksSettingTab(this.app, this));

		const indent = (dir: 1 | -1) => (v: EditorView) =>
			indentAction(v, dir, this.settings.indentWithChildren, this.smartListsOn());

		// Highest precedence so these run before Obsidian's own Tab / Enter handlers.
		// Each handler returns false (lets Obsidian handle the key) unless it applies.
		this.registerEditorExtension([
			Prec.highest(
				keymap.of([
					{ key: 'Tab', run: indent(1) },
					{ key: 'Shift-Tab', run: indent(-1) },
					{ key: 'Mod-]', run: indent(1) },
					{ key: 'Mod-[', run: indent(-1) },
					{
						key: 'Enter',
						run: (v) => handleEnter(v, this.enterOptions()),
						shift: (v) => handleShiftEnter(v, this.enterOptions()),
					},
				]),
			),
			// Smart lists on: Obsidian renumbers; undo it when the setting is off.
			createRenumberBlocker(() => !this.settings.autoRenumber && this.smartListsOn()),
			// Smart lists off: renumber ourselves when the setting is on.
			createRenumberer(() => this.settings.autoRenumber && !this.smartListsOn()),
		]);

		this.app.workspace.onLayoutReady(() => patchBuiltInCommands(this));
	}

	smartListsOn(): boolean {
		return isSmartListsOn(this.app);
	}

	private enterOptions(): EnterOptions {
		return {
			smartListsOn: this.smartListsOn(),
			continueList: this.settings.enterContinuesList,
			asFirstChild: this.settings.enterAsFirstChild,
			afterFold: this.settings.enterAfterFold,
		};
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateSettings(await this.loadData()));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
