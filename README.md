# Discord arXiv Bot 📚# Discord Arxiv Bot



arXivから24時間以内に投稿されたAI関連の論文を自動取得し、毎朝6時（JST）にDiscordの指定チャンネルに投稿するボットです。このプロジェクトは、arXivから24時間以内に投稿されたAIに関する論文を取得し、Discordの指定チャンネルに毎朝6時に投稿するボットです。各論文はエンベッド形式で表示され、ボタンを押すことで日本語の概要を表示します。



## 主な機能 ✨## 機能



- 📊 **自動論文収集**: arXiv APIからAI関連カテゴリ（cs.AI, cs.LG, cs.CV等）の最新論文を取得- arXiv APIを利用して最新のAI論文を取得

- 🌐 **日本語翻訳**: Google AI Studio（Gemini API）を使用して論文タイトルを日本語に翻訳- Discordボットとして動作し、指定されたチャンネルに論文を投稿

- 📅 **定期投稿**: 毎朝6時（JST）に自動的にDiscordチャンネルへ投稿- 論文タイトルを日本語に翻訳し、リンクを挿入

- 🔘 **インタラクティブ**: ボタンをクリックして論文の日本語概要を表示- ボタンを押すことで論文の日本語概要を表示

- ☁️ **クラウド運用**: Renderの無料枠で24時間稼働- Google AI StudioのAPIを利用して概要を生成



## プロジェクト構成 📁## プロジェクト構成



``````

discord-arxiv-bot/discord-arxiv-bot

├── src/├── src

│   ├── index.ts                    # メインエントリーポイント（Bot常駐）│   ├── bot

│   ├── types/│   │   ├── commands

│   │   └── index.ts                # 型定義│   │   │   └── index.ts         # Discordボットのコマンドを定義

│   ├── services/│   │   └── client.ts            # Discordクライアントの設定

│   │   ├── arxivService.ts         # arXiv API連携│   ├── jobs

│   │   ├── translationService.ts   # Gemini翻訳サービス│   │   └── dailyDigest.ts       # 毎朝6時に実行されるジョブ

│   │   └── summaryService.ts       # Gemini要約サービス│   ├── services

│   └── jobs/│   │   ├── arxivService.ts      # arXiv APIを利用した論文取得サービス

│       └── dailyDigest.ts          # 日次ダイジェストジョブ│   │   ├── summaryService.ts     # 概要生成サービス

├── package.json│   │   └── translationService.ts  # 翻訳サービス

├── tsconfig.json│   ├── utils

├── render.yaml                      # Renderデプロイ設定│   │   └── time.ts              # 時間関連のユーティリティ

├── .env.example                     # 環境変数テンプレート│   └── index.ts                 # アプリケーションのエントリーポイント

└── README.md├── .env.example                  # 環境変数の例

```├── package.json                  # npmの設定ファイル

├── render.yaml                   # Renderでのデプロイ設定

## セットアップ手順 🚀├── tsconfig.json                 # TypeScriptの設定ファイル

└── README.md                     # プロジェクトのドキュメント

### 1. 前提条件```



- Node.js 18.x 以上## 使用方法

- npm または yarn

- Discordアカウント1. **環境設定**  

- Google AIアカウント   `.env.example`をコピーして`.env`にリネームし、必要なAPIキーやトークンを設定します。

- Renderアカウント（デプロイ用）

2. **依存関係のインストール**  

### 2. Discord Bot の作成   プロジェクトディレクトリで以下のコマンドを実行します。

   ```

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス   npm install

2. "New Application" をクリックしてアプリケーションを作成   ```

3. 左メニューから "Bot" を選択し、"Add Bot" をクリック

4. **Token** をコピーして保存（後で使用）3. **ボットの起動**  

5. "Privileged Gateway Intents" で以下を有効化:   以下のコマンドでボットを起動します。

   - ✅ Server Members Intent   ```

   - ✅ Message Content Intent   npm start

6. 左メニューから "OAuth2" → "URL Generator" を選択   ```

7. **SCOPES** で `bot` を選択

8. **BOT PERMISSIONS** で以下を選択:## デプロイ

   - ✅ Send Messages

   - ✅ Embed LinksRenderを利用してデプロイするための設定は`render.yaml`に記載されています。Renderの無料枠を利用してデプロイを行うことができます。

   - ✅ Attach Files

   - ✅ Read Message History## 改善点と問題点

9. 生成されたURLをブラウザで開き、ボットをサーバーに追加

- **改善点**: 論文の取得頻度やボタンのレスポンスを改善するために、キャッシュ機能を追加することが考えられます。

### 3. Discord チャンネルID の取得- **問題点**: APIの制限やエラー処理を適切に行う必要があります。特に、arXivやGoogle AI StudioのAPIの利用制限に注意が必要です。



