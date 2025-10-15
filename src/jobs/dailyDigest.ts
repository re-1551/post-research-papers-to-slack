/**
 * Daily Digest Job - Standalone execution
 * このファイルはRender Cron Jobから独立して実行されます
 */

import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { fetchRecentPapers } from '../services/arxivService';
import { translateTitle } from '../services/translationService';

// 環境変数を読み込み
dotenv.config();

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

// Gemini 2.0 Flash Lite のレート制限: RPM=30, TPM=1000000, RPD=200
// 安全のため、RPM=24 (80%の余裕)で制限
const GEMINI_RPM_LIMIT = 24;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分

/**
 * レート制限を考慮した待機時間を計算
 * @param requestCount 現在の分でのリクエスト数
 * @returns 待機時間（ミリ秒）
 */
function calculateRateLimitDelay(requestCount: number): number {
  if (requestCount >= GEMINI_RPM_LIMIT) {
    // 上限に達したら次の分まで待機
    return RATE_LIMIT_WINDOW_MS / GEMINI_RPM_LIMIT;
  }
  // 均等に分散させるための待機時間
  return RATE_LIMIT_WINDOW_MS / GEMINI_RPM_LIMIT;
}

async function runDailyDigest() {
  console.log('🚀 Starting daily digest job...');

  // Discordクライアントを作成（ジョブ専用）
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    // ボットにログイン
    await client.login(DISCORD_TOKEN);
    console.log(`✅ Logged in as ${client.user?.tag}`);

    // 論文を取得（件数を100に増やして確実に24時間以内の論文を捉える）
    console.log('🔍 Fetching recent papers from arXiv...');
    const papers = await fetchRecentPapers(100);

    if (papers.length === 0) {
      console.log('ℹ️  No papers found in the last 24 hours');

      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID) as TextChannel;
      if (channel && channel.isTextBased()) {
        await channel.send('📭 過去24時間以内に投稿された新しいAI論文はありませんでした。');
      }

      await client.destroy();
      process.exit(0);
      return;
    }

    console.log(`✅ Found ${papers.length} papers. Posting to Discord...`);

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      console.error('❌ Invalid channel or channel not found');
      await client.destroy();
      process.exit(1);
      return;
    }

    // ヘッダーメッセージ
    await channel.send(`📚 **本日のAI論文ダイジェスト** (${papers.length}件)\n${new Date().toLocaleDateString('ja-JP')}`);

    // レート制限管理用の変数
    let requestCount = 0;
    let windowStartTime = Date.now();

    // 各論文を投稿
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];

      try {
        console.log(`📤 Posting paper ${i + 1}/${papers.length}: ${paper.id}`);

        // レート制限チェック: 1分ごとにカウンターをリセット
        const currentTime = Date.now();
        if (currentTime - windowStartTime >= RATE_LIMIT_WINDOW_MS) {
          console.log(`🔄 Rate limit window reset. Processed ${requestCount} requests in last minute.`);
          requestCount = 0;
          windowStartTime = currentTime;
        }

        // レート制限による待機
        if (requestCount > 0) {
          const delay = calculateRateLimitDelay(requestCount);
          console.log(`⏳ Rate limit delay: ${delay}ms (request ${requestCount + 1}/${GEMINI_RPM_LIMIT} in this minute)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // タイトルを翻訳（Gemini API呼び出し）
        const titleJa = await translateTitle(paper.title);
        requestCount++;

        // Embedを作成
        const embed = new EmbedBuilder()
          .setTitle(titleJa)
          .setURL(paper.link)
          .setColor(0x0099FF)
          .addFields(
            { name: '📝 原題', value: paper.title, inline: false },
            { name: '👥 著者', value: paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' 他' : ''), inline: false },
            { name: '📅 投稿日', value: paper.published.toLocaleDateString('ja-JP'), inline: true },
            { name: '🏷️ カテゴリ', value: paper.categories.slice(0, 3).join(', '), inline: true }
          )
          .setFooter({ text: `arXiv:${paper.id}` })
          .setTimestamp();

        // ボタンを作成
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`summary_${paper.id}`)
              .setLabel('📄 日本語概要を表示')
              .setStyle(ButtonStyle.Primary)
          );

        // メッセージを送信
        await channel.send({
          embeds: [embed],
          components: [row],
        });

        // Discord API のレート制限対策（軽微な待機）
        if (i < papers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`❌ Error posting paper ${paper.id}:`, error);
        // エラーが発生してもリクエストカウントは増やす（API呼び出しは行われたため）
      }
    }

    console.log(`✅ Daily digest completed successfully. Total Gemini API requests: ${requestCount}`);

    // クライアントを破棄して終了
    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error running daily digest:', error);
    await client.destroy();
    process.exit(1);
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  runDailyDigest();
}

export { runDailyDigest };
