const translations = {
  ko: {
    metaDescription: "Udemy, YouTube, TED, NVIDIA Academy, Vimeo 자막을 원하는 언어로 번역해 영상 위에 표시하는 Chrome 확장 프로그램",
    brandHome: "AST - AI Subtitle Translator 홈", mainNavigation: "주요 메뉴", languageLabel: "언어 선택",
    navFeatures: "기능", navHowItWorks: "사용 방법", navSupport: "지원", navPrivacy: "개인정보", heroImageAlt: "강의 영상 위에 한국어와 영어 자막이 표시된 노트북",
    heroEyebrow: "FOR UDEMY, YOUTUBE, TED, NVIDIA ACADEMY & VIMEO",
    heroCopy: "비싼 월 구독 번역 요금제 대신, 내 API 키로 번역한 만큼만 내세요. OpenAI, Anthropic, Google AI, OpenRouter는 물론 내 노트북에서 돌리는 모델까지 연결해, 영상 전체 맥락을 반영한 LLM 번역을 쓸 수 있습니다.",
    navCost: "비용", navCustomLlm: "커스텀 LLM", githubLabel: "GitHub 저장소", viewCost: "비용 비교 보기", viewOnGithub: "GitHub에서 보기", openSourceNote: "MIT 라이선스 오픈 소스",
    costEyebrow: "쓴 만큼만 내세요", costTitle: "구독 없이, 내 API 키로", costSummary: "AI 제공업체에 직접 가입해 키를 넣으면, 실제로 사용한 토큰만큼만 해당 제공업체에 비용을 냅니다.",
    costCopyOne: "월 구독 번역 요금제는 영상을 한 편 보든 쉰 편 보든 같은 금액을 냅니다. AST에서는 OpenAI, Anthropic, Google AI, OpenRouter에서 직접 API 키를 만들고, 요청마다 그 제공업체의 토큰 단가로만 청구됩니다. 중간 수수료나 거쳐 가는 서버가 없습니다.",
    costCopyTwo: "자막은 짧고 명확한 문장이라 작고 빠른 모델로도 충분히 잘 번역됩니다. 그래서 비용이 아주 적습니다. 자막 100,000문장을 아래 모델로 번역하면 약 1.6~5.8달러이고, Gemini 무료 등급(일일 한도 안)이나 내 컴퓨터에서 돌리는 모델이라면 비용이 없습니다.",
    costTableTitle: "자막 100,000문장 번역 예상 비용", costColModel: "모델", costColPrice: "100만 토큰당 단가 (입력 / 출력)", costColTotal: "100,000문장", costFreeTier: "무료 등급", costFreeShort: "무료 $0", costLocalModel: "내 모델", costLocalPrice: "내 컴퓨터에서 실행",
    costNote: "영어 자막을 한국어로 번역한 기준의 추정치입니다. GPT-6 Luna와 Claude Haiku 5.5는 AST로 실제 번역한 사용량을 측정한 값이고, 나머지 모델은 같은 토큰 사용량(입력 약 540만, 출력 약 300만 토큰)에 정가를 적용했습니다. 단가는 2026년 11월 6일 기준이며, 실제 비용은 언어, 모델, 제공업체에 따라 달라집니다.",
    customEyebrow: "커스텀 LLM", customTitle: "내 노트북에서 모델을 돌리거나, 어떤 LLM 서비스든 연결하세요", customSummary: "커스텀 LLM은 OpenAI 호환 chat/completions API라면 무엇이든 연결되므로 특정 제공업체에 묶이지 않습니다.",
    customLocalTitle: "내 노트북에서 직접", customLocalCopy: "LM Studio나 Ollama 같은 도구로 공개 모델을 실행해 비용 없이 번역하세요. localhost와 127.0.0.1은 HTTP로 연결할 수 있고, 자막 텍스트는 내 컴퓨터 밖으로 나가지 않습니다.",
    customAnyTitle: "어떤 LLM 서비스든", customAnyCopy: "HTTPS로 OpenAI 호환 API를 제공하는 제공업체나 직접 운영하는 서버라면 연결할 수 있습니다. Base URL, API 키, 모델 이름만 입력하면 됩니다.",
    customDirectTitle: "내가 정한 서버로 바로", customDirectCopy: "자막 텍스트와 입력한 API 키는 브라우저에서 내가 고른 서버로 바로 전송됩니다. 개발자 서버를 거치지 않습니다.", customExampleLabel: "예시",
    install: "Chrome 웹 스토어에서 설치", viewHowItWorks: "사용 방법 보기", viewSupport: "지원 범위", featuresEyebrow: "주요 기능", featuresTitle: "자막을 더 편하게 읽는 방법",
    featureOneTitle: "영상 위에서 바로", featureOneCopy: "Udemy, YouTube, TED, NVIDIA Academy, Vimeo 플레이어 위에 번역 자막, 원문 자막 또는 원문과 번역을 함께 표시합니다. AST 메뉴에서 자막을 켜고 끄고, 원문 자막 언어와 번역 스타일을 바로 선택할 수 있습니다.",
    featureTwoTitle: "영상 전체를 이해하는 번역", featureTwoCopy: "AI 제공업체를 선택하면 LLM이 앞뒤 자막과 영상의 흐름을 함께 고려해, 끊기지 않고 자연스러운 번역을 만듭니다.",
    featureThreeTitle: "원하는 말투로", featureThreeCopy: "사용자 프롬프트로 강의체, 친근한 말투, 기술 문서체, 일타 강사 스타일 등 원하는 말투와 표현 방식을 직접 지정할 수 있습니다.",
    iconStateEyebrow: "아이콘 상태", iconStateTitle: "AST 아이콘 상태", iconStateCopy: "아이콘 색상으로 현재 번역 상태를 바로 확인할 수 있습니다. 자막 또는 번역 요청을 준비하는 동안에는 현재 색상으로 미세하게 깜빡입니다.",
    iconStateOff: "흰색 · 기본", iconStateOffCopy: "AST가 꺼져 있거나 원문 자막 상태", iconStateActive: "파란색 · 활성", iconStateActiveCopy: "번역 자막을 준비하거나 표시하는 기본 활성 상태", iconStateTemporary: "노란색 · 임시 번역", iconStateTemporaryCopy: "LLM 최종 번역을 기다리는 동안 임시 번역 표시", iconStateCurrent: "초록색 · 현재 자막 완료", iconStateCurrentCopy: "현재 재생 자막의 최종 번역 준비 완료", iconStateComplete: "보라색 · 전체 완료", iconStateCompleteCopy: "전체 자막의 최종 번역 완료", iconStateFallback: "분홍색 · 대체 번역", iconStateFallbackCopy: "쿼터 초과 등으로 Google Translate 대체 번역 사용 중", iconStateYoutubeAuto: "주황색 · YouTube 자동 번역", iconStateYoutubeAutoCopy: "번역 대신 YouTube 자동 번역 자막을 그대로 표시 중",
    workflowEyebrow: "시작하기", workflowTitle: "네 단계로 시작하세요", stepOne: "확장 프로그램을 설치합니다.", stepTwo: "설정에서 목표 언어와 번역 제공업체를 설정합니다.", stepThree: "Udemy 강의, YouTube 영상, TED 영상, NVIDIA Academy 강의 또는 Vimeo 영상을 엽니다.", stepFour: "영상 컨트롤 바의 자막 번역 아이콘을 누릅니다.",
    starterEyebrow: "권장 설정", starterTitle: "처음 시작하는 LLM 선택 가이드", starterSummary: "무료로 먼저 사용해 보고, 더 많은 번역이 필요할 때 유료 제공업체로 전환하세요.", freeStart: "무료로 시작", freeCopy: "응답이 빠르고 비용 효율이 좋아 번역을 시작하기에 적합한 모델입니다. 무료 등급의 일일 요청 한도는 한국 시간으로 보통 오후 4시(미국 서부 표준시에는 오후 5시)에 초기화됩니다.", getApiKey: "API 키 발급", modelSelection: "모델 선택", modelTitle: "작고 빠른 모델부터", modelCopy: "자막 번역은 명확한 입출력 작업이므로 가장 큰 프론티어 모델이 필요하지 않은 경우가 많습니다. Gemini 3.1 Flash Lite, GPT-6 Luna, Claude Haiku 5.5 같은 작고 빠른 모델부터 사용하세요.",
    paidRecommendation: "유료 사용 권장", paidCopy: "유료 번역을 시작하기에 적합한 가성비 좋은 모델입니다. 설정에서 OpenRouter 제공업체를 선택하고 deepseek/deepseek-v4-flash 모델을 입력하세요.", modelInfo: "모델 정보 보기", supportMoreGeneric: "다른 HTML5 동영상 플레이어 (테크니컬 프리뷰)", supportMoreLabel: "추가 지원", supportEyebrow: "지원 환경", supportTitle: "학습 영상에 집중하세요", supportCopy: "Udemy 강의 플레이어, YouTube 영상 페이지, TED 영상 페이지, NVIDIA Academy 강의, Vimeo 영상을 지원합니다. 영상에서 제공하는 수동 또는 자동 생성 자막이 필요합니다.", providerList: "지원 번역 제공업체", privacyEyebrow: "PRIVACY & SECURITY", privacyTitle: "번역에 필요한 데이터만 사용합니다", privacySummary: "광고·추적·분석을 위한 개발자 서버를 운영하지 않습니다.", privacyCopyOne: "자막 텍스트와 번역 설정은 사용자가 선택한 번역 제공업체로 전송될 수 있습니다. API 키와 설정, 번역 캐시는 사용자 브라우저에 저장되며 개발자 서버로 전송되지 않습니다.", privacyCopyTwo: "API 키는 암호화해 저장하고 콘텐츠 스크립트에서 직접 읽을 수 없게 제한합니다. 다만 자동 복호화에 필요한 정보도 같은 브라우저 프로필에 있으므로 OS 보안 저장소와 같은 수준으로 키를 보호하지는 못합니다.", privacyLinksLabel: "개인정보 처리방침 언어 선택", footerPrivacy: "개인정보 처리방침", privacyHref: "privacy.html", footerCopy: "Udemy, YouTube, TED, NVIDIA Academy, Vimeo 자막을 원하는 언어로"
  },
  en: {
    metaDescription: "A Chrome extension that translates subtitles from Udemy, YouTube, TED, NVIDIA Academy, and Vimeo into your language and displays them over video.",
    brandHome: "AST - AI Subtitle Translator home", mainNavigation: "Main navigation", languageLabel: "Select language",
    navFeatures: "Features", navHowItWorks: "How it works", navSupport: "Support", navPrivacy: "Privacy", heroImageAlt: "A laptop showing Korean and English subtitles over a course video",
    heroEyebrow: "FOR UDEMY, YOUTUBE, TED, NVIDIA ACADEMY & VIMEO",
    heroCopy: "Skip the monthly translation subscription. Bring your own API key and pay only for what you translate, with context-aware LLM translation from OpenAI, Anthropic, Google AI, OpenRouter, or a model running on your own laptop.",
    navCost: "Cost", navCustomLlm: "Custom LLM", githubLabel: "GitHub repository", viewCost: "Compare costs", viewOnGithub: "View on GitHub", openSourceNote: "Open source under the MIT License",
    costEyebrow: "PAY ONLY FOR WHAT YOU USE", costTitle: "No subscription. Just your own API key.", costSummary: "Sign up directly with an AI provider, enter your key, and pay that provider only for the tokens you actually use.",
    costCopyOne: "A monthly translation plan charges the same whether you watch one video or fifty. With AST you create an API key at OpenAI, Anthropic, Google AI, or OpenRouter, and each request is billed by that provider at its own token price, with no markup and nothing in between.",
    costCopyTwo: "Subtitles are short, clear text, so small fast models translate them well. That keeps the bill tiny: 100,000 subtitle sentences cost about $1.60 to $5.80 with these models, and nothing at all on Gemini's free tier (within its daily limits) or with a model on your own computer.",
    costTableTitle: "Estimated cost to translate 100,000 subtitle sentences", costColModel: "Model", costColPrice: "Price per 1M tokens (input / output)", costColTotal: "100,000 sentences", costFreeTier: "Free tier", costFreeShort: "$0 free", costLocalModel: "Your own model", costLocalPrice: "Runs on your computer",
    costNote: "Estimates for translating English subtitles into Korean. GPT-6 Luna and Claude Haiku 5.5 are measured from real AST translations; the other models apply list prices to the same token usage (about 5.4M input and 3.0M output tokens). List prices as of November 6, 2026. Actual cost varies by language, model, and provider.",
    customEyebrow: "CUSTOM LLM", customTitle: "Run a model on your laptop, or connect any LLM service", customSummary: "Custom LLM works with any OpenAI-compatible chat/completions API, so you are never locked into one provider.",
    customLocalTitle: "On your own laptop", customLocalCopy: "Run an open model with a tool such as LM Studio or Ollama and translate at no cost. localhost and 127.0.0.1 can use plain HTTP, and subtitle text stays on your computer.",
    customAnyTitle: "Any LLM service", customAnyCopy: "Connect any provider or self-hosted server that offers an OpenAI-compatible API over HTTPS. Enter its Base URL, API key, and model name, and AST does the rest.",
    customDirectTitle: "Straight to your server", customDirectCopy: "Subtitle text, and your API key if you set one, go directly from your browser to the server you chose. Nothing passes through a developer server.", customExampleLabel: "EXAMPLE",
    install: "Install from Chrome Web Store", viewHowItWorks: "See how it works", viewSupport: "Supported platforms", featuresEyebrow: "WHAT IT DOES", featuresTitle: "A better way to follow subtitles",
    featureOneTitle: "Right on the video", featureOneCopy: "Show translated subtitles, source subtitles, or both together over Udemy, YouTube, TED, NVIDIA Academy, and Vimeo players. Use the AST menu to turn subtitles on or off and choose a source subtitle language or translation style.",
    featureTwoTitle: "Translation that understands the full video", featureTwoCopy: "When you choose an AI provider, the LLM considers surrounding subtitles and the video flow to create natural, connected translations.",
    featureThreeTitle: "In the voice you want", featureThreeCopy: "Use a custom prompt to set the translation tone and wording, from an instructional or friendly voice to the style of technical documentation or the lively delivery of a top instructor.",
    iconStateEyebrow: "ICON STATUS", iconStateTitle: "AST icon status", iconStateCopy: "Use the icon color to see the translation state at a glance. It gently pulses in its current color while subtitle or translation requests are being prepared.",
    iconStateOff: "White · Default", iconStateOffCopy: "AST is off or original subtitles are shown", iconStateActive: "Blue · Active", iconStateActiveCopy: "The default active state while translated subtitles are prepared or shown", iconStateTemporary: "Yellow · Temporary", iconStateTemporaryCopy: "Temporary translation is shown while final LLM translation is pending", iconStateCurrent: "Green · Current cue ready", iconStateCurrentCopy: "Final translation is ready for the currently playing cue", iconStateComplete: "Purple · Complete", iconStateCompleteCopy: "Final translation is complete for the full subtitle track", iconStateFallback: "Pink · Fallback", iconStateFallbackCopy: "Google Translate fallback is in use, such as after a quota limit is reached", iconStateYoutubeAuto: "Orange · YouTube auto-translation", iconStateYoutubeAutoCopy: "YouTube's auto-translated subtitles are shown instead of a translation",
    workflowEyebrow: "GET STARTED", workflowTitle: "Get started in four steps", stepOne: "Install the extension.", stepTwo: "Set your target language and translation provider in Options.", stepThree: "Open a Udemy course, YouTube video, TED video, NVIDIA Academy course, or Vimeo video.", stepFour: "Click the subtitle translation icon in the video controls.",
    starterEyebrow: "RECOMMENDED SETUP", starterTitle: "LLM selection guide for first-time users", starterSummary: "Start with a free option, then move to a paid provider when you need more translations.", freeStart: "FREE START", freeCopy: "A responsive, cost-efficient starting model for translation. Daily free-tier request limits usually reset at 4 PM Korea time (5 PM during US Pacific Standard Time).", getApiKey: "Get API key", modelSelection: "MODEL SELECTION", modelTitle: "Start small and fast", modelCopy: "Subtitle translation is usually a clear input-output task, so you often do not need the largest frontier model. Start with small, fast models such as Gemini 3.1 Flash Lite, GPT-6 Luna, or Claude Haiku 5.5.",
    paidRecommendation: "PAID RECOMMENDATION", paidCopy: "A cost-effective starting point for paid translation. Select the OpenRouter provider in Options and enter the deepseek/deepseek-v4-flash model.", modelInfo: "View model details", supportMoreGeneric: "Other HTML5 video players (Technical Preview)", supportMoreLabel: "Also supported", supportEyebrow: "SUPPORTED", supportTitle: "Stay focused on learning", supportCopy: "Supports Udemy course players, YouTube video pages, TED video pages, NVIDIA Academy courses, and Vimeo videos. Videos need manually created or automatically generated captions.", providerList: "Supported translation providers", privacyEyebrow: "PRIVACY & SECURITY", privacyTitle: "We use only the data needed for translation", privacySummary: "We do not operate developer servers for advertising, tracking, or analytics.", privacyCopyOne: "Subtitle text and translation settings may be sent to the translation provider you choose. API keys, settings, and translation cache are stored in your browser and are not sent to developer servers.", privacyCopyTwo: "API keys are encrypted at rest and content scripts cannot read them directly. The information needed for automatic decryption remains in the same browser profile, so this is not equivalent to secure OS storage.", privacyLinksLabel: "Choose a privacy policy language", footerPrivacy: "Privacy Policy", privacyHref: "privacy-en.html", footerCopy: "Udemy, YouTube, TED, NVIDIA Academy, and Vimeo subtitles in your language"
  },
  ja: {
    metaDescription: "Udemy、YouTube、TED、NVIDIA Academy、Vimeo の字幕を目的の言語に翻訳し、動画上に表示する Chrome 拡張機能です。",
    brandHome: "AST - AI Subtitle Translator ホーム", mainNavigation: "メインナビゲーション", languageLabel: "言語を選択",
    navFeatures: "機能", navHowItWorks: "使い方", navSupport: "対応環境", navPrivacy: "プライバシー", heroImageAlt: "講座動画上に韓国語と英語の字幕が表示されたノートパソコン",
    heroEyebrow: "FOR UDEMY, YOUTUBE, TED, NVIDIA ACADEMY & VIMEO",
    heroCopy: "高い月額の翻訳サブスクリプションは不要です。自分の API キーで、翻訳した分だけ支払えます。OpenAI、Anthropic、Google AI、OpenRouter、さらに自分のノートパソコンで動かすモデルまで接続し、動画全体の文脈を踏まえた LLM 翻訳を使えます。",
    navCost: "コスト", navCustomLlm: "カスタム LLM", githubLabel: "GitHub リポジトリ", viewCost: "コストを比較", viewOnGithub: "GitHub で見る", openSourceNote: "MIT ライセンスのオープンソース",
    costEyebrow: "使った分だけ支払い", costTitle: "サブスクなし、自分の API キーで", costSummary: "AI プロバイダーに直接登録してキーを入力すれば、実際に使ったトークン分だけをそのプロバイダーに支払います。",
    costCopyOne: "月額の翻訳プランは、動画を 1 本見ても 50 本見ても同じ料金です。AST では OpenAI、Anthropic、Google AI、OpenRouter で直接 API キーを作成し、リクエストごとにそのプロバイダーのトークン単価だけが請求されます。中間手数料や経由するサーバーはありません。",
    costCopyTwo: "字幕は短く明確な文なので、小さく高速なモデルでも十分きれいに翻訳できます。そのため費用はごくわずかです。字幕 100,000 文を下のモデルで翻訳すると約 1.6〜5.8 ドルで、Gemini の無料枠（1 日の上限内）や自分のパソコンで動かすモデルなら費用はかかりません。",
    costTableTitle: "字幕 100,000 文の翻訳にかかる推定費用", costColModel: "モデル", costColPrice: "100 万トークンあたりの単価（入力 / 出力）", costColTotal: "100,000 文", costFreeTier: "無料枠", costFreeShort: "無料 $0", costLocalModel: "自分のモデル", costLocalPrice: "自分のパソコンで実行",
    costNote: "英語字幕を韓国語に翻訳した場合の推定値です。GPT-6 Luna と Claude Haiku 5.5 は AST で実際に翻訳した使用量の測定値で、その他のモデルは同じトークン使用量（入力約 540 万、出力約 300 万トークン）に定価を当てはめています。単価は 2026 年 11 月 6 日時点のもので、実際の費用は言語、モデル、プロバイダーによって異なります。",
    customEyebrow: "カスタム LLM", customTitle: "ノートパソコンでモデルを動かすことも、どんな LLM サービスにも接続できます", customSummary: "カスタム LLM は OpenAI 互換の chat/completions API ならどれでも接続できるため、特定のプロバイダーに縛られません。",
    customLocalTitle: "自分のノートパソコンで", customLocalCopy: "LM Studio や Ollama などのツールでオープンモデルを動かせば、費用をかけずに翻訳できます。localhost と 127.0.0.1 は HTTP で接続でき、字幕テキストは自分のパソコンの外に出ません。",
    customAnyTitle: "どんな LLM サービスでも", customAnyCopy: "HTTPS で OpenAI 互換 API を提供するプロバイダーや自前のサーバーなら接続できます。Base URL、API キー、モデル名を入力するだけです。",
    customDirectTitle: "選んだサーバーへ直接", customDirectCopy: "字幕テキストと入力した API キーは、ブラウザーから選んだサーバーへ直接送信されます。開発者のサーバーは経由しません。", customExampleLabel: "例",
    install: "Chrome ウェブストアからインストール", viewHowItWorks: "使い方を見る", viewSupport: "対応環境を見る", featuresEyebrow: "主な機能", featuresTitle: "字幕をもっと快適に読む方法",
    featureOneTitle: "動画上でそのまま", featureOneCopy: "Udemy、YouTube、TED、NVIDIA Academy、Vimeo のプレーヤー上に、翻訳字幕、元字幕、または元字幕と翻訳の両方を表示します。AST メニューから字幕のオン・オフ、元字幕の言語、翻訳スタイルをその場で選べます。",
    featureTwoTitle: "動画全体を理解する翻訳", featureTwoCopy: "AI プロバイダーを選ぶと、LLM が前後の字幕と動画の流れを考慮し、自然で一貫した翻訳を作成します。",
    featureThreeTitle: "好みの話し方で", featureThreeCopy: "カスタムプロンプトで、講義調、親しみやすい口調、技術文書スタイル、人気講師のような力強い伝え方など、翻訳のトーンと表現方法を直接設定できます。",
    iconStateEyebrow: "アイコンの状態", iconStateTitle: "AST アイコンの状態", iconStateCopy: "アイコンの色で現在の翻訳状態をすぐに確認できます。字幕または翻訳リクエストを準備している間は、現在の色で穏やかに点滅します。",
    iconStateOff: "白 · 基本", iconStateOffCopy: "AST がオフ、または原文字幕の状態", iconStateActive: "青 · 有効", iconStateActiveCopy: "翻訳字幕を準備または表示している基本の有効状態", iconStateTemporary: "黄 · 一時翻訳", iconStateTemporaryCopy: "LLM の最終翻訳を待つ間に一時翻訳を表示", iconStateCurrent: "緑 · 現在の字幕を翻訳済み", iconStateCurrentCopy: "現在再生中の字幕の最終翻訳が完了", iconStateComplete: "紫 · 全体完了", iconStateCompleteCopy: "字幕全体の最終翻訳が完了", iconStateFallback: "ピンク · 代替翻訳", iconStateFallbackCopy: "クォータ超過などで Google Translate の代替翻訳を使用中", iconStateYoutubeAuto: "オレンジ · YouTube 自動翻訳", iconStateYoutubeAutoCopy: "翻訳の代わりに YouTube の自動翻訳字幕をそのまま表示中",
    workflowEyebrow: "はじめに", workflowTitle: "4 ステップで開始", stepOne: "拡張機能をインストールします。", stepTwo: "設定画面で対象言語と翻訳プロバイダーを設定します。", stepThree: "Udemy 講座、YouTube 動画、TED 動画、NVIDIA Academy 講座、または Vimeo 動画を開きます。", stepFour: "動画コントロールの字幕翻訳アイコンをクリックします。",
    starterEyebrow: "推奨設定", starterTitle: "初めて使う場合の LLM 選択ガイド", starterSummary: "まずは無料で試し、より多くの翻訳が必要になったら有料プロバイダーに切り替えましょう。", freeStart: "無料で開始", freeCopy: "応答が速くコスト効率に優れた、翻訳を始めるのに適したモデルです。無料枠の 1 日あたりのリクエスト上限は、日本時間の通常午後 4 時（米国西海岸の標準時は午後 5 時）にリセットされます。", getApiKey: "API キーを取得", modelSelection: "モデルの選び方", modelTitle: "小さく高速なモデルから", modelCopy: "字幕翻訳は明確な入出力タスクであることが多いため、最大級のフロンティアモデルは必ずしも必要ありません。Gemini 3.1 Flash Lite、GPT-6 Luna、Claude Haiku 5.5 などの小さく高速なモデルから始めてください。",
    paidRecommendation: "有料利用の推奨", paidCopy: "有料翻訳を始める方におすすめの、コストパフォーマンスに優れたモデルです。設定画面で OpenRouter プロバイダーを選び、deepseek/deepseek-v4-flash モデルを入力してください。", modelInfo: "モデル情報を見る", supportMoreGeneric: "その他の HTML5 動画プレーヤー（テクニカルプレビュー）", supportMoreLabel: "その他の対応サイト", supportEyebrow: "対応環境", supportTitle: "学習動画に集中", supportCopy: "Udemy 講座プレーヤー、YouTube 動画ページ、TED 動画ページ、NVIDIA Academy 講座、Vimeo 動画に対応しています。動画には手動字幕または自動生成字幕が必要です。", providerList: "対応する翻訳プロバイダー", privacyEyebrow: "PRIVACY & SECURITY", privacyTitle: "翻訳に必要なデータのみを使用します", privacySummary: "広告・追跡・分析のための開発者サーバーは運用していません。", privacyCopyOne: "字幕テキストと翻訳設定は、選択した翻訳プロバイダーに送信される場合があります。API キー、設定、翻訳キャッシュはブラウザー内に保存され、開発者サーバーには送信されません。", privacyCopyTwo: "API キーは暗号化して保存し、コンテンツスクリプトから直接読み取れないよう制限しています。ただし自動復号に必要な情報も同じブラウザープロファイル内にあるため、OS の安全な保存領域と同等の保護を提供するものではありません。", privacyLinksLabel: "プライバシーポリシーの言語を選択", footerPrivacy: "プライバシーポリシー", privacyHref: "privacy-ja.html", footerCopy: "Udemy、YouTube、TED、NVIDIA Academy、Vimeo の字幕を目的の言語で"
  }
};

