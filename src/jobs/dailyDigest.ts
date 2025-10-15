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

    // 論文を取得
    console.log('🔍 Fetching recent papers from arXiv...');
    const papers = await fetchRecentPapers(50);

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

    // 各論文を投稿
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];

      try {
        console.log(`📤 Posting paper ${i + 1}/${papers.length}: ${paper.id}`);

        // タイトルを翻訳
        const titleJa = await translateTitle(paper.title);

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

        // レート制限対策（1秒待機）
        if (i < papers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error posting paper ${paper.id}:`, error);
      }
    }

    console.log('✅ Daily digest completed successfully');

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
