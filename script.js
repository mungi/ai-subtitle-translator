const translations = {
  ko: {
    metaDescription: "Udemy와 YouTube 자막을 원하는 언어로 번역해 영상 위에 표시하는 Chrome 확장 프로그램",
    brandHome: "AI Subtitle Translator 홈", mainNavigation: "주요 메뉴", languageLabel: "언어 선택",
    navFeatures: "기능", navHowItWorks: "사용 방법", navSupport: "지원", navPrivacy: "개인정보", heroImageAlt: "강의 영상 위에 한국어와 영어 자막이 표시된 노트북",
    heroCopy: "AI provider를 선택하면 LLM이 영상 전체의 흐름을 반영해 자막을 번역합니다. 사용자 프롬프트로 원하는 말투와 번역 스타일도 직접 지정하세요.",
    install: "Chrome 웹 스토어에서 설치", viewHowItWorks: "사용 방법 보기", viewSupport: "지원 범위", featuresEyebrow: "주요 기능", featuresTitle: "자막을 더 편하게 읽는 방법",
    featureOneTitle: "영상 위에서 바로", featureOneCopy: "Udemy와 YouTube 플레이어 위에 번역 자막을 표시합니다. 컨트롤 바의 아이콘으로 언제든 켜고 끌 수 있습니다.",
    featureTwoTitle: "영상 전체를 이해하는 번역", featureTwoCopy: "AI provider를 선택하면 LLM이 앞뒤 자막과 영상의 흐름을 함께 고려해, 끊기지 않고 자연스러운 번역을 만듭니다.",
    featureThreeTitle: "원하는 말투로", featureThreeCopy: "사용자 프롬프트로 강의체, 친근한 말투, 기술 문서 스타일처럼 원하는 번역 톤과 일타 강사 스타일 처럼 표현 방식에 대한 프롬프트를 직접 설정할 수 있습니다.",
    iconStateEyebrow: "아이콘 상태", iconStateTitle: "AST 아이콘 상태", iconStateCopy: "아이콘 색상으로 현재 번역 상태를 바로 확인할 수 있습니다. 자막 또는 번역 요청을 준비하는 동안에는 현재 색상으로 미세하게 깜빡입니다.",
    iconStateOff: "흰색 · 기본", iconStateOffCopy: "AST가 꺼져 있거나 원문 자막 상태", iconStateActive: "파란색 · 활성", iconStateActiveCopy: "번역 자막을 준비하거나 표시하는 기본 활성 상태", iconStateTemporary: "노란색 · 임시 번역", iconStateTemporaryCopy: "LLM 최종 번역을 기다리는 동안 임시 번역 표시", iconStateCurrent: "초록색 · 현재 cue 완료", iconStateCurrentCopy: "현재 재생 cue의 최종 번역 준비 완료", iconStateComplete: "보라색 · 전체 완료", iconStateCompleteCopy: "전체 자막의 최종 번역 완료", iconStateFallback: "분홍색 · 대체 번역", iconStateFallbackCopy: "쿼터 초과 등으로 Google Translate 대체 번역 사용 중",
    workflowEyebrow: "시작하기", workflowTitle: "네 단계로 시작하세요", stepOne: "확장 프로그램을 설치합니다.", stepTwo: "Options에서 목표 언어와 번역 provider를 설정합니다.", stepThree: "Udemy 강의 또는 YouTube 영상을 엽니다.", stepFour: "영상 컨트롤 바의 자막 번역 아이콘을 누릅니다.",
    starterEyebrow: "권장 설정", starterTitle: "처음 시작할 때", starterSummary: "무료로 먼저 사용해 보고, 더 많은 번역이 필요할 때 유료 provider로 전환하세요.", freeStart: "무료로 시작", freeCopy: "빠른 응답과 비용 효율성을 갖춘 번역 시작 모델입니다. 무료 등급의 일일 요청 한도는 한국 시간으로 보통 오후 4시(미국 서부 표준시에는 오후 5시)에 초기화됩니다.", getApiKey: "API 키 발급", modelTitle: "작고 빠른 모델부터", modelCopy: "자막 번역은 명확한 입출력 작업이므로 가장 큰 프론티어 모델이 필요하지 않은 경우가 많습니다. Gemini 3.1 Flash-Lite, GPT-5.6 Luna, Claude Haiku 4.5 같은 작고 빠른 모델부터 사용하세요.",
    paidRecommendation: "유료 사용 권장", paidCopy: "유료 번역을 위한 가성비 시작점입니다. Options에서 OpenRouter provider를 선택하고 `deepseek/deepseek-v4-flash` 모델을 입력하세요.", modelInfo: "모델 정보 보기", supportEyebrow: "지원 환경", supportTitle: "학습 영상에 집중하세요", supportCopy: "Udemy 강의 플레이어와 YouTube 영상 페이지를 지원합니다. 영상에 제공되는 수동 자막 또는 자동 생성 자막이 필요합니다.", providerList: "지원 번역 provider", privacyEyebrow: "PRIVACY & SECURITY", privacyTitle: "번역에 필요한 데이터만 사용합니다", privacySummary: "광고·추적·분석을 위한 개발자 서버를 운영하지 않습니다.", privacyCopyOne: "자막 텍스트와 번역 설정은 사용자가 선택한 번역 provider로 전송될 수 있습니다. API key와 설정, 번역 캐시는 사용자 브라우저에 저장되며 개발자 서버로 전송되지 않습니다.", privacyCopyTwo: "API key는 암호화해 저장하고 content script에서 직접 읽을 수 없게 제한합니다. 다만 자동 복호화에 필요한 정보도 같은 브라우저 프로필에 있으므로 OS 보안 저장소와 같은 수준의 vault는 아닙니다.", privacyLinksLabel: "개인정보 처리방침 언어 선택", footerPrivacy: "개인정보 처리방침", footerCopy: "Udemy와 YouTube 자막을 원하는 언어로"
  },
  en: {
    metaDescription: "A Chrome extension that translates Udemy and YouTube subtitles into your language and displays them over video.",
    brandHome: "AI Subtitle Translator home", mainNavigation: "Main navigation", languageLabel: "Select language",
    navFeatures: "Features", navHowItWorks: "How it works", navSupport: "Support", navPrivacy: "Privacy", heroImageAlt: "A laptop showing Korean and English subtitles over a course video",
    heroCopy: "Choose an AI provider to have an LLM translate subtitles with the full video context in mind. Use a custom prompt to set the tone and translation style you want.",
    install: "Install from Chrome Web Store", viewHowItWorks: "See how it works", viewSupport: "Supported platforms", featuresEyebrow: "WHAT IT DOES", featuresTitle: "A better way to follow subtitles",
    featureOneTitle: "Right on the video", featureOneCopy: "Show translated subtitles directly over Udemy and YouTube players. Turn them on or off anytime from the control-bar icon.",
    featureTwoTitle: "Translation that understands the full video", featureTwoCopy: "When you choose an AI provider, the LLM considers surrounding subtitles and the video flow to create natural, connected translations.",
    featureThreeTitle: "In the voice you want", featureThreeCopy: "Use a custom prompt to directly set translation-tone and expression guidance, from an instructional or friendly voice to technical-documentation style or the punchy delivery of a top instructor.",
    iconStateEyebrow: "ICON STATUS", iconStateTitle: "AST icon status", iconStateCopy: "Use the icon color to see the translation state at a glance. It gently pulses in its current color while subtitle or translation requests are being prepared.",
    iconStateOff: "White · Default", iconStateOffCopy: "AST is off or original subtitles are shown", iconStateActive: "Blue · Active", iconStateActiveCopy: "The default active state while translated subtitles are prepared or shown", iconStateTemporary: "Yellow · Temporary", iconStateTemporaryCopy: "Temporary translation is shown while final LLM translation is pending", iconStateCurrent: "Green · Current cue ready", iconStateCurrentCopy: "Final translation is ready for the currently playing cue", iconStateComplete: "Purple · Complete", iconStateCompleteCopy: "Final translation is complete for the full subtitle track", iconStateFallback: "Pink · Fallback", iconStateFallbackCopy: "Google Translate fallback is in use, such as after a quota limit is reached",
    workflowEyebrow: "GET STARTED", workflowTitle: "Get started in four steps", stepOne: "Install the extension.", stepTwo: "Set your target language and translation provider in Options.", stepThree: "Open a Udemy course or YouTube video.", stepFour: "Click the subtitle translation icon in the video controls.",
    starterEyebrow: "RECOMMENDED SETUP", starterTitle: "Getting started", starterSummary: "Start with a free option, then move to a paid provider when you need more translations.", freeStart: "FREE START", freeCopy: "A responsive, cost-efficient starting model for translation. Daily free-tier request limits usually reset at 4 PM Korea time (5 PM during US Pacific Standard Time).", getApiKey: "Get API Key", modelTitle: "Start small and fast", modelCopy: "Subtitle translation is usually a clear input-output task, so you often do not need the largest frontier model. Start with small, fast models such as Gemini 3.1 Flash-Lite, GPT-5.6 Luna, or Claude Haiku 4.5.",
    paidRecommendation: "PAID RECOMMENDATION", paidCopy: "A cost-effective starting point for paid translation. Select the OpenRouter provider in Options and enter the `deepseek/deepseek-v4-flash` model.", modelInfo: "View model details", supportEyebrow: "SUPPORTED", supportTitle: "Stay focused on learning", supportCopy: "Supports Udemy course players and YouTube video pages. Videos need manually created or automatically generated captions.", providerList: "Supported translation providers", privacyEyebrow: "PRIVACY & SECURITY", privacyTitle: "We use only the data needed for translation", privacySummary: "We do not operate developer servers for advertising, tracking, or analytics.", privacyCopyOne: "Subtitle text and translation settings may be sent to the translation provider you choose. API keys, settings, and translation cache are stored in your browser and are not sent to developer servers.", privacyCopyTwo: "API keys are encrypted at rest and content scripts cannot read them directly. The information needed for automatic decryption remains in the same browser profile, so this is not equivalent to an OS security-store vault.", privacyLinksLabel: "Choose a privacy policy language", footerPrivacy: "Privacy Policy", footerCopy: "Udemy and YouTube subtitles in your language"
  },
  ja: {
    metaDescription: "Udemy と YouTube の字幕を目的の言語に翻訳し、動画上に表示する Chrome 拡張機能です。",
    brandHome: "AI Subtitle Translator ホーム", mainNavigation: "メインナビゲーション", languageLabel: "言語を選択",
    navFeatures: "機能", navHowItWorks: "使い方", navSupport: "対応環境", navPrivacy: "プライバシー", heroImageAlt: "講座動画上に韓国語と英語の字幕が表示されたノートパソコン",
    heroCopy: "AI プロバイダーを選ぶと、LLM が動画全体の流れを踏まえて字幕を翻訳します。カスタムプロンプトで好みの話し方や翻訳スタイルも直接指定できます。",
    install: "Chrome ウェブストアからインストール", viewHowItWorks: "使い方を見る", viewSupport: "対応環境を見る", featuresEyebrow: "主な機能", featuresTitle: "字幕をもっと快適に読む方法",
    featureOneTitle: "動画上でそのまま", featureOneCopy: "Udemy と YouTube のプレーヤー上に翻訳字幕を表示します。コントロールバーのアイコンからいつでもオン・オフを切り替えられます。",
    featureTwoTitle: "動画全体を理解する翻訳", featureTwoCopy: "AI プロバイダーを選ぶと、LLM が前後の字幕と動画の流れを考慮し、自然で一貫した翻訳を作成します。",
    featureThreeTitle: "好みの話し方で", featureThreeCopy: "カスタムプロンプトで、講義調、親しみやすい口調、技術文書スタイル、人気講師のような力強い伝え方など、翻訳のトーンと表現方法を直接設定できます。",
    iconStateEyebrow: "アイコンの状態", iconStateTitle: "AST アイコンの状態", iconStateCopy: "アイコンの色で現在の翻訳状態をすぐに確認できます。字幕または翻訳リクエストを準備している間は、現在の色で穏やかに点滅します。",
    iconStateOff: "白 · 基本", iconStateOffCopy: "AST がオフ、または原文字幕の状態", iconStateActive: "青 · 有効", iconStateActiveCopy: "翻訳字幕を準備または表示している基本の有効状態", iconStateTemporary: "黄 · 一時翻訳", iconStateTemporaryCopy: "LLM の最終翻訳を待つ間に一時翻訳を表示", iconStateCurrent: "緑 · 現在の cue 完了", iconStateCurrentCopy: "現在再生中の cue の最終翻訳が準備完了", iconStateComplete: "紫 · 全体完了", iconStateCompleteCopy: "字幕全体の最終翻訳が完了", iconStateFallback: "ピンク · 代替翻訳", iconStateFallbackCopy: "クォータ超過などで Google Translate の代替翻訳を使用中",
    workflowEyebrow: "はじめに", workflowTitle: "4 ステップで開始", stepOne: "拡張機能をインストールします。", stepTwo: "Options で対象言語と翻訳プロバイダーを設定します。", stepThree: "Udemy 講座または YouTube 動画を開きます。", stepFour: "動画コントロールの字幕翻訳アイコンをクリックします。",
    starterEyebrow: "推奨設定", starterTitle: "はじめに", starterSummary: "まずは無料で試し、より多くの翻訳が必要になったら有料プロバイダーに切り替えましょう。", freeStart: "無料で開始", freeCopy: "応答が速くコスト効率に優れた、翻訳の開始モデルです。無料枠の 1 日あたりのリクエスト上限は、日本時間の通常午後 4 時（米国西海岸の標準時は午後 5 時）にリセットされます。", getApiKey: "API キーを取得", modelTitle: "小さく高速なモデルから", modelCopy: "字幕翻訳は明確な入出力タスクであることが多いため、最大級のフロンティアモデルは必ずしも必要ありません。Gemini 3.1 Flash-Lite、GPT-5.6 Luna、Claude Haiku 4.5 などの小さく高速なモデルから始めてください。",
    paidRecommendation: "有料利用の推奨", paidCopy: "有料翻訳向けのコストパフォーマンスに優れた開始点です。Options で OpenRouter プロバイダーを選び、`deepseek/deepseek-v4-flash` モデルを入力してください。", modelInfo: "モデル情報を見る", supportEyebrow: "対応環境", supportTitle: "学習動画に集中", supportCopy: "Udemy 講座プレーヤーと YouTube 動画ページに対応しています。動画には手動字幕または自動生成字幕が必要です。", providerList: "対応する翻訳プロバイダー", privacyEyebrow: "PRIVACY & SECURITY", privacyTitle: "翻訳に必要なデータのみを使用します", privacySummary: "広告・追跡・分析のための開発者サーバーは運用していません。", privacyCopyOne: "字幕テキストと翻訳設定は、選択した翻訳プロバイダーに送信される場合があります。API キー、設定、翻訳キャッシュはブラウザー内に保存され、開発者サーバーには送信されません。", privacyCopyTwo: "API キーは暗号化して保存し、content script から直接読み取れないよう制限しています。ただし自動復号に必要な情報も同じブラウザープロフィール内にあるため、OS のセキュリティストアと同等の vault ではありません。", privacyLinksLabel: "プライバシーポリシーの言語を選択", footerPrivacy: "プライバシーポリシー", footerCopy: "Udemy と YouTube の字幕を目的の言語で"
  }
};

