import {
  IngestionStats,
  CanonicalEntity,
  RawSourceRecord,
  EntityLink,
  MergeSuggestion,
  SchemaMappingProposal,
  NLSearchTranslationResponse,
  ColumnMappingItem,
} from '../types/index';
import { auth } from './firebase';

const API_BASE = '/api';

async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (e) {
    console.warn('[authedFetch] Error getting auth token:', e);
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

export async function fetchStats(): Promise<IngestionStats> {
  const res = await authedFetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Không thể tải thống kê hệ thống');
  return res.json();
}

export async function fetchEntities(params: {
  search?: string;
  organization?: string;
  minAppearances?: number;
  page?: number;
  limit?: number;
  structuredFilters?: any[];
}): Promise<{
  items: CanonicalEntity[];
  total: number;
  page: number;
  limit: number;
}> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.organization) query.set('organization', params.organization);
  if (params.minAppearances) query.set('minAppearances', String(params.minAppearances));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.structuredFilters && params.structuredFilters.length > 0) {
    query.set('structuredFilters', JSON.stringify(params.structuredFilters));
  }

  const res = await authedFetch(`${API_BASE}/entities?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tìm kiếm danh sách thực thể');
  return res.json();
}

export async function fetchEntityDetails(id: string): Promise<{
  canonicalEntity: CanonicalEntity;
  rawRecords: {
    rawRecord: RawSourceRecord;
    link: EntityLink;
    fieldDifferences: Record<string, string>;
  }[];
}> {
  const res = await authedFetch(`${API_BASE}/entities/${id}`);
  if (!res.ok) throw new Error('Không thể tải chi tiết thực thể');
  return res.json();
}

export async function inferSchema(rows: any[][], fileName: string): Promise<SchemaMappingProposal> {
  const res = await authedFetch(`${API_BASE}/schema/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, fileName }),
  });
  if (!res.ok) throw new Error('Không thể phân tích cấu trúc bảng tính');
  return res.json();
}

export async function ingestSpreadsheet(payload: {
  sourceFileId: string;
  sourceFileName: string;
  sourceType: 'drive_sheets' | 'local_xlsx' | 'seed';
  headerRowIndex: number;
  mappings: ColumnMappingItem[];
  rows: any[][];
  defaultEventName?: string;
  defaultEventDate?: string;
}): Promise<{
  success: boolean;
  totalIngested: number;
  newEntitiesCreated: number;
  pendingMergeSuggestionsCount: number;
  fallbackEmbeddingCount: number;
  suggestions: MergeSuggestion[];
}> {
  const res = await authedFetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Không thể nạp và chuẩn hóa dữ liệu');
  return res.json();
}

export async function fetchPendingMerges(): Promise<MergeSuggestion[]> {
  const res = await authedFetch(`${API_BASE}/merges/pending`);
  if (!res.ok) throw new Error('Không thể tải danh sách gợi ý gộp');
  return res.json();
}

export async function adjudicateMerge(payload: {
  suggestionId: string;
  rawRecordId: string;
  canonicalEntityId: string;
  action: 'approve' | 'reject';
  reason?: string;
}): Promise<{ success: boolean; action: string }> {
  const res = await authedFetch(`${API_BASE}/merges/adjudicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Lỗi khi thực hiện phê duyệt');
  return res.json();
}

export async function translateSearch(query: string): Promise<NLSearchTranslationResponse> {
  const res = await authedFetch(`${API_BASE}/search/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Lỗi khi biên dịch câu truy vấn');
  return res.json();
}

export async function listDriveFiles(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await authedFetch(`${API_BASE}/drive/files`, { headers });
  if (!res.ok) throw new Error('Không thể đọc danh sách tệp Google Drive');
  return res.json();
}

export async function fetchDriveSheet(fileId: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await authedFetch(`${API_BASE}/drive/fetch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) throw new Error('Không thể đọc nội dung Google Sheets');
  return res.json();
}

export async function parseUploadedXlsx(base64Data: string, fileName: string) {
  const res = await authedFetch(`${API_BASE}/upload/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, fileName }),
  });
  if (!res.ok) throw new Error('Không thể phân tích tệp Excel tải lên');
  return res.json();
}

export async function seedDemoData(): Promise<any> {
  const res = await authedFetch(`${API_BASE}/seed`, { method: 'POST' });
  if (!res.ok) throw new Error('Không thể nạp dữ liệu mẫu');
  return res.json();
}
