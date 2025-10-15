import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import dotenv from 'dotenv';
import { fetchRecentPapers } from './services/arxivService';
import { translateTitle } from './services/translationService';
import { generateSummaryById } from './services/summaryService';

// 環境変数を読み込み
dotenv.config();

// 環境変数の検証
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CHANNEL_ID', 'GOOGLE_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not set in environment variables`);
    process.exit(1);
  }
}

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!;

// Discordクライアントの初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ボット起動時の処理
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  console.log(`📅 Scheduled daily digest at 6:00 AM JST (21:00 UTC)`);

  // 毎朝6時（JST）= 21時（UTC）にジョブをスケジュール
  scheduleJob('0 21 * * *', async () => {
    console.log('⏰ Running daily digest job...');
    await runDailyDigest();
  });

  // 起動時にテスト実行（開発用・コメントアウト可）
  // runDailyDigest();
});

// ボタンインタラクションの処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // カスタムIDからarXiv IDを取得
  if (interaction.customId.startsWith('summary_')) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const arxivId = interaction.customId.replace('summary_', '');
      console.log(`📝 Generating summary for paper ${arxivId}...`);

      const summary = await generateSummaryById(arxivId);

      await interaction.editReply({
        content: `📄 **論文概要 (arXiv:${arxivId})**\n\n${summary}`,
      });

    } catch (error) {
      console.error('Error generating summary:', error);
      await interaction.editReply({
        content: '❌ 概要の生成に失敗しました。しばらくしてから再度お試しください。',
      });
    }
  }
});

// 日次ダイジェストの実行
async function runDailyDigest() {
  try {
    console.log('🔍 Fetching recent papers from arXiv...');
    const papers = await fetchRecentPapers(50);

    if (papers.length === 0) {
      console.log('ℹ️  No papers found in the last 24 hours');
      
      // チャンネルに通知を送信
      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID) as TextChannel;
      if (channel) {
        await channel.send('📭 過去24時間以内に投稿された新しいAI論文はありませんでした。');
      }
      return;
    }

    console.log(`✅ Found ${papers.length} papers. Posting to Discord...`);

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      console.error('❌ Invalid channel or channel not found');
      return;
    }

    // ヘッダーメッセージを送信
    await channel.send(`📚 **本日のAI論文ダイジェスト** (${papers.length}件)\n${new Date().toLocaleDateString('ja-JP')}`);

    // 各論文を順次投稿（レート制限対策で1秒間隔）
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

  } catch (error) {
    console.error('❌ Error running daily digest:', error);
  }
}

// エラーハンドリング
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// ボットにログイン
client.login(process.env.DISCORD_TOKEN);