Object.assign(translations.ko, {
  metaDescription: "Udemy, YouTube, NVIDIA Academy, Vimeo 자막을 원하는 언어로 번역해 영상 위에 표시하는 Chrome 확장 프로그램",
  heroEyebrow: "FOR UDEMY, YOUTUBE, NVIDIA ACADEMY & VIMEO",
  featureOneCopy: "Udemy, YouTube, NVIDIA Academy, Vimeo 플레이어 위에 자막을 표시합니다. AST 메뉴에서 자막을 켜고 끄고, 원본 자막 언어와 번역 스타일을 바로 선택할 수 있습니다.",
  stepThree: "Udemy 강의, YouTube 영상, NVIDIA Academy 강의 또는 Vimeo 영상을 엽니다.",
  supportCopy: "Udemy 강의 플레이어, YouTube 영상 페이지, NVIDIA Academy 강의, Vimeo 영상을 지원합니다. 영상에서 제공하는 수동 또는 자동 생성 자막이 필요합니다.",
  footerCopy: "Udemy, YouTube, NVIDIA Academy, Vimeo 자막을 원하는 언어로"
});

Object.assign(translations.en, {
  metaDescription: "A Chrome extension that translates subtitles from Udemy, YouTube, NVIDIA Academy, and Vimeo into your language and displays them over video.",
  heroEyebrow: "FOR UDEMY, YOUTUBE, NVIDIA ACADEMY & VIMEO",
  featureOneCopy: "Show subtitles directly over Udemy, YouTube, NVIDIA Academy, and Vimeo players. Use the AST menu to turn subtitles on or off and choose a source subtitle language or translation style.",
  stepThree: "Open a Udemy course, YouTube video, NVIDIA Academy course, or Vimeo video.",
  supportCopy: "Supports Udemy course players, YouTube video pages, NVIDIA Academy courses, and Vimeo videos. Videos need manually created or automatically generated captions.",
  footerCopy: "Udemy, YouTube, NVIDIA Academy, and Vimeo subtitles in your language"
});

