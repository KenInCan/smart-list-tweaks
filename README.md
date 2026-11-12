# Smart List Tweaks

An Obsidian plugin that lets you turn each list behavior handled by **Smart lists** (**Settings → Editor → Smart lists**) on or off individually. **The plugin follows its own settings whether Smart lists itself is on or off.**

In Obsidian 1.15, when Smart lists is on, indenting, moving lines, and pressing Enter now carry nested child items along. This plugin lets you switch each of those behaviors on or off one by one. The defaults match the behavior of 1.14.

## Settings

Every setting follows the same rule: **on = the behavior happens**.

| Section | Setting | Default | When on | When off |
|---|---|---|---|---|
| Indent | Indent nested items along | Off | Tab / Shift-Tab / Mod-] / Mod-[ and **Indent list** / **Unindent list** move child items too (1.15 default) | Indents only the current line (or the selected lines). No depth limit |
| Move line | Move nested items along | Off | **Move line up/down** moves a list item together with its child items | Only the current line (or the selected lines) moves |
| Move line | Skip blank lines | Off | **Move line up/down** jumps over blank lines and leaves them in place | Blank lines are swapped like any other line |
| Enter | Continue the list | On | Enter creates a new item with the same bullet, the next number, or an empty checkbox | A plain line break that only keeps the indentation (same as with Smart lists off) |
| Enter | Add as first nested item | Off | Enter at the end of an item with children adds the new item as its first child (1.15 default) | Adds a sibling item right below (1.14) |
| Enter | Add after folded items | On | Enter at the end of a folded item adds the new item after the folded range (1.15 default) | Adds it right below that line, inside the folded range (1.14) |
| Numbered lists | Renumber automatically | On | Editing a numbered list renumbers the items that follow | Keeps the numbers as you typed them |

- Every setting works regardless of whether Smart lists is on or off.
  - With Smart lists on: the plugin uses Obsidian's own handling and replaces only the parts that differ from your settings.
  - With Smart lists off: the plugin takes over the features Obsidian no longer handles. List continuation calls Obsidian's own logic; everything else (indenting with children, adding as the first child, adding after folded items, renumbering) is a port of the 1.15.0 logic inside the plugin.
- With Smart lists off and **Continue the list** on, Shift+Enter also behaves like Smart lists: a line break with no bullet that keeps the indentation.
- When **Continue the list** is off, the two Enter settings below it have no effect.
- The two move-line settings can be combined:
  - Both off: swaps one line at a time (same as 1.14)
  - Only nested items on: moves the item with its children, and swaps with blank lines
  - Only blank lines on: moves only the current line, swapping it with the line past the blank lines
  - Both on: Obsidian 1.15's default behavior (with Smart lists on, the plugin calls Obsidian's own command)
- The move-line settings work regardless of Smart lists (except when both are on and Smart lists is on).
- The move-line commands keep their ID, name, and hotkeys; only what they do is replaced. You don't need to set your hotkeys again. Disabling the plugin restores the original commands.
- With multiple cursors, moving lines falls back to a simple one-line swap.
- Settings from 0.1.0 / 0.2.0 are migrated automatically with the same meaning.

## Limitations

- The plugin relies on the following private APIs. If an Obsidian update breaks one of them, only that feature falls back to the default behavior (no errors).
  - Reading the Smart lists setting
  - Replacing built-in commands
  - Calling Obsidian's own list-continuation logic
- Turning off automatic renumbering (with Smart lists on) works by reverting the numbers Obsidian changed, within the same edit. Edits that also contain other changes (for example, rewrites by other plugins) are left alone.
- Renumbering with Smart lists off is a port of the 1.15.0 logic. Conditions that only Obsidian knows internally (changes from sync, edits inside table cells, and so on) can't be detected, so renumbering may also run for those edits.
- With Smart lists off, "child items" are detected with the plugin's own rule (lines indented at least one level deeper), the same as for moving lines. This can differ from Obsidian's own detection in small details.
- If you use the **Outliner** plugin, enable Tab / Shift-Tab and line moving in only one of the two plugins. Both handle Tab with top priority, so with both enabled, which one wins depends on load order.
- Indentation triggered in other ways, such as `>>` / `<<` in Vim mode, is not affected.
- The changes in Obsidian 1.15.1 (desktop early access only), "don't move children while text is selected" and "don't indent more than one level deeper", haven't been confirmed in the source. Either way, this plugin's indentation doesn't go through Obsidian's logic, so it is not affected by them.

## Development

This plugin is based on [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin). Building and development work the same way as in the sample plugin.

- Requires Node.js 18 or later (check with `node --version`).
- Run `npm i` to install dependencies.
- Run `npm run dev` to compile `src/main.ts` to `main.js` in watch mode.
- Run `npm run build` for a production build (includes type checking).
- Run `npm run lint` to run ESLint (`eslint-plugin-obsidianmd`).
- Run `npm update` to update the Obsidian API.

Put the development folder at `<Vault>/.obsidian/plugins/smart-list-tweaks/`, reload Obsidian, and enable the plugin in **Settings → Community plugins**.

`@codemirror/*` is treated as external at build time, and Obsidian's own copy is used at runtime. For that reason, `overrides` in `package.json` pins `@codemirror/state` and `@codemirror/view` to the versions the `obsidian` package specifies.

### Source layout

```
src/
  main.ts                    # Lifecycle, keymap and extension registration
  settings.ts                # Settings type, defaults, and settings tab
  features/
    indent.ts                # Indent / unindent (line only, or with children)
    enter.ts                 # Enter / Shift+Enter (continue, first child, folded items)
    moveLine.ts              # Move line (children and blank lines toggled separately)
    renumber.ts              # Automatic renumbering (reverting, and own renumbering with Smart lists off)
    commands.ts              # Replacing built-in commands
  utils/
    listSyntax.ts            # Parsing list lines
    listBlocks.ts            # Finding the range of an item plus its children
    obsidianInternals.ts     # All private API access lives here
```

## Manual installation

Copy `main.js` and `manifest.json` to `<Vault>/.obsidian/plugins/smart-list-tweaks/`. This plugin has no `styles.css`.

## Releasing

Follow the sample plugin's process.

- Update `minAppVersion` in `manifest.json` if needed, then run `npm version patch|minor|major`. This updates `manifest.json`, `package.json`, and `versions.json`.
- Push the tag (the version number without a leading `v`), and `.github/workflows/release.yml` creates a draft release with `main.js` and `manifest.json` attached.

## License

[MIT](LICENSE)
