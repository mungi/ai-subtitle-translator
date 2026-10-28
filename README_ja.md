# AST - AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

Udemy、YouTube、TED、NVIDIA Academy、Vimeo の字幕を翻訳し、動画上に表示する Chrome Manifest V3 拡張機能です。すぐに Google Translate を使用することも、LLM プロバイダーを接続して文脈を反映した翻訳を利用することもできます。

紹介サイト: <https://mungi.github.io/ai-subtitle-translator/>

Chrome 102 以降が必要です。

## 主な機能

- Udemy、YouTube、TED、NVIDIA Academy、Vimeo から字幕を取得し、原文または翻訳字幕を表示します。
- AST メニューから、現在の動画で提供されている元字幕の言語と翻訳スタイルを直接選択できます。
- YouTube では実際のプレーヤーの字幕レスポンスを優先し、発話の進行に合わせて原文の文字色を濃いグレーから設定した色に変えます。単語の時刻情報がない場合は字幕キューの時刻から進行を推定し、翻訳文はキュー単位で表示します。広告中は AST 字幕を非表示にします。
- Google Translate、DeepL、OpenAI、Anthropic、Google AI、OpenRouter、NVIDIA NIM、Custom LLM に対応しています。
- LLM 翻訳では字幕全体の文脈と現在の再生位置を考慮し、長い動画は分割して処理します。
- Natural、Lecture、Technical、カスタムの翻訳スタイルを提供します。
- 字幕の位置、サイズ、フォント、色、影、縁取り、背景を調整できます。
- 翻訳結果をキャッシュし、LLM のクォータを超過した場合は Google Translate に切り替えて翻訳します。
- プロバイダー接続テスト、モデル一覧の取得、設定のバックアップと復元を提供します。

## インストール

1. Chrome で `chrome://extensions` を開きます。
2. **デベロッパー モード**を有効にします。
3. **パッケージ化されていない拡張機能を読み込む**を選択します。
4. このリポジトリの `extension/` フォルダーを選択します。
5. 拡張機能のオプションで翻訳プロバイダーと対象言語を設定します。

字幕取得機能を適用するには、拡張機能を再読み込みした後、開いていた YouTube ページも更新してください。`scripting` 権限は YouTube ページの開始時からプレーヤーの字幕レスポンスを取得するために使用します。

## すぐに始める

1. 拡張機能のオプションを開きます。初期表示は **かんたん設定** です。
2. API キーを入力しなくても、Google Translate で字幕を翻訳できます。
3. Google Gemini を使用する場合は、[Google AI Studio API Keys](https://aistudio.google.com/api-keys) でキーを作成し、**Google AI API キー**に貼り付けて **API キーを確認** を選択します。成功すると Gemini 3.1 Flash Lite が自動設定されます。
4. 他の翻訳プロバイダー、字幕の見た目、バックアップと復元は **詳細設定** で調整します。

## 使用方法

1. 字幕がある Udemy 講義、YouTube 動画、TED 動画、NVIDIA Academy 講義、または Vimeo 動画を開きます。
2. 動画ツールバーの AST アイコンを選択してメニューを開きます。
3. メニューで元字幕の言語、翻訳プロバイダー、翻訳スタイルを選択するか、設定画面を開きます。
4. **字幕表示** サブメニューで **二重字幕**、**原文字幕**、**翻訳字幕** を選択します。初期値は **翻訳字幕** です。**原文字幕** は選択した元の言語で表示し、**二重字幕** は原文を上、翻訳を下に表示します。翻訳待ちや失敗時には原文を維持します。表示モードは対応サイト間で共有され、次回以降も保存されます。

ペルシャ語とアラビア語の字幕は右から左に表示します。二重字幕は原文と翻訳の文字方向を個別に処理し、動画上では中央揃えを維持します。Udemy のトランスクリプトの翻訳は、その言語の文字方向の先頭に揃えます。

LLM プロバイダーを選択すると、現在の再生位置付近の字幕を優先して翻訳し、その後に残りの字幕を処理します。翻訳中も原文または一時的な翻訳字幕を表示し続けることができます。

翻訳品質の試験は [Chrome 内蔵翻訳と Google Translate の比較](docs/translation-comparison-ja.md)をご覧ください。Chrome Translator API は現在、拡張機能に統合されていません。

## Custom LLM の設定

Custom LLM は、ローカル LLM とユーザーが運用する OpenAI 互換 `chat/completions` サーバーの両方に対応します。最終リクエスト URL の `/chat/completions` より前の部分だけを Base URL に入力します。`localhost` と `127.0.0.1` は HTTP または HTTPS を使用でき、外部のカスタムサーバーは HTTPS のみ使用できます。外部サーバーを使用するには、モデル取得または接続テスト時にそのドメインへのアクセスを許可してください。字幕テキストと、入力した場合は API キーがそのサーバーへ直接送信されます。

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
```

## プライバシーと制限事項

- Google Translate は API キー不要の非公式 Web 翻訳連携を使用します。公式 Google Cloud Translation API とは異なり、リクエスト制限やサービス変更で失敗する場合があります。
- 字幕テキストは、選択した翻訳プロバイダーに送信される場合があります。各プロバイダーの利用規約と料金を確認してください。
- Udemy の字幕へのアクセスは、ログイン状態と受講権限に依存します。
- API キーはローカルストレージに暗号化して保存し、content script には渡しません。マスターパスワードを要求しない利便性重視の設計のため、専用のシークレット管理ツールと同等のセキュリティは提供しません。
- API キーを画面共有や公開文書に載せないでください。漏えいが疑われる場合は、プロバイダーのコンソールで直ちにキーを無効化し、新しいキーを作成してください。

詳細は、プライバシーポリシーの[韓国語](PRIVACY.md)、[英語](PRIVACY_en.md)、[日本語](PRIVACY_ja.md)をご覧ください。

## 開発と検証

```text
npm test
npm run check
```

`npm run check` は Unix の `find` と `xargs` を使用するため、Windows では Git Bash または WSL で実行してください。

設計と実装の詳細は、[Design.md](Design.md)、[コード分析](docs/code-analysis.md)、[TASKS.md](TASKS.md)をご覧ください。

## リリースパッケージ

リリースタグが現在のコミットを指している状態で、Chrome Web Store 用 ZIP パッケージを作成します。スクリプトは ZIP を作成し、GitHub Release を作成または更新して ZIP を添付します。

```text
./release.sh
```

生成される `release/ai-subtitle-translator-v<タグ>.zip` は、GitHub Release のアセットおよび Chrome Web Store のパッケージとして使用します。

## ライセンス

このプロジェクトは [MIT License](LICENSE) の下で提供されます。
