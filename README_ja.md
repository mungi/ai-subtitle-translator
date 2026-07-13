# AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

Udemy と YouTube の字幕を収集し、Google Translate または LLM プロバイダーで翻訳して動画上に表示する Chrome Manifest V3 拡張機能です。

Chrome 102 以降が必要です。

## 主な機能

- Udemy 講義の字幕トラックを収集し、WebVTT cue を解析
- YouTube の caption track を収集し、XML、JSON3、SRV3、WebVTT、transcript panel の cue を解析
- Google Translate による cue 単位の一時翻訳
- OpenAI、Anthropic、Google AI、OpenRouter、NVIDIA NIM、Local LLM、DeepL プロバイダーに対応
- OpenAI、Anthropic、Gemini、OpenRouter、NVIDIA NIM、Local LLM のモデル一覧取得
- モデル取得後に多言語対応の軽量推奨モデルを自動選択し、接続をテスト
- 字幕 JSON 全体を対象とした LLM 翻訳
- Natural、Lecture、Technical、Custom 1、Custom 2 の翻訳スタイルと、スタイル別 system prompt
- 長い動画向けの chunk 翻訳と翻訳キャッシュ

LLM 翻訳では、現在の再生位置から最初の 1 分を優先して処理します。その後、以降の区間を既定で最大 7 分ごとの chunk に分けて処理し、最後に以前の区間を処理します。設定では chunk の最大時間を 2〜15 分に調整でき、内部では 24,000 文字・500 cue の安全上限も適用されます。応答が不完全な場合は、該当 chunk のみを半分に分割して再試行します。

- LLM 翻訳に失敗した場合は Google Translate に fallback
- Google Translate と DeepL を含む利用可能なプロバイダーを最終翻訳プロバイダーとして直接選択可能
- 動画ツールバーの AST アイコンから字幕のオン/オフ、プロバイダー変更、設定画面を提供
- 他の動画ツールバーアイコンを選ぶと AST メニューを自動で閉じ、プレーヤーメニューとの重なりを防止
- プロバイダー変更時は現在の再生位置から優先翻訳し、選択した Google 以外のプロバイダーにのみ進行アニメーションを表示

## AST ツールバーアイコンの状態

- 白: AST がオフ、または原文字幕を表示中です。
- 青: AST が有効で、翻訳字幕を準備中または表示中です。
- 黄: 最終 LLM 翻訳を待つ間、一時翻訳を表示中です。
- 緑: 現在再生中の cue の最終翻訳が準備できました。
- 紫: 字幕全体の最終翻訳が完了しました。
- ピンク: 選択したプロバイダーのクォータ超過などにより、Google Translate の代替翻訳を使用中です。
- アイコンがわずかに点滅する場合、字幕または翻訳リクエストを準備中であることを示します。
- 字幕オーバーレイはドラッグで移動できます。
- 字幕ウィンドウの角を使って手動でサイズを変更でき、幅は保存されます。
- 字幕のフォント、Web フォント、色、影、縁取り、背景スタイルを設定できます。
- API key は AES-GCM で暗号化して保存し、保存済みの値はマスクして表示します。
- content script から storage への直接アクセスを防ぎ、secret を除外した設定 bridge のみを提供します。
- hosted provider は公式 HTTPS origin、Local LLM endpoint は loopback host に制限します。
- ユーザーのパスワードで暗号化した設定のバックアップと復元を提供します。
- ブラウザー言語に基づく設定 UI と既定 target language を提供します。

## 拡張機能の読み込み

1. Chrome で `chrome://extensions` を開きます。
2. デベロッパー モードを有効にします。
3. **パッケージ化されていない拡張機能を読み込む** を選択します。
4. このリポジトリの `extension/` フォルダーを選択します。
5. 拡張機能のオプションでプロバイダーと target language を設定します。

## ドキュメント

- [Design.md](Design.md): 現在の設計判断と主なランタイムフロー。（韓国語）
- [CONTEXT.md](CONTEXT.md): 実装の概要と現在のリポジトリコンテキスト。（韓国語）
- [TASKS.md](TASKS.md): 完了項目、検証済み項目、手動 QA チェックリスト。（韓国語）
- [docs/code-analysis.md](docs/code-analysis.md): ファイルごとの責務、メッセージ契約、テストとリスク分析。（韓国語）
- Chrome Web Store 紹介文: [韓国語](docs/chrome-web-store-ko.md)、[英語](docs/chrome-web-store-en.md)、[日本語](docs/chrome-web-store-ja.md)。
- プライバシーポリシー: [韓国語](PRIVACY.md)、[英語](PRIVACY_en.md)、[日本語](PRIVACY_ja.md)。

## Local LLM Base URL

