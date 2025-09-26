# arXiv→Discord リサーチ BOT

指定したキーワードや著者の arXiv 論文を定期的に取得し、Google AI Studio の **Gemini 2.0 Flash** で日本語要約と読みどころを生成して Discord に投稿する BOT です。Render 上で常時稼働することを想定しています。

## 主な機能

- **Discord 投稿**: Webhook を利用して指定チャンネルに論文情報を送信。
- **Gemini 要約**: Gemini 2.0 Flash で論文要約と「面白いポイント」を生成。
- **レート制御**: 1 分あたり 15 リクエスト / 100 万トークン、1 日 200 リクエストの制限をソフト的に監視。
- **重複投稿防止**: SQLite に投稿済み論文 ID を保存し、二重投稿を排除。
- **FastAPI + APScheduler**: 3 時間ごとにジョブを実行しつつ、Render でのヘルスチェック用エンドポイントも提供。

## アーキテクチャ概要

| コンポーネント | 役割 |
| --- | --- |
| `main.py` | FastAPI アプリ、Discord 投稿処理、スケジューラ制御 |
| `utils/utilts.py` | arXiv 取得・Gemini 要約生成・レートリミット管理 |
| `database/database.py` | SQLite による投稿済み論文管理 |
| `config.py` | 環境変数の読み込み、Gemini レート制限設定 |
| `render.yaml` | Render 用 Blueprint（web サービス） |

## セットアップ

### 1. 事前に用意するもの

- Python 3.11 以上
- Discord Webhook URL（サーバー → チャンネル → 連携サービス → Webhook）
- Google AI Studio API キー（Gemini 2.0 Flash を有効化）
- Render アカウント（常時稼働する場合）

### 2. リポジトリの準備

```pwsh
git clone <repo-url>
cd post-research-papers-to-slack
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. 環境変数

`.env.example` をコピーして `.env` を作成し、各値を設定します。

```text
DISCORD_WEBHOOK_URL=...
GOOGLE_API_KEY=...
# 任意: RATE_LIMIT_PER_MINUTE_REQUESTS 等でレート値を調整可能
```

`config.py` で参照するその他の検索条件は必要に応じて編集してください。

## ローカルでの動作確認

```pwsh
make run
```

- `http://localhost:8000/` にアクセスするとヘルスチェック結果が返ります。
- ジョブは 3 時間ごとに実行されます。すぐ動作を確認したい場合は、Python シェルで `from main import run_job; run_job()` を実行してください。

## Render 無料プランでのデプロイ手順（初心者向け）

Render では Blueprint Deploy を使うと GitHub リポジトリから Web サービスを自動で構築できます。ここでは無料プランを想定した最小構成を手取り足取り説明します。

### 事前準備

1. [Render](https://render.com/) にアクセスし、Google などのアカウントでサインアップします（無料プランで OK）。
2. GitHub アカウントと Render を連携します（初回は GitHub 連携ボタンを押すと認証フローが開きます）。
3. GitHub 上に本リポジトリが存在していることを確認します（Fork しておくのが簡単です）。

### デプロイ手順

1. Render のダッシュボードで **New +** → **Blueprint** を選択します。
2. 「Public Git Repository」の欄に自分のリポジトリ URL（例: `https://github.com/<your-username>/post-research-papers-to-slack`）を貼り付け、**Continue** をクリックします。
3. Render が `render.yaml` を検出するとサービス一覧が表示されます。`arxiv-discord-bot` という Web サービスだけが登録されていれば OK です。
4. 画面右側のフォームでサービス名やリージョン（デフォルトのままで問題なし）を確認したら、そのまま **Apply** を押します。
5. 初回デプロイ前に環境変数をセットします。サービス詳細画面の **Environment** → **Add Environment Variable** から以下を登録します。
	- `DISCORD_WEBHOOK_URL`: Discord で発行した Webhook URL を貼り付け
	- `GOOGLE_API_KEY`: Google AI Studio で取得した API キー
	- `DATABASE_NAME`: `/tmp/papers.db`（揮発ストレージを使う設定）
6. すべて登録できたら **Deploy** ボタンを押してデプロイを開始します。初回は依存パッケージのインストールがあるので数分かかります。
7. デプロイが成功すると、サービスの **Overview** に Render が発行した URL が表示されます。ブラウザで `https://xxx.onrender.com/` にアクセスし、`{"status": "OK"}` が返ればアプリが稼働しています。

### 無料プランで動かす際の注意点

- `/tmp/papers.db` はインスタンスの再起動・再デプロイで中身が初期化されます。投稿済み判定を継続したい場合は外部データベース（例: Supabase, Neon など）を用いて `DATABASE_NAME` や接続ロジックを変更してください。
- 無料プランには月 750 時間の制限があります。通常は 1 サービスぶんの連続稼働に十分ですが、他の無料サービスを多数動かしていると足りなくなることがあります。
- Gemini API の無料枠では 1 日 200 リクエストまでの制限があります。本 BOT は 3 時間ごとの投稿（1 日 8 回）なので余裕がありますが、失敗時のリトライなどで一時的に増える可能性はあるため、Render のログでエラーが出ていないかときどき確認してください。

### Blueprint の挙動

- ビルド時コマンド: `pip install -r requirements.txt`
- 起動コマンド: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- サービス種別: Python Web Service（無料プラン対応）
- ローカルディスク: `/tmp/papers.db`（揮発、再起動でリセット）

## Gemini のレートリミットについて

Google AI Studio の無料枠は、以下の上限があります。

- 1 分あたり 15 リクエスト
- 1 分あたり 1,000,000 トークン
- 1 日あたり 200 リクエスト

本プロジェクトでは `utils/utilts.py` 内で独自の RateLimiter を実装し、

- API 呼び出し前に推定トークン数を算出 → 制限に余裕がない場合は待機
- レスポンス後もトークン数を加算
- 日次上限に達した場合はその日中のリクエストをスキップ

という流れで制御しています。スケジュールが 3 時間おきのため、通常利用では制限超過が発生しない想定です。

## トラブルシューティング

| 症状 | 対応 |
| --- | --- |
| Discord 投稿に失敗する | Webhook URL が有効か確認し、Render 環境変数にも設定されているかチェック。 |
| Gemini が None を返す | トークン制限超過もしくは API キー権限不足の可能性。ログで警告を確認。 |
| 論文が取得されない | `config.py` のキーワード／著者条件を見直し、arXiv の検索 API が動作しているか確認。 |

## ライセンス

MIT
