import { GoogleGenerativeAI } from '@google/generative-ai';
import { ServiceError } from '../types';
import { fetchPaperById } from './arxivService';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

/**
 * 論文の要旨から日本語概要を生成
 */
export async function generateSummary(
  paperTitle: string,
  paperAbstract: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `以下の論文の要旨から、研究内容を分かりやすく日本語で要約してください。
要約は以下の点を含めてください：
- 研究の目的
- 提案手法の概要
- 主な結果や貢献

論文タイトル: ${paperTitle}

要旨:
${paperAbstract}

日本語の要約（300文字程度）:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    return summary.trim();

  } catch (error) {
    console.error('Summary generation error:', error);
    throw new ServiceError(
      'Failed to generate summary',
      'gemini-summary',
      error
    );
  }
}

/**
 * arXiv IDから論文を取得して概要を生成
 */
export async function generateSummaryById(arxivId: string): Promise<string> {
  try {
    const paper = await fetchPaperById(arxivId);
    
    if (!paper) {
      throw new Error(`Paper with ID ${arxivId} not found`);
    }

    return await generateSummary(paper.title, paper.abstract);

  } catch (error) {
    console.error(`Error generating summary for paper ${arxivId}:`, error);
    throw new ServiceError(
      `Failed to generate summary for paper ${arxivId}`,
      'gemini-summary',
      error
    );
  }
}
