# AI Subtitle Translator プライバシーポリシー

[한국어](PRIVACY.md) · [English](PRIVACY_en.md) · [日本語](PRIVACY_ja.md)

施行日: 2026年7月13日

AI Subtitle Translator は、Udemy と YouTube の字幕をユーザーが選択した翻訳サービスで翻訳する Chrome 拡張機能です。開発者は独自の backend server を運用せず、広告、追跡、分析を目的としてユーザーデータを収集しません。

## 取り扱うデータ

- Udemy と YouTube の字幕テキストおよび cue の時間情報
- 現在の動画または講義を識別する URL、video ID、course ID、lecture ID、字幕言語情報
- ユーザーが入力した翻訳 provider の API key、endpoint、model、翻訳設定、字幕設定
- 翻訳結果のキャッシュと、ユーザーが作成する暗号化設定バックアップファイル

## 利用目的

これらのデータは、字幕の取得、翻訳リクエスト、翻訳結果の表示、ユーザー設定の保持、設定のバックアップと復元のためにのみ使用します。パーソナライズ広告、ユーザー profiling、データ販売には使用しません。

## 保存と保持期間

- 設定、翻訳キャッシュ、API key はユーザーのブラウザーの `chrome.storage.local` に保存します。
- API key は provider ごとの AES-GCM 暗号文として保存し、一般設定には平文で残しません。復号に必要な断片も同じブラウザープロファイル内にあるため、OS の secure storage やユーザー master password を使用する vault と同等ではありません。
- storage へのアクセスは trusted extension context に限定し、content script は API key または復号用断片へ直接アクセスできません。
- 設定バックアップはユーザーが入力したパスワードで AES-GCM 暗号化し、パスワードは保存しません。
- 翻訳キャッシュの削除と全設定の初期化が可能です。拡張機能を削除すると Chrome が extension-local storage を削除します。ダウンロード済みの `.astbackup` ファイルはユーザーが削除する必要があります。

## 外部への送信

- 字幕テキストと翻訳設定は、ユーザーが選択した Google Translate、DeepL、OpenAI、Anthropic、Google AI、OpenRouter、NVIDIA NIM、または Custom LLM endpoint に送信される場合があります。
- API key は認証が必要な場合に選択した provider へ直接送信され、開発者の server には送信されません。
- Udemy と YouTube の字幕取得リクエストには動画・講義識別子とユーザーの login cookie が含まれる場合があります。拡張機能は cookie 値を別途保存しません。
- 既定またはカスタム Web font を使用すると、Google Fonts、jsDelivr、またはユーザー提供 CSS で指定した font host へリクエストが送信される場合があります。
- 外部サービスによるデータ処理には各サービスのプライバシーポリシーと利用規約が適用されます。

## 権限

- `storage`: 設定、暗号化された API key、翻訳キャッシュをローカルに保存します。
- Host permissions: Udemy・YouTube の字幕取得、選択した翻訳 provider の呼び出し、`localhost`/`127.0.0.1` の Custom LLM への接続に使用します。カスタム HTTPS Custom LLM domain には、モデル取得または接続テスト時にユーザーが許可した場合のみアクセスします。

## Google API Limited Use

Google API から受け取った情報の使用は、Limited Use 要件を含む [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use) に従います。

## セキュリティ

すべてのリモート provider リクエストは HTTPS を使用します。Custom LLM はローカル LLM とユーザーが運用するカスタムサーバーの両方に対応します。ユーザー自身のコンピューターで動作するローカル LLM は `localhost` または `127.0.0.1` の HTTP endpoint を使用でき、カスタムサーバーには HTTPS とユーザーによる runtime domain アクセスの許可が必要です。hosted provider の Base URL は各 provider の公式 HTTPS origin に制限し、redirect 応答を自動追跡しません。

## 問い合わせと変更

プライバシーに関する質問とセキュリティ報告は [GitHub Issues](https://github.com/mungi/llm-subtitle-translator/issues) を利用してください。重要な変更はこの文書の施行日とリポジトリの変更履歴に反映します。
