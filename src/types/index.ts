/**
 * arXiv論文の型定義
 */
export interface ArxivPaper {
  /** arXiv ID (例: 2310.12345) */
  id: string;
  
  /** 論文タイトル（英語） */
  title: string;
  
  /** 著者リスト */
  authors: string[];
  
  /** 要旨（英語） */
  abstract: string;
  
  /** 投稿日時 */
  published: Date;
  
  /** 更新日時 */
  updated: Date;
  
  /** arXivリンク */
  link: string;
  
  /** PDFリンク */
  pdfLink: string;
  
  /** カテゴリ（例: cs.AI, cs.LG） */
  categories: string[];
}

/**
 * 翻訳済み論文情報
 */
export interface TranslatedPaper extends ArxivPaper {
  /** タイトル（日本語） */
  titleJa: string;
}

/**
 * 概要付き論文情報
 */
export interface PaperWithSummary extends TranslatedPaper {
  /** 日本語概要 */
  summaryJa: string;
}

/**
 * APIエラー型
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
