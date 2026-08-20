import {
  IngestionStats,
  CanonicalEntity,
  RawSourceRecord,
  EntityLink,
  MergeSuggestion,
  SchemaMappingProposal,
  NLSearchTranslationResponse,
  ColumnMappingItem,
  DriveFileItem,
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

async function parseJsonResponse<T>(res: Response, fallbackErrorMsg: string): Promise<T> {
  const text = await res.text().catch(() => '');
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    if (json && (json.error || json.detail || json.message)) {
      throw new Error(json.error || json.detail || json.message);
    }
    const isHtml = text.startsWith('<!DOCTYPE html') || text.includes('<html');
    if (isHtml) {
      throw new Error(`${fallbackErrorMsg}: Máy chủ đang khởi động hoặc chưa sẵn sàng (Mã ${res.status}). Vui lòng tải lại trang.`);
    }
    throw new Error(fallbackErrorMsg + (text && text.length < 150 ? `: ${text}` : ` (Mã lỗi ${res.status})`));
  }

  if (json !== null) {
    return json as T;
  }

  const isHtml = text.startsWith('<!DOCTYPE html') || text.includes('<html');
  if (isHtml) {
    throw new Error(`${fallbackErrorMsg}: Máy chủ đang khởi động hoặc phản hồi không đúng định dạng. Vui lòng tải lại trang.`);
  }

  throw new Error(`Định dạng phản hồi không hợp lệ từ máy chủ (${res.status})` + (text && text.length < 150 ? `: ${text}` : ''));
}

export async function fetchStats(): Promise<IngestionStats> {
  const res = await authedFetch(`${API_BASE}/stats`);
  return parseJsonResponse<IngestionStats>(res, 'Không thể tải thống kê hệ thống');
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
  return parseJsonResponse<{
    items: CanonicalEntity[];
    total: number;
    page: number;
    limit: number;
  }>(res, 'Không thể tìm kiếm danh sách thực thể');
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
  return parseJsonResponse<{
    canonicalEntity: CanonicalEntity;
    rawRecords: {
      rawRecord: RawSourceRecord;
      link: EntityLink;
      fieldDifferences: Record<string, string>;
    }[];
  }>(res, 'Không thể tải chi tiết thực thể');
}

export async function inferSchema(rows: any[][], fileName: string): Promise<SchemaMappingProposal> {
  const res = await authedFetch(`${API_BASE}/schema/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, fileName }),
  });
  return parseJsonResponse<SchemaMappingProposal>(res, 'Không thể phân tích cấu trúc bảng tính');
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
  skippedDuplicateCount: number;
  suggestions: MergeSuggestion[];
}> {
  const res = await authedFetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{
    success: boolean;
    totalIngested: number;
    newEntitiesCreated: number;
    pendingMergeSuggestionsCount: number;
    fallbackEmbeddingCount: number;
    skippedDuplicateCount: number;
    suggestions: MergeSuggestion[];
  }>(res, 'Không thể nạp và chuẩn hóa dữ liệu');
}

export async function fetchPendingMerges(): Promise<MergeSuggestion[]> {
  const res = await authedFetch(`${API_BASE}/merges/pending`);
  return parseJsonResponse<MergeSuggestion[]>(res, 'Không thể tải danh sách gợi ý gộp');
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
  return parseJsonResponse<{ success: boolean; action: string }>(res, 'Lỗi khi thực hiện phê duyệt');
}

export async function translateSearch(query: string): Promise<NLSearchTranslationResponse> {
  const res = await authedFetch(`${API_BASE}/search/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return parseJsonResponse<NLSearchTranslationResponse>(res, 'Lỗi khi biên dịch câu truy vấn');
}

export async function listDriveFiles(token?: string): Promise<DriveFileItem[]> {
  const headers: Record<string, string> = {};
  // Drive's OAuth access token travels in its own header: Authorization is reserved
  // for the Firebase ID token that requireAuth verifies, and authedFetch overwrites it.
  if (token) headers['X-Drive-Token'] = token;
  const res = await authedFetch(`${API_BASE}/drive/files`, { headers });
  return parseJsonResponse<DriveFileItem[]>(res, 'Không thể đọc danh sách tệp Google Drive');
}

export async function fetchDriveSheet(fileId: string, token?: string): Promise<{ rows: any[][]; title?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Drive-Token'] = token;
  const res = await authedFetch(`${API_BASE}/drive/fetch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileId }),
  });
  return parseJsonResponse<{ rows: any[][]; title?: string }>(res, 'Không thể đọc nội dung Google Sheets');
}

export async function parseUploadedXlsx(base64Data: string, fileName: string): Promise<{ rows: any[][]; sheetNames?: string[]; fileId?: string }> {
  const res = await authedFetch(`${API_BASE}/upload/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, fileName }),
  });
  return parseJsonResponse<{ rows: any[][]; sheetNames?: string[]; fileId?: string }>(res, 'Không thể phân tích tệp Excel tải lên');
}

export async function seedDemoData(): Promise<any> {
  const res = await authedFetch(`${API_BASE}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'XOA_TOAN_BO_DU_LIEU' }),
  });
  return parseJsonResponse<any>(res, 'Không thể nạp dữ liệu mẫu');
}
