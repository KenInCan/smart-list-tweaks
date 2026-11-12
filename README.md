# Smart List Tweaks

Obsidian の **Smart lists**（設定 → エディタ → Smart lists）が担うリストの挙動を、機能ごとにオン/オフする Obsidian プラグインです。**Smart lists 自体がオンでもオフでも、このプラグインの設定どおりに動きます。**

Obsidian 1.15 では、Smart lists がオンのとき、インデント・行移動・Enter で「ネストされた子要素も一緒に動く」ようになりました。このプラグインでは、そうした挙動を 1 つずつオン/オフできます。初期値は 1.14 の挙動に合わせています。

## 設定項目

どの設定も「**オン ＝ その動作が働く**」という意味でそろえています。

| 見出し | 設定 | 初期値 | オンのとき | オフのとき |
|---|---|---|---|---|
| Indent | Indent nested items along | オフ | Tab / Shift-Tab / Mod-] / Mod-[ と「Indent list」「Unindent list」で子要素も動く（1.15 の標準） | 現在行（選択中なら選択した行）だけをインデントする。深さの制限もない |
| Move line | Move nested items along | オフ | 「Move line up/down」で、リスト項目を子要素ごとまとめて動かす | 現在行（選択中なら選択した行）だけが動く |
| Move line | Skip blank lines | オフ | 「Move line up/down」で空行を飛ばし、空行はその場に残す | 空行も 1 行として入れ替える |
| Enter | Continue the list | オン | Enter で、同じ記号・次の番号・空のチェックボックス付きの新しい項目を作る | インデントだけ保った普通の改行（Smart lists オフのときと同じ） |
| Enter | Add as first nested item | オフ | 子要素がある項目の末尾の Enter で、最初の子要素として追加する（1.15 の標準） | すぐ下に同じ階層の項目を追加する（1.14） |
| Enter | Add after folded items | オン | 折りたたみ中の項目の末尾の Enter で、折りたたまれた範囲の後ろに追加する（1.15 の標準） | その行のすぐ下（折りたたまれた範囲の中）に追加する（1.14） |
| Numbered lists | Renumber automatically | オン | 番号付きリストを編集すると、後ろの番号を振り直す | 入力した番号をそのまま残す |

- どの設定も、Smart lists のオン/オフに関係なく働きます。
  - Smart lists がオンのとき：Obsidian 本来の処理を使い、設定と違う部分だけをプラグインが差し替えます。
  - Smart lists がオフのとき：Obsidian 本来の処理が動かない機能は、プラグインが代わりに行います。リストの継続は Obsidian 自身の処理を呼び出し、それ以外（子要素ごとのインデント、最初の子要素としての追加、折りたたみの後ろへの追加、番号の振り直し）は 1.15.0 の処理をプラグイン内に移植しています。
- Smart lists オフで「Continue the list」がオンのときは、Shift+Enter も Smart lists と同じ「記号なしでインデントだけ保つ改行」になります。
- 「Continue the list」がオフのときは、その下の 2 つの Enter の設定は関係なくなります。
- 行移動の 2 つの設定は組み合わせて使えます。
  - 両方オフ：1 行ずつ単純に入れ替える（1.14 と同じ）
  - 子要素だけオン：子要素ごと動かし、空行とも入れ替わる
  - 空行だけオン：現在行だけが、空行の先の行と入れ替わる
  - 両方オン：Obsidian 1.15 の標準の動作（Smart lists がオンなら、Obsidian 本来のコマンドを呼ぶ）
- 行移動の設定は、Smart lists のオン/オフに関係なく働きます（両方オンかつ Smart lists オンの場合を除く）。
- 行移動のコマンドは、ID・名前・ホットキーをそのままに、中身だけを差し替えています。ホットキーを設定し直す必要はありません。プラグインを無効にすると元に戻ります。
- カーソルが複数あるときの行移動は、単純な 1 行ずつの入れ替えになります。
- 0.1.0 / 0.2.0 の設定は、意味を合わせて自動で引き継ぎます。

## 制限・注意

- 次の非公開 API に依存しています。Obsidian の更新で使えなくなった場合は、その機能だけが標準の動作に戻ります（エラーにはなりません）。
  - Smart lists の設定値の読み取り
  - 組み込みコマンドの差し替え
  - Obsidian 自身のリスト継続処理の呼び出し
- 自動振り直しのオフ（Smart lists オンのとき）は、Obsidian が振り直した番号を、同じ編集の中で元に戻す方式です。番号以外の差分（他のプラグインによる書き換えなど）が混ざっている編集には手を出しません。
- Smart lists オフのときの振り直しは、1.15.0 の処理の移植です。ただし Obsidian 内部でしか分からない条件（同期による変更、表のセル内の編集など）は判定できないので、それらの編集でも振り直しが走ることがあります。
- Smart lists オフのときの「子要素」の判定は、行移動と同じプラグイン独自の判定（一段以上深い行）です。Obsidian 本体の判定とは細部が異なる場合があります。
- **Outliner** プラグインと併用する場合、Tab / Shift-Tab と行移動は、どちらか一方だけで有効にしてください。どちらも Tab を最優先で処理するため、両方有効だと、読み込み順によってどちらが効くか変わります。
- Vim モードの `>>` / `<<` など、上記以外の経路から呼ばれるインデントには作用しません。
- Obsidian 1.15.1（デスクトップは早期アクセス版のみ）の「選択中は子要素を動かさない」「2 階層以上深くインデントしない」という変更は、ソースでは確認できていません。ただし、このプラグインのインデントは Obsidian 側の処理を通らないので、どちらの影響も受けません。

## 開発

[obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) をテンプレートにしています。ビルド方法と開発手順は、サンプルプラグインと同じです。

- Node.js 18 以上が必要です（`node --version` で確認）。
- `npm i` で依存関係をインストールします。
- `npm run dev` を実行すると、`src/main.ts` が監視モードで `main.js` にコンパイルされます。
- `npm run build` で本番ビルドをします（型チェックも行います）。
- `npm run lint` で ESLint（`eslint-plugin-obsidianmd`）を実行します。
- Obsidian API を更新するときは、`npm update` を実行します。

開発用フォルダを `<Vault>/.obsidian/plugins/smart-list-tweaks/` に置いて Obsidian を再読み込みし、**設定 → コミュニティプラグイン**で有効にします。

`@codemirror/*` はビルド時に外部モジュール扱いとなり、実行時には Obsidian 本体のものが使われます。そのため `package.json` の `overrides` で、`@codemirror/state` と `@codemirror/view` を `obsidian` パッケージが指定する版に固定しています。

### ソース構成

```
src/
  main.ts                    # ライフサイクル、キーマップと拡張の登録
  settings.ts                # 設定の型・初期値・設定タブ
  features/
    indent.ts                # インデント / インデント解除（行単位・子要素ごと）
    enter.ts                 # Enter / Shift+Enter（継続・最初の子要素・折りたたみ）
    moveLine.ts              # 行移動（子要素・空行の扱いを個別に切り替え）
    renumber.ts              # 自動振り直し（打ち消し・Smart lists オフ時の自前の振り直し）
    commands.ts              # 組み込みコマンドの差し替え
  utils/
    listSyntax.ts            # リスト行の解析
    listBlocks.ts            # 「項目＋子要素」の範囲の判定
    obsidianInternals.ts     # 非公開 API へのアクセスをここに集約
```

## 手動インストール

`main.js` と `manifest.json` を `<Vault>/.obsidian/plugins/smart-list-tweaks/` にコピーします。このプラグインには `styles.css` はありません。

## リリース

サンプルプラグインの手順に従います。

- `manifest.json` の `minAppVersion` を必要に応じて更新し、`npm version patch|minor|major` を実行します。`manifest.json`、`package.json`、`versions.json` が更新されます。
- タグ（`v` を付けないバージョン番号）を push すると、`.github/workflows/release.yml` が `main.js` と `manifest.json` を添付した下書きリリースを作ります。
