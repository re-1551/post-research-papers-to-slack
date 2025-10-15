import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
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
const TRIGGER_SECRET = process.env.TRIGGER_SECRET || 'default-secret-change-me';
const PORT = process.env.PORT || 10000;

// Expressアプリケーションの初期化（HTTPサーバー用）
const app = express();
app.use(express.json());

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
  console.log(`🌐 HTTP server running on port ${PORT}`);
  console.log(`📡 Waiting for trigger requests from Google Apps Script...`);

  // 開発用: 起動時にテスト実行（コメントアウト推奨）
  // runDailyDigest();
});

// HTTPエンドポイント: ヘルスチェック
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    bot: client.user?.tag || 'Not ready',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// HTTPエンドポイント: ダイジェスト実行トリガー（GASから呼び出される）
app.post('/trigger-digest', async (req: Request, res: Response) => {
  // セキュリティ: シークレットトークンで認証
  const providedSecret = req.headers['x-trigger-secret'] || req.body.secret;
  
  if (providedSecret !== TRIGGER_SECRET) {
    console.warn('⚠️  Unauthorized trigger attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('📨 Received trigger request from Google Apps Script');
  
  // 非同期でダイジェスト実行（即座にレスポンス返す）
  res.json({ 
    status: 'triggered',
    message: 'Daily digest job started',
    timestamp: new Date().toISOString()
  });

  // バックグラウンドで実行
  runDailyDigest().catch(err => {
    console.error('Error in triggered digest:', err);
  });
});

// HTTPサーバー起動
app.listen(PORT, () => {
  console.log(`🚀 HTTP server listening on port ${PORT}`);
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
