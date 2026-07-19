# AST - AI Subtitle Translator - Chrome ウェブストア紹介文

## ストア掲載の基本情報

- 商品名: AST - AI Subtitle Translator
- 一言紹介: Udemy、YouTube、NVIDIA Academy、Vimeo の字幕を目的の言語に翻訳し、動画の上に表示する Chrome 拡張機能です。
- 短い説明: AI による文脈を考慮した翻訳と高速な一時翻訳で、Udemy・YouTube・NVIDIA Academy・Vimeo の字幕をより自然に読めます。

## Chrome Web Store アップロード画像

- [marquee-promo-tile.png](marquee-promo-tile.png): 1400×560 のプロモーション marquee 画像
- [small-promo-tile.png](small-promo-tile.png): 440×280 の小型プロモーションタイル画像

## 詳細説明

AST - AI Subtitle Translator は、Udemy 講座、YouTube 動画、NVIDIA Academy 講座、Vimeo 動画の字幕を目的の言語に翻訳し、動画の上に直接表示します。

Google Translate で字幕をすばやく確認したり、OpenAI、Anthropic、Google AI などの AI プロバイダーを選んで動画全体の流れを考慮した翻訳を表示したりできます。AI 翻訳の準備中は、元の字幕または高速な一時翻訳が先に表示されます。

動画コントロールの AST アイコンから AST メニューを開き、字幕の表示を切り替えられます。メニューから、動画が提供する元字幕の言語と翻訳スタイルも直接選択できます。別のプレーヤーコントロールを選ぶと、AST メニューは自動的に閉じるため、プレーヤーメニューと重なりません。動画上で字幕ボックスを移動・サイズ変更し、Options ページで言語、翻訳プロバイダー、フォント、色、影、アウトライン、背景を設定できます。

## 主な機能

- Udemy 講座、YouTube 動画、NVIDIA Academy 講座、Vimeo 動画の字幕翻訳
- 動画が提供する元字幕の言語選択
- 動画の流れを考慮した AI 文脈翻訳
- Google Translate による高速な一時翻訳
- 動画上での字幕表示、移動、幅の調整
- フォント、色、影、アウトライン、背景スタイルの設定
- Natural、Lecture、Technical、Custom 1、Custom 2 の翻訳スタイル
- モデル取得後の推奨モデル自動選択とオンラインプロバイダー接続確認
- 長い動画の字幕翻訳と翻訳キャッシュ
- API キーを含む設定のパスワード暗号化バックアップ／復元
- 復元した API キーの任意一括接続確認
- AI 翻訳に失敗した場合も元字幕または高速翻訳を維持

## 対応サイトと翻訳プロバイダー

- 対応サイト: Udemy 講座プレーヤー、YouTube 動画ページ、NVIDIA Academy 講座、Vimeo 動画ページ
- 翻訳プロバイダー: Google Translate、DeepL、OpenAI、Anthropic、Google AI、OpenRouter、NVIDIA NIM、Custom LLM
- 動画内の AST メニューから字幕のオン／オフ、元字幕の言語・翻訳プロバイダー・翻訳スタイルの選択、設定画面を開く操作が可能

Udemy ではユーザーが受講できる講座の字幕が必要です。YouTube、NVIDIA Academy、Vimeo では動画が提供する字幕が必要です。

## 使い方

1. 拡張機能をインストールし、Options ページで対象言語と翻訳プロバイダーを設定します。
2. API キーが必要なプロバイダーを使う場合は、そのプロバイダーで作成した API キーを入力します。
3. Udemy 講座、YouTube 動画、NVIDIA Academy 講座、または Vimeo 動画を開き、動画コントロールの字幕翻訳アイコンをクリックします。必要に応じて、メニューから元字幕の言語と翻訳スタイルを変更します。
4. 必要に応じて Options ページで字幕スタイルを調整します。

## 初めて使う場合の推奨設定

- 無料で始める場合: [Google AI Studio で API キーを作成](https://aistudio.google.com/api-keys)し、Google AI プロバイダーと `gemini-3.1-flash-lite` を選択してください。Gemini 3.1 Flash-Lite は低遅延とコスト効率を重視したモデルで、翻訳の開始モデルとして適しています。
- Google AI 無料枠の 1 日あたりのリクエスト上限（RPD）は、日本時間では通常、米国の夏時間は午後 4 時、標準時間は午後 5 時にリセットされます。利用可能な無料枠と上限はアカウントやモデルによって異なるため、AI Studio で確認してください。
- 字幕翻訳は比較的明確な入出力タスクなので、最大のフロンティアモデルではなく、小さく高速なモデルから始めることを推奨します。Gemini 3.1 Flash-Lite、GPT-5.6 Luna、Claude Haiku 4.5 などが良い開始点です。より高い品質が必要な場合にのみ、大きなモデルを選択してください。
- 有料利用の推奨: OpenRouter プロバイダーで `deepseek/deepseek-v4-flash` を選択してください。高速かつコスト効率の高いモデルで、有料翻訳のコストパフォーマンスに優れた開始点として推奨します。最新の価格と上限は OpenRouter で確認してください。

## プライバシーとデータの取り扱い

プライバシーポリシー: [韓国語](../PRIVACY.md) · [英語](../PRIVACY_en.md) · [日本語](../PRIVACY_ja.md)

- 字幕テキストは、ユーザーが選択した翻訳プロバイダーに送信される場合があります。
- API キー、設定、翻訳キャッシュはユーザーのブラウザー内にのみ保存されます。
- API キーはブラウザーの保存領域にプロバイダー別の暗号文として保存され、設定データに平文の API キーは残りません。
- storage へのアクセスは trusted extension context に限定し、API key を content script へ公開しません。
- この拡張機能は、独自サーバーや外部データベースに API キーを保存しません。
- API キーは、認証が必要な場合にのみ選択したプロバイダーへ直接送信されます。
- Hosted provider は公式 HTTPS origin のみに制限します。Custom LLM は `localhost`/`127.0.0.1` の HTTP または HTTPS と、モデル取得または接続テスト時にユーザーがアクセスを許可したカスタム HTTPS origin を使用でき、redirect 応答を自動追跡しません。
