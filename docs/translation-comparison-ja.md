# Chrome 内蔵翻訳と Google Translate の比較

[한국어](translation-comparison.md) · [English](translation-comparison-en.md) · [日本語](translation-comparison-ja.md)

## 試験方法

2026-10-26 に、作成した英文 24 文を各エンジンで韓国語へ 1 回翻訳した。日常会話、慣用句、否定・数量、技術用語、固有名詞、口語、曖昧性、長文、分割・結合字幕、条件・単位を含めた。

- Chrome: ユーザーがローカル試験ページで `Translator` API を実行して保存した結果。ブラウザーの申告バージョンは Chrome 156 で、翻訳モデルのバージョンは収集していない。
- Google: AST の `translateCuesWithGoogle` を直接実行した結果。`/translate_a/t?client=gtx` を使用し、公式 Google Cloud Translation API の結果ではない。
- 原文、参考訳、実際の応答、項目別評価: [試験データ](translation-comparison-results.json)。参考訳と評価コメントは韓国語。

## 評価基準と結果

作成者による定性評価である。4 点は意味と主要表現の保持、3 点は核心の保持と軽微な不自然さ・欠落、2 点は一部の意味の保持と重要表現の損失、1 点は主要な誤訳、0 点は核心の喪失または逆転を表す。試験前に作成した参考訳は唯一の正解とは扱わなかった。

文脈のない `I saw her duck.` は、鳥と身をかがめる動作の両方が成立するため採点から除外した。残り 23 項目で Chrome は 52/92 点、Google は 63/92 点だった。Google 優位 6 項目、Chrome 優位 0 項目、同等 17 項目。この点数は正解率ではない。

| 例 | Chrome 内蔵 | Google Translate |
| --- | --- | --- |
| `give me a hand` | 手を差し出す表現として直訳 | 不自然だが手助けの依頼を保持 |
| `generalizes poorly` | 汎化性能が悪いという意味が欠落 | 核心を保持 |
| `Green River` | 緑色の川 | 固有名詞を保持 |
| `spilled the beans` | 豆をこぼした | 豆をこぼした |
| `not unlikely` | 可能性がないという意味に逆転 | 可能性がないという意味に逆転 |
| ボールが飛んでくる文脈の `her duck` | 彼女のアヒル | 彼女のアヒル |

## 時間と制約

Chrome の初期化はモデルのダウンロード・準備を含め 7.56 秒だった。その後の翻訳 24 回の合計は 196.8ms、中央値は 7.7ms。Google の AST バッチ経路全体は 332.7ms だった。リクエスト構造、キャッシュ状態、実行環境が異なるため、速度の順位は判断しない。

難しい例を含む小規模な合成標本で、外部評価者や反復測定はない。他の言語・動画・モデルバージョンの品質を代表しない。両方式とも慣用句や文脈の解釈で失敗した例がある。

## AST への適用判断

今回の試験では Google が優位だったため、品質改善を理由に既定のエンジンを Chrome 内蔵翻訳へ置き換える根拠はない。ローカル処理や Google 接続失敗時の代替としては検討できる。Chrome Translator API は現在 AST に統合していない。