// Labels for the hero passage demo.
Object.assign(translations.ko, {
  heroGloss: "AI 자막 번역기",
  demoCaption: "AI와 일상에 관한 샘플 에세이를 맥락까지 반영해 번역한 예시 (데모)", demoTarget: "번역 언어", demoPause: "일시정지", demoPlay: "재생",
  contextNoteFr: "143번 자막의 ‘Il’은 ‘그’로도 읽히지만, 142번 자막을 보고 ‘The assistant’로 번역했습니다.",
  contextLabel: "맥락", contextNote: "143번 자막의 ‘It’이 가리키는 대상을 142번 자막에서 찾아 ‘이 비서’로 번역했습니다."
});
Object.assign(translations.en, {
  heroGloss: "AI Subtitle Translator",
  demoCaption: "Sample essay on everyday AI, translated in context (demo)", demoTarget: "Translate into", demoPause: "Pause", demoPlay: "Play",
  contextNoteFr: "“Il” in cue 143 could mean “he”; read with cue 142, it becomes “the assistant”.",
  contextLabel: "Context", contextNote: "“It” in cue 143 is translated as “the assistant”, carried over from cue 142."
});
Object.assign(translations.ja, {
  heroGloss: "AI 字幕翻訳",
  demoCaption: "日常のAIについてのサンプルエッセイを文脈ごと翻訳した例（デモ）", demoTarget: "翻訳先", demoPause: "一時停止", demoPlay: "再生",
  contextNoteFr: "字幕 143 の「Il」は「彼」とも読めますが、字幕 142 を踏まえて「The assistant」と訳しました。",
  contextLabel: "文脈", contextNote: "字幕 143 の「It」が指すものを字幕 142 から引き継ぎ、「このアシスタント」と訳しました。"
});

