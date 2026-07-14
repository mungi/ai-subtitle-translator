# AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

Udemy、YouTube、NVIDIA Academy、Vimeo の字幕を翻訳し、動画上に表示する Chrome Manifest V3 拡張機能です。すぐに Google Translate を使用することも、LLM プロバイダーを接続して文脈を反映した翻訳を利用することもできます。

Chrome 102 以降が必要です。

## 主な機能

- Udemy、YouTube、NVIDIA Academy、Vimeo から字幕を取得し、原文または翻訳字幕を表示します。
- AST メニューから、現在の動画で提供されている元字幕の言語と翻訳スタイルを直接選択できます。
- Google Translate、DeepL、OpenAI、Anthropic、Google AI、OpenRouter、NVIDIA NIM、Custom LLM に対応しています。
- LLM 翻訳では字幕全体の文脈と現在の再生位置を考慮し、長い動画は分割して処理します。
- Natural、Lecture、Technical、カスタムの翻訳スタイルを提供します。
- 字幕の位置、サイズ、フォント、色、影、縁取り、背景を調整できます。
- 翻訳結果をキャッシュし、LLM のクォータを超過した場合は Google Translate に代替します。
- プロバイダー接続テスト、モデル一覧の取得、設定のバックアップと復元を提供します。

## インストール

1. Chrome で `chrome://extensions` を開きます。
2. **デベロッパー モード**を有効にします。
3. **パッケージ化されていない拡張機能を読み込む**を選択します。
4. このリポジトリの `extension/` フォルダーを選択します。
5. 拡張機能のオプションで翻訳プロバイダーと対象言語を設定します。

## 使用方法

1. 字幕がある Udemy 講義、YouTube 動画、NVIDIA Academy 講義、または Vimeo 動画を開きます。
2. 動画ツールバーの AST アイコンを選択して字幕を有効にします。
3. メニューで元字幕の言語、翻訳プロバイダー、翻訳スタイルを選択するか、設定画面を開きます。

LLM プロバイダーを選択すると、現在の再生位置付近の字幕を優先して翻訳し、その後に残りの字幕を処理します。翻訳中も原文または一時翻訳の字幕を表示し続けることができます。

## Custom LLM の設定

Custom LLM は、ローカル LLM とユーザーが運用する OpenAI 互換 `chat/completions` サーバーの両方に対応します。最終リクエスト URL の `/chat/completions` より前の部分だけを Base URL に入力します。`localhost` と `127.0.0.1` は HTTP または HTTPS を使用でき、外部のカスタムサーバーは HTTPS のみ使用できます。外部サーバーを使用するには、モデル取得または接続テスト時にそのドメインへのアクセスを許可してください。字幕テキストと、入力した場合は API キーがそのサーバーへ直接送信されます。

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
```

## プライバシーと制限事項

- 字幕テキストは、選択した翻訳プロバイダーに送信される場合があります。各プロバイダーの利用規約と料金を確認してください。
- Udemy の字幕へのアクセスは、ログイン状態と受講権限に依存します。
- API キーはローカルストレージに暗号化して保存し、content script には渡しません。マスターパスワードを要求しない利便性重視の設計のため、専用のシークレット管理ツールと同等のセキュリティは提供しません。

詳細は、プライバシーポリシーの[韓国語](PRIVACY.md)、[英語](PRIVACY_en.md)、[日本語](PRIVACY_ja.md)をご覧ください。

## 開発と検証

```text
npm test
npm run check
```

設計と実装の詳細は、[Design.md](Design.md)、[CONTEXT.md](CONTEXT.md)、[TASKS.md](TASKS.md)をご覧ください。

## リリースパッケージ

リリースタグが現在のコミットを指している状態で、Chrome Web Store 用 ZIP パッケージを作成します。

```text
./release.sh
```

生成される `release/ai-subtitle-translator-v<タグ>.zip` は、GitHub Release のアセットおよび Chrome Web Store のパッケージとして使用します。