1. Discordアプリの設定から「詳細設定」→「開発者モード」を有効化このプロジェクトは、AI研究者や開発者が最新の研究を簡単に追跡できるようにすることを目的としています。
2. 投稿先チャンネルを右クリック → "IDをコピー"

### 4. Google AI Studio API Key の取得

1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. "Create API Key" をクリック
3. APIキーをコピーして保存

### 5. ローカル環境のセットアップ

```powershell
# リポジトリをクローン
git clone <your-repo-url>
cd discord-arxiv-bot

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .env ファイルを編集して、以下の値を設定:
# DISCORD_TOKEN=your_discord_bot_token
# DISCORD_CHANNEL_ID=your_channel_id
# GOOGLE_API_KEY=your_gemini_api_key

# TypeScriptをビルド
npm run build

# 開発モードで起動（テスト用）
npm run dev
```

### 6. Renderへのデプロイ

#### 6.1 GitHubリポジトリの準備

```powershell
# Gitリポジトリを初期化（まだの場合）
git init
git add .
git commit -m "Initial commit"

# GitHubにプッシュ
git remote add origin https://github.com/your-username/discord-arxiv-bot.git
git push -u origin main
```

#### 6.2 Renderでサービスを作成

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. "New +" → "Blueprint" を選択
3. GitHubリポジトリを接続
4. `render.yaml` が自動検出され、以下の2つのサービスが作成されます:
   - **discord-arxiv-bot** (Web Service): ボット常駐・ボタン処理用
   - **daily-digest-cron** (Cron Job): 毎朝6時の論文投稿用

#### 6.3 環境変数の設定

各サービスの設定画面で以下の環境変数を設定:

| 変数名 | 値 |
|--------|-----|
| `DISCORD_TOKEN` | Discord Bot Token |
| `DISCORD_CHANNEL_ID` | Discord Channel ID |
| `GOOGLE_API_KEY` | Google AI Studio API Key |

#### 6.4 デプロイ確認

- Web ServiceとCron Jobの両方が正常にデプロイされていることを確認
- Logsを確認してエラーがないかチェック

## 使い方 📖

### ローカルでのテスト実行

```powershell
# Bot常駐モード（ボタン処理のみ）
npm start

# 開発モード（ホットリロード）
npm run dev

# ダイジェストジョブの手動実行
npm run digest
```

### Discord上での動作

1. 毎朝6時（JST）に自動的に論文一覧が投稿されます
2. 各論文には「📄 日本語概要を表示」ボタンが付いています
3. ボタンをクリックすると、その論文の日本語概要が表示されます（他のユーザーには見えません）

## 技術スタック 🛠️

- **言語**: TypeScript
- **ランタイム**: Node.js 18+
- **Discord SDK**: discord.js v14
- **AI API**: Google Generative AI (Gemini)
- **arXiv API**: http://export.arxiv.org/api/query
- **スケジューラ**: node-schedule
- **ホスティング**: Render (無料枠)

## API使用制限・注意点 ⚠️

### Google AI Studio (Gemini)

- **無料枠**: 1分あたり15リクエスト、1日あたり1,500リクエスト
- **対策**: 論文が多い日は翻訳・要約を制限する可能性あり

### arXiv API

- **制限**: 3秒間に1リクエストを推奨
- **対策**: 論文取得は1日1回のみ実行

### Discord API

- **レート制限**: 秒間数十リクエスト
- **対策**: メッセージ送信時に1秒間隔を設定

### Render無料枠

- **制限**: 
  - Web Service: 750時間/月（1サービス）
  - Cron Job: 無制限（実行時間のみカウント）
  - 15分間アクセスがないとスリープ
- **対策**: 
  - Web Serviceは常駐させてボタン処理を担当
  - Cron Jobは毎日6時のみ実行

## トラブルシューティング 🔧

### Bot がオンラインにならない

- `DISCORD_TOKEN` が正しく設定されているか確認
- Renderのログを確認してエラーメッセージをチェック

### 論文が投稿されない

- Cron Jobが正しくスケジュールされているか確認（UTC 21:00 = JST 6:00）
- `DISCORD_CHANNEL_ID` が正しいか確認
- arXiv APIが24時間以内の論文を返しているか確認（新着がない日もあります）

### ボタンが反応しない

- Web Serviceが起動しているか確認
- インタラクションのログを確認

### 翻訳・要約が失敗する

- `GOOGLE_API_KEY` が正しいか確認
- Gemini APIのクォータ制限を確認
- APIエラーログを確認

## 改善アイデア 💡

- [ ] 論文フィルタリング機能（特定キーワードのみ）
- [ ] 複数チャンネルへの投稿対応
- [ ] 週次サマリー機能
- [ ] 論文のお気に入り機能
- [ ] PDFダウンロード機能
- [ ] 論文の引用数・注目度の表示

## ライセンス 📄

MIT License

## 貢献 🤝

プルリクエストやIssueは大歓迎です！

---

**作成者**: [@your-username](https://github.com/your-username)  
**最終更新**: 2025年10月15日