// Synthetic demo passage: a short English essay about everyday AI with its translations. Marked words show
// a pronoun resolved from the previous cue.
const demoCues = [
  { no: 141, time: "00:12:36,100",
    en: "A year ago, I used AI only to fix my emails.",
    fr: "Il y a un an, je n’utilisais l’IA que pour corriger mes e-mails.",
    frEn: "A year ago, I used AI only to fix my emails.",
    ko: "1년 전만 해도 저는 AI를 이메일 고칠 때만 썼습니다.",
    ja: "一年前、私はメールを直すときにしかAIを使っていませんでした。",
    es: "Hace un año, solo usaba la IA para corregir mis correos." },
  { no: 142, time: "00:12:39,800",
    en: "Now my AI assistant drafts reports, plans trips, and explains code.",
    fr: "Aujourd’hui, mon assistant IA rédige des rapports, planifie mes voyages et explique du code.",
    frEn: "Now my AI assistant drafts reports, plans my trips, and explains code.",
    ko: "이제 제 AI 비서는 보고서 초안을 쓰고, 여행 계획을 짜고, 코드도 설명해 줍니다.",
    ja: "今ではAIアシスタントが報告書の下書きを作り、旅行の計画を立て、コードまで説明してくれます。",
    es: "Ahora mi asistente de IA redacta informes, planifica viajes y explica código." },
  { no: 143, time: "00:12:43,200",
    en: "[It] still makes mistakes, so I always check its work.",
    fr: "[Il] fait encore des erreurs, alors je vérifie toujours son travail.",
    frEn: "[The assistant] still makes mistakes, so I always check its work.",
    ko: "[이 비서도] 여전히 실수를 하기 때문에, 결과는 꼭 확인합니다.",
    ja: "[このアシスタントも]まだ間違えることがあるので、結果は必ず確認します。",
    es: "[El asistente] todavía comete errores, así que siempre reviso su trabajo.",
    note: true },
  { no: 144, time: "00:12:46,900",
    en: "But the hours it saves me every week are real.",
    fr: "Mais les heures qu’il me fait gagner chaque semaine sont bien réelles.",
    frEn: "But the hours it saves me every week are real.",
    ko: "그래도 덕분에 매주 아끼는 시간은 확실합니다.",
    ja: "それでも、毎週節約できる時間は確かです。",
    es: "Pero las horas que me ahorra cada semana son reales." },
  { no: 145, time: "00:12:50,400",
    en: "The real skill now is knowing what to ask.",
    fr: "Le vrai talent, désormais, c’est de savoir quoi demander.",
    frEn: "The real skill now is knowing what to ask.",
    ko: "이제 진짜 실력은 무엇을 물어볼지 아는 것입니다.",
    ja: "これからの本当のスキルは、何を尋ねるかを知ることです。",
    es: "La verdadera habilidad ahora es saber qué preguntar." }
];

