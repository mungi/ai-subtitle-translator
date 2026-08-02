# AST - AI Subtitle Translator

次のウェブサイトの動画字幕を、LLM ベースの AI で希望する言語へ自然に翻訳します。
  - Udemy: https://www.udemy.com/
  - NVIDIA Academy: https://www.nvidia.com/en-us/training/academy/
  - YouTube: https://www.youtube.com/
  - Vimeo: https://vimeo.com/
  - TED: https://www.ted.com/

# 主な特徴
  - Google 翻訳で字幕をすばやく翻訳するか、LLM を接続して文脈を考慮した自然な翻訳を利用できます。
  - プロンプトを使って翻訳スタイルを指定できます。
  - 字幕の表示スタイルを直接、幅広く変更できます。
  - 多様な LLM プロバイダーに対応しています。
    - Google Gemini、OpenAI GPT、Anthropic Claude、DeepL、NVIDIA NIM、OpenRouter、Custom LLM

# 注意事項
  - Google 翻訳以外のプロバイダーには API キーが必要です。
  - Google AI API キーを作成して無料枠の Gemini 3.1 Flash Lite を接続すると、応答の速い AI 翻訳を開始できます。（推奨）
  - 無料利用枠、制限、発生する料金は、各 LLM API プロバイダーのポリシーを確認してください。

# 主な機能
  - Udemy、NVIDIA Academy、YouTube、TED、Vimeo 動画の字幕翻訳
  - 原文字幕の流れを考慮した AI 文脈翻訳
  - Google 翻訳による高速翻訳を標準搭載
  - LLM 翻訳の準備中は高速翻訳を先に表示
  - 動画が提供する字幕言語を翻訳元言語として選択可能（既定値: 英語）
  - 字幕表示、位置調整、幅調整に対応
  - 字幕のフォント、色、影、アウトライン、背景色、不透明度を変更可能
  - 翻訳スタイル: Natural、Lecture、Technical、Custom 1（スター講師）、Custom 2
  - 長い動画の字幕を分割・並列翻訳し、翻訳キャッシュを利用可能
  - API キーを含む設定のパスワード暗号化バックアップ／復元
  - AI 翻訳に失敗した場合は元字幕を維持し、可能な場合は Google 翻訳に切り替え

# 使い方
  - インストール時には Google 翻訳が標準で利用できます。
  - 動画下部のツールバーで `AST` アイコンをクリックし、`AI 字幕翻訳` トグルを有効にします。

  ## かんたん設定 — 推奨
  1. 拡張機能をインストールし、設定ページのかんたん設定下部にある `API キーを取得` リンクをクリックして Google AI API キーを作成します。
  2. 作成した無料 API キーを設定の `Google AI API キー` に入力し、`API キーを確認` をクリックします。

  ## 詳細設定
  - API キーが必要なプロバイダーを使う場合は、そのプロバイダーで発行した API キーを入力してから `接続テスト` をクリックします。
  - 必要に応じて翻訳スタイルと字幕表示スタイルを調整できます。
  - API キーを含むすべての設定をバックアップできます。バックアップファイルは AES-256-GCM で暗号化され、復元にはバックアップ時に入力したパスワードが必要です。
  - DeepL API キーがある場合は、高速翻訳に DeepL を使用できます。

# 初めて使う場合の LLM 選択ガイド
  - 無料で始める場合: [Google AI Studio で API キーを作成](https://aistudio.google.com/api-keys)し、Google AI プロバイダーと `gemini-3.1-flash-lite` モデルを選択してください。Gemini 3.1 Flash Lite は応答の速さとコスト効率を重視しており、翻訳を始めるためのモデルとして適しています。
  - Google AI 無料枠の 1 日あたりのリクエスト上限（RPD）は、韓国時間では通常、米国太平洋夏時間中は午後 4 時、標準時間中は午後 5 時にリセットされます。利用できる無料枠と上限はアカウントやモデルによって異なるため、AI Studio で確認してください。
  - 有料利用での推奨モデル: 字幕翻訳は比較的明確な入出力タスクのため、最大のフロンティアモデルではなく、小さく高速なモデルから始めることを推奨します。Gemini 3.1 Flash Lite、GPT-5.6 Luna、Claude Haiku 4.5 などが良い開始点です。より高い品質が必要な場合にのみ、大きなモデルを選択してください。
  - 有料利用で費用対効果に優れたモデル: OpenRouter プロバイダーでは、`deepseek/deepseek-v4-flash` は高速な処理とコスト効率を備え、有料翻訳の開始モデルとして適しています。`Nitro を使用` を選択すると、高速なプロバイダーが優先されます。最新の価格と上限は OpenRouter で確認してください。

# 主な変更
  [ v0.1.3 (2026-08-03) ]
  - ted.com のサポートを追加しました。
  - API キーの表示／非表示、代替翻訳の案内、字幕とプロバイダーメニューの動作安定性を改善しました。

  [ v0.1.2 (2026-07-19) ]
  - かんたん設定モードを追加しました。

# プロジェクト情報
  - ライセンス: MIT License
  - Source: https://github.com/mungi/ai-subtitle-translator
  - Site: https://mungi.github.io/ai-subtitle-translator/
  - 課題報告・機能改善の要望: https://github.com/mungi/ai-subtitle-translator/issues

# プライバシーとデータの取り扱い
- プライバシーポリシー: https://mungi.github.io/ai-subtitle-translator/privacy-ja.html
- 字幕テキストは、ユーザーが選択した翻訳プロバイダーに送信される場合があります。
- API キー、設定、翻訳キャッシュはユーザーのブラウザー内にのみ保存されます。
- API キーはブラウザーの保存領域にプロバイダー別の暗号文として保存され、設定データに平文の API キーは残りません。
- 保存領域へのアクセスは信頼された拡張機能コンテキストに制限され、API キーはコンテンツスクリプトに公開されません。
- この拡張機能は、独自サーバーや外部データベースに API キーを保存しません。
- API キーは認証のために必要な場合、選択したプロバイダーへ直接送信されます。
- ホスト型プロバイダーは公式 HTTPS オリジンのみに制限されます。Custom LLM は `localhost`／`127.0.0.1` の HTTP または HTTPS と、モデル取得または接続テスト時にユーザーがアクセスを許可したカスタム HTTPS オリジンを使用でき、リダイレクト応答を自動追跡しません。