Object.assign(translations.ja, {
  metaDescription: "Udemy、YouTube、NVIDIA Academy、Vimeo の字幕を目的の言語に翻訳し、動画上に表示する Chrome 拡張機能です。",
  heroEyebrow: "FOR UDEMY, YOUTUBE, NVIDIA ACADEMY & VIMEO",
  featureOneCopy: "Udemy、YouTube、NVIDIA Academy、Vimeo のプレーヤー上に字幕を表示します。AST メニューから字幕のオン・オフ、元字幕の言語、翻訳スタイルをその場で選べます。",
  stepThree: "Udemy 講座、YouTube 動画、NVIDIA Academy 講座、または Vimeo 動画を開きます。",
  supportCopy: "Udemy 講座プレーヤー、YouTube 動画ページ、NVIDIA Academy 講座、Vimeo 動画に対応しています。動画には手動字幕または自動生成字幕が必要です。",
  footerCopy: "Udemy、YouTube、NVIDIA Academy、Vimeo の字幕を目的の言語で"
});

const supportedLanguages = Object.keys(translations);
const languageSelect = document.querySelector("#language-select");

function getInitialLanguage() {
  const savedLanguage = localStorage.getItem("ast-site-language");
  if (supportedLanguages.includes(savedLanguage)) return savedLanguage;

  const browserLanguage = navigator.language.toLowerCase().split("-")[0];
  return supportedLanguages.includes(browserLanguage) ? browserLanguage : "en";
}

function setLanguage(language) {
  const selectedLanguage = supportedLanguages.includes(language) ? language : "en";
  const copy = translations[selectedLanguage];

  document.documentElement.lang = selectedLanguage;
  document.title = "AI Subtitle Translator";
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

  languageSelect.value = selectedLanguage;
  localStorage.setItem("ast-site-language", selectedLanguage);
}

setLanguage(getInitialLanguage());
languageSelect.addEventListener("change", (event) => setLanguage(event.target.value));