// Each demo tab: which line is the source, which is the translation, and which note explains the context.
const demoPairs = {
  "fr-en": { source: "fr", sourceLang: "fr", translation: "frEn", translationLang: "en", note: "contextNoteFr" },
  ko: { source: "en", sourceLang: "en", translation: "ko", translationLang: "ko", note: "contextNote" },
  ja: { source: "en", sourceLang: "en", translation: "ja", translationLang: "ja", note: "contextNote" },
  es: { source: "en", sourceLang: "en", translation: "es", translationLang: "es", note: "contextNote" }
};

// Headings carry a gloss in a second language, the way a parallel-text edition sets them.
const glossLanguageFor = { en: "ko", ko: "en", ja: "en" };
function getDefaultDemoPair() {
  const primary = (navigator.languages?.[0] || navigator.language || "").toLowerCase().split("-")[0];
  if (primary === "en") return "fr-en";
  if (primary === "ko" || primary === "ja") return primary;
  return "es";
}

const supportedLanguages = Object.keys(translations);
const languageSelect = document.querySelector("#language-select");
// Only a language the visitor picked is remembered; the browser language is read fresh each visit.
const LANGUAGE_CHOICE_KEY = "ast-site-language-choice";

function readStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_CHOICE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_CHOICE_KEY, language);
  } catch {
    // Private windows may block storage; the page still works in the chosen language.
  }
}

