# デプロイ手順（Render + Google Apps Script）

このガイドでは、Renderの無料枠とGoogle Apps Scriptを使ってDiscord arXiv Botをデプロイする方法を説明します。

## アーキテクチャ

```
Google Apps Script (無料)
  ↓ 毎朝6時にHTTPリクエスト
Render Web Service (無料枠)
  ├── Discord Bot (常駐)
  ├── ボタンインタラクション処理
  └── /trigger-digest エンドポイント
      ↓
  Discord チャンネルに論文投稿
```

---

## ステップ1: 必要なAPIキーの取得

### 1.1 Discord Bot Token

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" → アプリ名を入力
3. 左メニュー "Bot" → "Add Bot"
4. **Token** をコピー（後で使用）
5. **Privileged Gateway Intents** で以下を有効化:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. "OAuth2" → "URL Generator":
   - SCOPES: `bot`
   - BOT PERMISSIONS: Send Messages, Embed Links, Read Message History
7. 生成されたURLでBotをサーバーに招待

### 1.2 Discord Channel ID

1. Discord設定 → 詳細設定 → 開発者モードを有効化
2. 投稿先チャンネルを右クリック → "IDをコピー"

### 1.3 Google AI Studio API Key

1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. "Create API Key" をクリック
3. APIキーをコピー

### 1.4 Trigger Secret（セキュリティ用）

以下のコマンドでランダムな文字列を生成:

```powershell
# PowerShellの場合
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

または、適当な長いランダム文字列（例: `abc123xyz789...`）

---

## ステップ2: Renderにデプロイ

### 2.1 Renderアカウント作成

1. [Render](https://render.com/) にアクセス
2. GitHubアカウントでサインアップ

### 2.2 Web Serviceの作成

1. Dashboard → **"New +"** → **"Web Service"**
2. GitHubリポジトリを接続:
   - "Connect a repository" をクリック
   - `re-1551/post-research-papers-to-slack` を選択
3. 設定:
   - **Name**: `discord-arxiv-bot`（任意）
   - **Branch**: `main`
   - **Root Directory**: (空白)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. **"Create Web Service"** をクリック

### 2.3 環境変数の設定

Web Serviceのページで **"Environment"** タブを開き、以下を追加:

| Key | Value |
|-----|-------|
| `DISCORD_TOKEN` | Discord Bot Token |
| `DISCORD_CHANNEL_ID` | Discord Channel ID |
| `GOOGLE_API_KEY` | Google AI Studio API Key |
| `TRIGGER_SECRET` | ステップ1.4で生成した文字列 |
| `NODE_ENV` | `production` |
| `TZ` | `Asia/Tokyo` |
| `PORT` | `10000` |

**"Save Changes"** をクリック → 自動的に再デプロイが始まります

### 2.4 デプロイURL の取得

デプロイ完了後、以下のようなURLが表示されます:
```
https://discord-arxiv-bot-xxxx.onrender.com
```

このURLをコピー（後でGASで使用）

### 2.5 動作確認

ブラウザで `https://your-render-url.onrender.com/` にアクセス:

```json
{
  "status": "ok",
  "bot": "YourBotName#1234",
  "uptime": 123.45,
  "timestamp": "2025-10-15T..."
}
```

が表示されればOK！

---

## ステップ3: Google Apps Scriptのセットアップ

### 3.1 GASプロジェクト作成

1. [Google Apps Script](https://script.google.com/) にアクセス
2. **"新しいプロジェクト"** をクリック
3. プロジェクト名: `Discord arXiv Bot Trigger`

### 3.2 スクリプトを貼り付け

1. プロジェクトに `gas-trigger.js` の内容をコピペ
2. 以下の2つの値を設定:

```javascript
const RENDER_URL = 'https://your-render-url.onrender.com';  // ステップ2.4のURL
const TRIGGER_SECRET = 'your-trigger-secret';  // ステップ1.4のSecret
```

3. **保存** (Ctrl + S)

### 3.3 手動テスト

1. 関数選択ドロップダウンから `testTrigger` を選択
2. **"実行"** ボタンをクリック
3. 初回実行時、権限を求められるので **"権限を確認"** → **"許可"**
4. ログを確認:
   ```
   📨 Triggering daily digest on Render...
   ✅ Successfully triggered daily digest
   ```
5. Discordチャンネルに論文が投稿されたか確認

### 3.4 トリガーの設定（定期実行）

1. 左メニューから **"トリガー"**（時計アイコン）をクリック
2. **"トリガーを追加"** をクリック
3. 設定:
   - **実行する関数**: `triggerDailyDigest`
   - **イベントのソース**: `時間主導型`
   - **時間ベースのトリガータイプ**: `日付ベースのタイマー`
   - **時刻**: `午前6時～7時`
   - **エラー通知**: `毎日通知を受け取る`
4. **"保存"** をクリック

これで毎朝6時～7時の間に自動的に論文が投稿されます！

---

## ステップ4: 動作確認

### Botがオンラインか確認
- Discordで Botのステータスが🟢オンラインになっているか

### 手動トリガーテスト
1. GASで `testTrigger` を実行
2. Discordに論文が投稿される
3. ボタンをクリックして概要が表示される

### 翌朝の自動実行確認
- 翌朝6時～7時にDiscordを確認

---

## トラブルシューティング

### Renderのデプロイが失敗する

**Logs を確認:**
```bash
npm ERR! ...
```

→ package.jsonの依存関係を確認

### ボタンが反応しない

1. RenderのLogsで `interactionCreate` イベントが発火しているか確認
2. Discord BotのIntentsが有効か確認

### GASのトリガーが失敗する

1. GASの実行ログを確認:
   - Apps Script Editor → "実行数"
2. エラーメッセージを確認:
   - `401 Unauthorized` → `TRIGGER_SECRET` が一致していない
   - `Connection timeout` → RenderのURLが間違っている

### 論文が投稿されない

1. arXiv APIが24時間以内の論文を返しているか確認（新着がない日もある）
2. RenderのLogsで `Found X papers` が表示されているか確認

---

## 料金

すべて無料枠で動作します：

- ✅ **Render Web Service**: 750時間/月（常駐可能）
- ✅ **Google Apps Script**: 無制限（実行時間制限あり）
- ✅ **Google AI Studio (Gemini)**: 1日1,500リクエスト
- ✅ **arXiv API**: 無料
- ✅ **Discord**: 無料

---

## まとめ

1. ✅ Discord Bot Token取得
2. ✅ Google AI Studio API Key取得
3. ✅ Trigger Secret生成
4. ✅ Renderにデプロイ + 環境変数設定
5. ✅ GASスクリプト作成 + トリガー設定
6. ✅ 動作確認

お疲れさまでした！🎉