OpenAI 互換の `chat/completions` サーバーでは、最終リクエスト URL の `/chat/completions` 直前までを Base URL に入力します。
セキュリティ上、host は `localhost` または `127.0.0.1` のみ許可します。

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
Model: OpenAI 互換サーバーが提供するモデル名
```

## Provider API の参考情報

- DeepL: Free/Pro プランに合う endpoint を使用します。Free プランには月間文字数制限があります。参考: https://developers.deepl.com/docs/resources/usage-limits, https://www.deepl.com/pro-api
- OpenAI: 利用制限と料金はアカウント、モデル、tier により異なります。参考: https://developers.openai.com/api/docs/guides/rate-limits, https://developers.openai.com/api/docs/pricing
- Anthropic: 利用制限と料金はアカウント、モデル、tier により異なります。参考: https://platform.claude.com/docs/en/api/rate-limits, https://platform.claude.com/docs/en/about-claude/pricing
- Google AI: Gemini API の利用制限と料金は project、model、tier により異なります。API key: https://aistudio.google.com/api-keys。参考: https://ai.google.dev/gemini-api/docs/rate-limits, https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter: 無料プランと無料モデル API には利用制限があります。参考: https://openrouter.ai/pricing, https://openrouter.ai/docs/api/reference/limits
- NVIDIA NIM: NVIDIA API Catalog の無料 endpoint は開発・プロトタイピング向けで、モデルやアカウントごとの利用制限が適用されることがあります。参考: https://build.nvidia.com/explore/discover, https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317

## 推奨既定モデル

- Google AI: `gemini-3.1-flash-lite`
- OpenAI: `gpt-5.6-luna`
- Anthropic: `claude-haiku-4-5-20251001`
- OpenRouter: `deepseek/deepseek-v4-flash` (`DeepSeek: DeepSeek V4 Flash`)
- NVIDIA NIM: `openai/gpt-oss-120b`
- Local LLM は `google/gemma-4-e4b` が利用可能なら優先し、なければ小型の Qwen または Gemma instruct 系を選択します。
- オンラインプロバイダーはモデル取得に成功すると推奨モデルを保存し、直ちに最小限の接続テストを実行します。成功したプロバイダーのみ接続成功状態に更新します。
- Local LLM のモデル取得はモデル選択のみを行い、自動接続テストは実行しません。

## 字幕スタイル

- 既定フォントは Pretendard Web フォントです。
- カスタム Web フォントには Noonnu の「Web フォントとして使用」CSS を貼り付けて使用できます。
- 縁取りには Chrome の `-webkit-text-stroke` を使用します。
- 影は右下の対角方向の距離と blur を設定します。
- 字幕オーバーレイはドラッグで移動し、右下の角で幅を手動調整できます。

## 設定のバックアップと復元

- オプション画面の最下部で、API key を含む現在の設定を暗号化された `.astbackup` ファイルにバックアップまたは復元できます。
- **設定をバックアップ** を選ぶと、マスクされた専用ポップアップでバックアップ用パスワードを入力します。復元時もファイル選択後に同じ方式で入力します。
- バックアップ用パスワードは 10 文字以上で、英字、数字、特殊文字をそれぞれ含む必要があります。途中の通常の space は許可されますが、前後の空白、tab、改行は許可されません。
- 各バックアップではランダムな salt と nonce を生成し、PBKDF2-SHA-256 でパスワードから AES-GCM key を導出します。
- パスワードは拡張機能にもバックアップファイルにも保存されません。忘れた場合はバックアップを復元できません。
- 翻訳キャッシュはバックアップ対象に含まれません。
- 復元用ファイル選択画面には `.astbackup` ファイルのみを表示し、他の拡張子は拒否します。
- 復元用ファイル選択画面は最初に OS の Downloads フォルダーから開始し、対応環境では最後に復元で使用した場所を記憶します。対応していない環境では既定のファイル選択画面を使用します。
- 復元後、ユーザーは API key が入力された各プロバイダーの接続テストを実行し、成功状態を更新することを選べます。

## QA チェックリスト

- ローカル自動検証:

```text
npm test
npm run check
```

- ログイン済みで、購入または受講可能な Udemy 講義ページを開きます。
- 動画コントロール領域に拡張機能ボタンが表示されることを確認します。
- AST メニューを開いた状態で字幕や設定など別の動画ツールバーアイコンを選び、AST メニューが閉じることを確認します。
- 字幕のある講義で、Google cue 翻訳が最初に黄色状態で表示されることを確認します。
- LLM プロバイダー選択時、翻訳完了後に最終字幕へ置き換わることを確認します。
- 別の講義へ移動したとき、前の講義の字幕が混在しないことを確認します。
- Options でプロバイダー接続テスト、モデル一覧取得、キャッシュ削除が動作することを確認します。

## 制限事項

- Udemy API 呼び出しはユーザーのログイン cookie と受講権限に依存します。
- API key は provider ごとの AES-GCM 暗号文として `chrome.storage.local` に保存され、復号材料は変換された 3 つの断片に分散保存されます。オプション画面では保存済み API key をマスクします。
- master password の入力なしに自動復号する利便性優先の設計です。通常の平文 secret 収集は困難にしますが、拡張機能コードとローカル保存領域の両方を分析する標的型攻撃に対する安全な vault ではありません。
- storage へのアクセスは trusted extension context に限定し、API key を content script へ公開しません。
- Hosted provider は公式 HTTPS origin、Local LLM は `localhost` または `127.0.0.1` に限定し、redirect 応答を自動追跡しません。
- 字幕テキストはユーザーが選択した翻訳プロバイダーへ送信される場合があります。