// Korean and Japanese browsers get their own language; every other browser gets English.
function getBrowserLanguage() {
  const primary = (navigator.languages?.[0] || navigator.language || "").toLowerCase().split("-")[0];
  return primary === "ko" || primary === "ja" ? primary : "en";
}

function getInitialLanguage() {
  // ?lang=ko|en|ja makes a shared link (or a privacy page's back link) open in that language.
  const requested = new URLSearchParams(location.search).get("lang");
  if (supportedLanguages.includes(requested)) return requested;
  const stored = readStoredLanguage();
  if (supportedLanguages.includes(stored)) return stored;
  return getBrowserLanguage();
}

const prefersReducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const demo = createPassageDemo();

function setLanguage(language) {
  const selectedLanguage = supportedLanguages.includes(language) ? language : "en";
  const copy = translations[selectedLanguage];

  document.documentElement.lang = selectedLanguage;
  document.title = "AST - AI Subtitle Translator";
  document.querySelector('meta[name="description"]').content = copy.metaDescription;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = copy[element.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.alt = copy[element.dataset.i18nAlt];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", copy[element.dataset.i18nAriaLabel]);
  });
  document.querySelectorAll("[data-i18n-href]").forEach((element) => {
    element.setAttribute("href", copy[element.dataset.i18nHref]);
  });
  const glossLanguage = glossLanguageFor[selectedLanguage];
  document.querySelectorAll("[data-gloss]").forEach((element) => {
    element.textContent = translations[glossLanguage][element.dataset.gloss] || "";
    element.setAttribute("lang", glossLanguage);
  });

  // The product name is English; its gloss is the name in the reader's language (Korean on the English page).
  const nameLanguage = selectedLanguage === "en" ? "ko" : selectedLanguage;
  document.querySelectorAll("[data-gloss-name]").forEach((element) => {
    element.textContent = translations[nameLanguage][element.dataset.glossName] || "";
    element.setAttribute("lang", nameLanguage);
  });

  languageSelect.value = selectedLanguage;
  demo?.onLanguage(selectedLanguage);
}

