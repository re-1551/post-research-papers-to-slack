/**
 * Discord arXiv Bot - Google Apps Script Trigger
 * 
 * このスクリプトは毎朝6時（JST）にRenderで動作するDiscord Botをトリガーし、
 * arXivの最新論文をDiscordに投稿させます。
 * 
 * セットアップ手順:
 * 1. Google Apps Script (https://script.google.com/) で新規プロジェクトを作成
 * 2. このコードを貼り付け
 * 3. RENDER_URL と TRIGGER_SECRET を設定
 * 4. トリガーを設定（毎日6:00-7:00に実行）
 */

// ========== 設定 ==========

// RenderのWeb ServiceのURL（デプロイ後に取得）
// 例: https://discord-arxiv-bot-xxxx.onrender.com
const RENDER_URL = 'YOUR_RENDER_URL_HERE';

// Trigger Secret（Renderの環境変数と同じ値を設定）
const TRIGGER_SECRET = 'YOUR_TRIGGER_SECRET_HERE';

// ========== メイン関数 ==========

/**
 * Daily Digest をトリガーする関数
 * この関数をGASのトリガーで毎朝6時に実行
 */
function triggerDailyDigest() {
  try {
    Logger.log('📨 Triggering daily digest on Render...');
    
    const url = `${RENDER_URL}/trigger-digest`;
    
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'X-Trigger-Secret': TRIGGER_SECRET
      },
      payload: JSON.stringify({
        secret: TRIGGER_SECRET,
        timestamp: new Date().toISOString(),
        source: 'Google Apps Script'
      }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode === 200) {
      Logger.log('✅ Successfully triggered daily digest');
      Logger.log('Response: ' + responseText);
    } else {
      Logger.log('⚠️ Trigger failed with status: ' + statusCode);
      Logger.log('Response: ' + responseText);
      
      // Slackなどに通知したい場合はここに追加
      sendErrorNotification('Trigger failed: ' + statusCode);
    }
    
  } catch (error) {
    Logger.log('❌ Error triggering daily digest: ' + error.toString());
    sendErrorNotification('Error: ' + error.toString());
  }
}

/**
 * 手動テスト用関数
 * スクリプトエディタで「実行」ボタンを押してテスト可能
 */
function testTrigger() {
  Logger.log('🧪 Running test trigger...');
  triggerDailyDigest();
}

/**
 * ヘルスチェック用関数
 * RenderのBotが起動しているか確認
 */
function checkBotHealth() {
  try {
    const url = `${RENDER_URL}/`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode();
    const data = JSON.parse(response.getContentText());
    
    if (statusCode === 200 && data.status === 'ok') {
      Logger.log('✅ Bot is healthy');
      Logger.log('Bot: ' + data.bot);
      Logger.log('Uptime: ' + data.uptime + ' seconds');
      return true;
    } else {
      Logger.log('⚠️ Bot health check failed');
      return false;
    }
  } catch (error) {
    Logger.log('❌ Health check error: ' + error.toString());
    return false;
  }
}

/**
 * エラー通知（オプション）
 * 必要に応じてSlack WebhookやDiscord Webhookに通知
 */
function sendErrorNotification(message) {
  // TODO: Slack/Discord Webhook URLを設定して通知
  // 例:
  // const webhookUrl = 'YOUR_WEBHOOK_URL';
  // UrlFetchApp.fetch(webhookUrl, {
  //   method: 'post',
  //   payload: JSON.stringify({ content: message })
  // });
  
  Logger.log('Error notification: ' + message);
}

// ========== トリガー設定手順 ==========
/**
 * 1. スクリプトエディタで「トリガー」アイコン（時計マーク）をクリック
 * 2. 「トリガーを追加」をクリック
 * 3. 以下のように設定:
 *    - 実行する関数: triggerDailyDigest
 *    - イベントのソース: 時間主導型
 *    - 時間ベースのトリガータイプ: 日付ベースのタイマー
 *    - 時刻: 午前6時～7時
 *    - エラー通知: 毎日通知を受け取る
 * 4. 保存
 * 
 * 注意: GASは日本時間（JST）で動作します
 */
