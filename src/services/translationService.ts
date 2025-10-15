import { GoogleGenerativeAI } from '@google/generative-ai';
import { ServiceError } from '../types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

/**
 * 英語のテキストを日本語に翻訳
 */
export async function translateToJapanese(text: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `以下の英語テキストを日本語に翻訳してください。翻訳結果のみを返してください。

${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedText = response.text();

    return translatedText.trim();

  } catch (error) {
    console.error('Translation error:', error);
    throw new ServiceError(
      'Failed to translate text',
      'gemini-translation',
      error
    );
  }
}

/**
 * 論文タイトルを日本語に翻訳（簡潔版）
 */
export async function translateTitle(title: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `以下の論文タイトルを学術的で自然な日本語に翻訳してください。翻訳結果のみを返してください。

${title}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedTitle = response.text();

    return translatedTitle.trim();

  } catch (error) {
    console.error('Title translation error:', error);
    // フォールバック：元のタイトルを返す
    return title;
  }
}