// One timeline sets the passage's translation lines one cue at a time.
function createPassageDemo() {
  const passage = document.querySelector("#passage");
  const list = document.querySelector("#cues");
  if (!passage || !list) return null;
  const toggle = document.querySelector("#play-toggle");
  const progress = passage.querySelector(".passage-progress span");
  const chips = [...passage.querySelectorAll(".chip")];
  const CUE_MS = 2300;
  const HOLD_MS = 4200;
  let target = null;
  let rows = [];
  let step = 0;
  let timer = null;
  let paused = prefersReducedMotion;
  let pageLanguage = "en";
  let userPickedTarget = false;
  let visible = true;

  const markup = (text) => {
    const fragment = document.createDocumentFragment();
    text.split(/(\[[^\]]+\])/).forEach((part) => {
      if (!part) return;
      if (part.startsWith("[")) {
        const mark = document.createElement("mark");
        mark.textContent = part.slice(1, -1);
        fragment.append(mark);
      } else {
        fragment.append(document.createTextNode(part));
      }
    });
    return fragment;
  };

  function render() {
    const copy = translations[pageLanguage];
    list.replaceChildren();
    rows = demoCues.map((cue) => {
      const row = document.createElement("li");
      row.className = "cue";
      const meta = document.createElement("div");
      meta.className = "cue-meta";
      const no = document.createElement("span");
      no.className = "cue-no";
      no.textContent = String(cue.no);
      const time = document.createElement("span");
      time.className = "cue-time";
      time.textContent = cue.time;
      meta.append(no, time);
      const body = document.createElement("div");
      const src = document.createElement("p");
      src.className = "cue-src";
      const pair = demoPairs[target];
      src.lang = pair.sourceLang;
      src.append(markup(cue[pair.source]));
      const tr = document.createElement("p");
      tr.className = "cue-tr";
      tr.lang = pair.translationLang;
      tr.append(markup(cue[pair.translation]));
      body.append(src, tr);
      row.append(meta, body);
      if (cue.note) {
        const note = document.createElement("p");
        note.className = "cue-note";
        const label = document.createElement("strong");
        label.textContent = copy.contextLabel;
        note.append(label, document.createTextNode(copy[demoPairs[target].note]));
        row.append(note);
      }
      list.append(row);
      return row;
    });
    chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.target === target)));
  }

  function paint() {
    rows.forEach((row, index) => {
      row.classList.toggle("is-set", index < step);
      row.classList.toggle("is-active", index === step - 1);
    });
    if (progress) progress.style.setProperty("--p", String(step / rows.length));
  }

  function schedule() {
    clearTimeout(timer);
    if (paused || !visible) return;
    timer = setTimeout(() => {
      step = step >= rows.length ? 0 : step + 1;
      paint();
      schedule();
    }, step >= rows.length ? HOLD_MS : step === 0 ? 500 : CUE_MS);
  }

  function restart() {
    render();
    if (paused) {
      step = rows.length;
      paint();
      return;
    }
    step = 0;
    paint();
    schedule();
  }

  function setPaused(value) {
    paused = value;
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(paused));
      const label = toggle.querySelector(".sr-only");
      if (label) label.textContent = translations[pageLanguage][paused ? "demoPlay" : "demoPause"];
    }
    if (paused) {
      clearTimeout(timer);
      step = Math.max(step, 1);
      paint();
    } else {
      schedule();
    }
  }

  chips.forEach((chip) => chip.addEventListener("click", () => {
    userPickedTarget = true;
    target = chip.dataset.target;
    restart();
  }));
  toggle?.addEventListener("click", () => setPaused(!paused));

  if (!prefersReducedMotion) passage.classList.add("is-animated");
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { threshold: 0.2 }).observe(passage);
  }

  return {
    onLanguage(language) {
      pageLanguage = language;
      if (!userPickedTarget && !target) target = getDefaultDemoPair();
      restart();
      setPaused(paused);
    }
  };
}

// Sections rise in once as they enter; content stays visible when scripts or motion are off.
function setUpReveals() {
  if (prefersReducedMotion || typeof IntersectionObserver !== "function") return;
  const targets = document.querySelectorAll("main > section:not(.hero) .wrap > *, .cost-table-wrap");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  targets.forEach((element, index) => {
    if (!element.classList.contains("cost-table-wrap")) element.classList.add("reveal");
    element.style.setProperty("--d", `${(index % 3) * 0.08}s`);
    observer.observe(element);
  });
}

setLanguage(getInitialLanguage());
setUpReveals();
languageSelect.addEventListener("change", (event) => {
  storeLanguage(event.target.value);
  setLanguage(event.target.value);
});
