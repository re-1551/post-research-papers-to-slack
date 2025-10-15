import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { ArxivPaper, ServiceError } from '../types';

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';

// AI関連のarXivカテゴリ
const AI_CATEGORIES = [
  'cs.AI',  // Artificial Intelligence
  'cs.LG',  // Machine Learning
  'cs.CL',  // Computation and Language
  'cs.CV',  // Computer Vision
  'cs.NE',  // Neural and Evolutionary Computing
  'stat.ML' // Machine Learning (Statistics)
];

/**
 * 過去24時間以内に投稿されたAI関連論文を取得
 */
export async function fetchRecentPapers(maxResults: number = 50): Promise<ArxivPaper[]> {
  try {
    // 24時間前の日時を計算
    const now = new Date();
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // カテゴリ検索クエリを構築
    const categoryQuery = AI_CATEGORIES.map(cat => `cat:${cat}`).join(' OR ');
    
    // arXiv APIにリクエスト（最大結果数を多めに設定し、後でフィルタ）
    const params = new URLSearchParams({
      search_query: categoryQuery,
      start: '0',
      max_results: maxResults.toString(),
      sortBy: 'submittedDate',
      sortOrder: 'descending'
    });

    const response = await axios.get(`${ARXIV_API_URL}?${params.toString()}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'discord-arxiv-bot/1.0'
      }
    });

    // XMLをパース
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const result = parser.parse(response.data);

    // エントリーを抽出
    const feed = result.feed;
    if (!feed || !feed.entry) {
      console.log('No entries found in arXiv response');
      return [];
    }

    // 単一エントリーの場合は配列化
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

    // 論文データを整形し、24時間以内のものだけフィルタ
    const papers: ArxivPaper[] = entries
      .map((entry: any) => {
        try {
          const published = new Date(entry.published);
          const updated = new Date(entry.updated);
          
          // IDからarXiv IDを抽出（例: http://arxiv.org/abs/2310.12345v1 -> 2310.12345）
          const idMatch = entry.id.match(/(\d+\.\d+)/);
          const arxivId = idMatch ? idMatch[1] : entry.id;

          // 著者を配列化
          const authors = Array.isArray(entry.author) 
            ? entry.author.map((a: any) => a.name)
            : [entry.author.name];

          // カテゴリを配列化
          const categories = Array.isArray(entry.category)
            ? entry.category.map((c: any) => c['@_term'])
            : [entry.category['@_term']];

          return {
            id: arxivId,
            title: entry.title.replace(/\s+/g, ' ').trim(),
            authors,
            abstract: entry.summary.replace(/\s+/g, ' ').trim(),
            published,
            updated,
            link: entry.id.replace(/v\d+$/, ''), // バージョン番号を除去
            pdfLink: entry.id.replace('abs', 'pdf'),
            categories
          };
        } catch (err) {
          console.error('Error parsing entry:', err);
          return null;
        }
      })
      .filter((paper: ArxivPaper | null): paper is ArxivPaper => {
        if (!paper) return false;
        // 24時間以内に投稿されたものだけ
        return paper.published >= past24Hours;
      });

    console.log(`Found ${papers.length} papers published in the last 24 hours`);
    return papers;

  } catch (error) {
    console.error('Error fetching arXiv papers:', error);
    throw new ServiceError(
      'Failed to fetch papers from arXiv',
      'arxiv',
      error
    );
  }
}

/**
 * arXiv IDから論文の詳細を取得
 */
export async function fetchPaperById(arxivId: string): Promise<ArxivPaper | null> {
  try {
    const params = new URLSearchParams({
      id_list: arxivId,
      max_results: '1'
    });

    const response = await axios.get(`${ARXIV_API_URL}?${params.toString()}`, {
      timeout: 10000
    });

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const result = parser.parse(response.data);

    if (!result.feed || !result.feed.entry) {
      return null;
    }

    const entry = result.feed.entry;
    const published = new Date(entry.published);
    const updated = new Date(entry.updated);

    const authors = Array.isArray(entry.author)
      ? entry.author.map((a: any) => a.name)
      : [entry.author.name];

    const categories = Array.isArray(entry.category)
      ? entry.category.map((c: any) => c['@_term'])
      : [entry.category['@_term']];

    return {
      id: arxivId,
      title: entry.title.replace(/\s+/g, ' ').trim(),
      authors,
      abstract: entry.summary.replace(/\s+/g, ' ').trim(),
      published,
      updated,
      link: entry.id.replace(/v\d+$/, ''),
      pdfLink: entry.id.replace('abs', 'pdf'),
      categories
    };

  } catch (error) {
    console.error(`Error fetching paper ${arxivId}:`, error);
    return null;
  }
}
