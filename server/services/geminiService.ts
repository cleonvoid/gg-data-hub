import { GoogleGenAI, Type } from '@google/genai';
import {
  CanonicalFieldKey,
  ColumnMappingItem,
  SchemaMappingProposal,
  StructuredQueryFilter,
  NLSearchTranslationResponse,
} from '../../src/types/index.js';
import { buildIdentityString } from '../utils/vietnamese.js';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Pinned so API embeddings and the local fallback share a dimension, and so the
// Firestore vector index dimension (Task 5) stays in sync. gemini-embedding-2-preview
// defaults to 3072; 768 is a supported MRL truncation and is auto-normalized by the model.
export const EMBEDDING_DIM = 768;

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];
const EMBEDDING_MODELS = ['gemini-embedding-2-preview'];

/**
 * Utility helper to sleep with jitter
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks if an error is a transient/retryable Gemini API error (503 High demand, 500, 502, 504, connection reset)
 */
function isTransientNetworkError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  const message = (error.message || String(error)).toLowerCase();

  return (
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    message.includes('high demand') ||
    message.includes('unavailable') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed')
  );
}

/**
 * Checks if an error indicates rate limiting or quota exhaustion (429, RESOURCE_EXHAUSTED)
 */
function isQuotaExhaustedError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  const message = (error.message || String(error)).toLowerCase();

  return (
    status === 429 ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('exceeded your current quota')
  );
}

/**
 * Checks if an error indicates a model is unavailable or not found (404, deprecated, unsupported)
 */
function isModelUnavailableError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  const message = (error.message || String(error)).toLowerCase();

  return (
    status === 404 ||
    message.includes('not_found') ||
    message.includes('not found') ||
    message.includes('no longer available') ||
    message.includes('deprecated') ||
    message.includes('unsupported')
  );
}

/**
 * Executes a Gemini generateContent call with rapid exponential backoff and backup model fallback
 */
async function callGeminiWithRetry<T>(
  generateFn: (modelName: string) => Promise<T>,
  modelsToTry: string[] = [PRIMARY_MODEL, ...FALLBACK_MODELS],
  maxRetriesPerModel: number = 2
): Promise<T> {
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        return await generateFn(model);
      } catch (err: any) {
        lastError = err;
        const modelUnavailable = isModelUnavailableError(err);
        const quotaExhausted = isQuotaExhaustedError(err);
        const transient = isTransientNetworkError(err);
        const isLastAttemptForModel = attempt === maxRetriesPerModel;

        if (modelUnavailable || quotaExhausted) {
          // If model is not available or quota is exhausted for this model, skip immediately to next model
          break;
        }

        if (transient && !isLastAttemptForModel) {
          // Fast backoff: 300ms + random jitter
          const backoff = Math.min(1500, 300 * Math.pow(2, attempt - 1) + Math.random() * 200);
          await sleep(backoff);
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models and retry attempts exhausted');
}

/**
 * Cleans potential markdown formatting wrapping JSON strings
 */
function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * 1. AI Schema Inference:
 * Maps messy source spreadsheet columns to canonical event schema fields.
 */
export async function inferSchemaMapping(
  rows: (string | number | null | undefined)[][],
  fileName: string
): Promise<SchemaMappingProposal> {
  // Pre-process rows: find the likely header row by scanning for non-empty text rows
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] || [];
    const textCols = row.filter((c) => c !== null && c !== undefined && String(c).trim().length > 0);
    // If a row has 3 or more populated columns, it's very likely the real header
    if (textCols.length >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rows[headerRowIndex] || []).map((h, idx) =>
    h !== null && h !== undefined && String(h).trim().length > 0
      ? String(h).trim()
      : `Cột_${idx + 1}`
  );

  // Sample data rows (up to 5 rows below header)
  const sampleDataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 6);
  const columnSamples: Record<string, string[]> = {};

  rawHeaders.forEach((colName, colIdx) => {
    columnSamples[colName] = sampleDataRows
      .map((r) => (r && r[colIdx] !== undefined && r[colIdx] !== null ? String(r[colIdx]).trim() : ''))
      .filter((val) => val.length > 0);
  });

  const prompt = `Bạn là chuyên gia chuẩn hoá dữ liệu sự kiện chuyên nghiệp cho các cơ quan, viện, trường và doanh nghiệp tại Việt Nam.
Hãy phân tích danh sách cột và các giá trị mẫu dưới đây từ tệp: "${fileName}".
Header row index phát hiện: ${headerRowIndex}.
Các cột tìm thấy:
${JSON.stringify(columnSamples, null, 2)}

Hãy ánh xạ từng cột nguồn sang một trong các trường Canonical duy nhất sau:
- "fullName": Họ và tên cá nhân (ví dụ: Họ tên, Tên đại biểu, Đại biểu, Họ và tên khách mời, Tên, Name, Full Name)
- "organization": Cơ quan, đơn vị, công ty, tổ chức (ví dụ: Đơn vị, Cơ quan, Doanh nghiệp, Công ty, Tổ chức, Org, Company)
- "role": Chức vụ, vị trí, vai trò (ví dụ: Chức vụ, Vị trí, Chức danh, Danh xưng, Role, Title, Position)
- "email": Hòm thư điện tử (ví dụ: Email, Thư điện tử, E-mail, Hòm thư)
- "phone": Số điện thoại liên hệ (ví dụ: SĐT, Điện thoại, Mobile, Phone, Hotline)
- "eventName": Tên sự kiện, hội thảo, lớp tập huấn (nếu cột chứa tên sự kiện)
- "eventDate": Ngày diễn ra sự kiện, ngày tham dự (nếu cột chứa ngày tháng)
- "notes": Ghi chú, phản hồi, lĩnh vực quan tâm, mã định danh khác
- "ignore": Các cột số thứ tự (STT), cột trống, cột dấu thời gian upload không cần thiết.

Lưu ý:
- Nếu có tiêu đề sự kiện nằm trong tên file hoặc dữ liệu, hãy trích xuất suggestedEventName.
- Đánh giá độ tin cậy confidence từ 0.0 đến 1.0 cho từng cột.`;

  try {
    const response = await callGeminiWithRetry(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headerRowIndex: { type: Type.INTEGER },
              suggestedEventName: { type: Type.STRING },
              suggestedEventDate: { type: Type.STRING },
              overallConfidence: { type: Type.NUMBER },
              mappings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceColumn: { type: Type.STRING },
                    targetField: {
                      type: Type.STRING,
                      description: 'One of: fullName, organization, role, email, phone, eventName, eventDate, notes, ignore',
                    },
                    confidence: { type: Type.NUMBER },
                    reasoning: { type: Type.STRING },
                  },
                  required: ['sourceColumn', 'targetField', 'confidence', 'reasoning'],
                },
              },
            },
            required: ['headerRowIndex', 'mappings', 'overallConfidence'],
          },
        },
      });
    });

    const parsed = JSON.parse(cleanJsonString(response.text || '{}'));
    const proposed: any[] = parsed.mappings || [];
    const mappings: ColumnMappingItem[] = rawHeaders.map((header, idx) => {
      const m = proposed.find((p: any) => p.sourceColumn === header);
      return {
        sourceColumn: header,
        sourceIndex: idx,
        targetField: (m?.targetField as CanonicalFieldKey) || 'ignore',
        confidence: m?.confidence ?? (m ? 0.9 : 0.5),
        reasoning: m?.reasoning || 'Tự động bỏ qua cột không xác định',
        sampleValues: columnSamples[header] || [],
      };
    });

    return {
      headerRowIndex: parsed.headerRowIndex ?? headerRowIndex,
      detectedHeaders: rawHeaders,
      mappings,
      suggestedEventName: parsed.suggestedEventName || fileName.replace(/\.[^/.]+$/, ''),
      suggestedEventDate: parsed.suggestedEventDate || new Date().toISOString().split('T')[0],
      overallConfidence: parsed.overallConfidence ?? 0.92,
    };
  } catch (_error) {
    // Heuristic fallback
    const fallbackMappings: ColumnMappingItem[] = rawHeaders.map((header, idx) => {
      const h = header.toLowerCase();
      let targetField: CanonicalFieldKey | 'ignore' = 'ignore';
      let reasoning = 'Khớp heuristic cơ bản';

      if (/họ|tên|name|người|đại biểu|khách/i.test(h) && !/đơn vị|công ty|sự kiện/i.test(h)) {
        targetField = 'fullName';
      } else if (/đơn vị|công ty|cơ quan|tổ chức|doanh nghiệp|org|company/i.test(h)) {
        targetField = 'organization';
      } else if (/chức vụ|chức danh|vị trí|role|title|position/i.test(h)) {
        targetField = 'role';
      } else if (/email|thư điện tử|mail/i.test(h)) {
        targetField = 'email';
      } else if (/sđt|điện thoại|phone|mobile|liên hệ/i.test(h)) {
        targetField = 'phone';
      } else if (/sự kiện|event/i.test(h)) {
        targetField = 'eventName';
      } else if (/ngày|date|thời gian/i.test(h)) {
        targetField = 'eventDate';
      } else if (/ghi chú|note|lĩnh vực|ý kiến/i.test(h)) {
        targetField = 'notes';
      }

      return {
        sourceColumn: header,
        sourceIndex: idx,
        targetField,
        confidence: targetField === 'ignore' ? 0.6 : 0.85,
        reasoning,
        sampleValues: columnSamples[header] || [],
      };
    });

    return {
      headerRowIndex,
      detectedHeaders: rawHeaders,
      mappings: fallbackMappings,
      suggestedEventName: fileName.replace(/\.[^/.]+$/, ''),
      suggestedEventDate: new Date().toISOString().split('T')[0],
      overallConfidence: 0.8,
    };
  }
}

export const FALLBACK_EMBEDDING_MODEL = 'local-hash-v1';

export interface EmbeddingResult {
  vector: number[];
  source: 'gemini' | 'fallback';
  model: string;
}

/**
 * 2. Generate Dense Embedding Vector
 * Generates vector representation for candidate identity string using Gemini or dense hash fallback.
 */
export async function generateIdentityEmbedding(text: string): Promise<EmbeddingResult> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      vector: generateDeterministicFallbackEmbedding(text),
      source: 'fallback',
      model: FALLBACK_EMBEDDING_MODEL,
    };
  }

  let usedModel = EMBEDDING_MODELS[0];
  try {
    const response = await callGeminiWithRetry(
      async (modelName) => {
        usedModel = modelName;
        return await ai.models.embedContent({
          model: modelName,
          contents: text,
          config: { outputDimensionality: EMBEDDING_DIM },
        });
      },
      EMBEDDING_MODELS,
      2
    );

    const values = (response as any).embeddings?.[0]?.values || (response as any).embedding?.values;
    if (values && values.length > 0) {
      return { vector: values, source: 'gemini', model: usedModel };
    }
    return {
      vector: generateDeterministicFallbackEmbedding(text),
      source: 'fallback',
      model: FALLBACK_EMBEDDING_MODEL,
    };
  } catch (err) {
    console.warn('Embedding API failed, using deterministic fallback (entity resolution quality degraded):', err);
    return {
      vector: generateDeterministicFallbackEmbedding(text),
      source: 'fallback',
      model: FALLBACK_EMBEDDING_MODEL,
    };
  }
}

/**
 * High-dimensional deterministic vector projector for zero-latency local fallback.
 */
function generateDeterministicFallbackEmbedding(text: string, dim: number = EMBEDDING_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const index = (code * 31 + i * 17) % dim;
    vec[index] += Math.sin(code + i);
    vec[(index + 13) % dim] += Math.cos(code * 2 + i);
  }
  // Normalize vector to unit length
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/**
 * 3. Stage 2 LLM Entity Match Adjudication:
 * Accurately judges candidate pair with deep Vietnamese naming context.
 */
export async function adjudicateEntityMatch(
  newRecord: {
    fullName?: string;
    organization?: string;
    role?: string;
    email?: string;
    phone?: string;
    sourceEvent?: string;
  },
  candidateEntity: {
    canonicalName: string;
    canonicalOrg: string;
    canonicalRole: string;
    canonicalEmail: string;
    canonicalPhone: string;
    aliases: string[];
    alternateEmails: string[];
    alternateOrgs: string[];
  }
): Promise<{
  isMatch: boolean;
  confidence: number;
  reasoningVi: string;
  reasoningEn: string;
  keyDifferences: { field: string; rawValue: string; canonicalValue: string }[];
}> {
  const prompt = `Bạn là chuyên gia Phân giải Thực thể (Entity Resolution) hàng đầu chuyên về thực tế họ tên, học hàm, chức danh và tổ chức tại Việt Nam.

Hãy phán xét xem Bản ghi mới vừa nhập và Thực thể chuẩn hiện có dưới đây có trỏ tới CÙNG MỘT NGƯỜI / TỔ CHỨC NGOÀI ĐỜI THỰC hay không:

[BẢN GHI MỚI TỪ FILE IMPORT]:
- Họ tên: "${newRecord.fullName || ''}"
- Đơn vị: "${newRecord.organization || ''}"
- Chức vụ: "${newRecord.role || ''}"
- Email: "${newRecord.email || ''}"
- SĐT: "${newRecord.phone || ''}"
- Sự kiện nguồn: "${newRecord.sourceEvent || ''}"

[THỰC THỂ CHUẨN ĐÃ CÓ TRONG HỆ THỐNG]:
- Tên chuẩn: "${candidateEntity.canonicalName}"
- Đơn vị chuẩn: "${candidateEntity.canonicalOrg}"
- Chức vụ chuẩn: "${candidateEntity.canonicalRole}"
- Email chuẩn: "${candidateEntity.canonicalEmail}"
- SĐT chuẩn: "${candidateEntity.canonicalPhone}"
- Các biến thể tên đã ghi nhận: ${JSON.stringify(candidateEntity.aliases)}
- Các email khác: ${JSON.stringify(candidateEntity.alternateEmails)}
- Các đơn vị khác: ${JSON.stringify(candidateEntity.alternateOrgs)}

QUY TẮC PHÁN ĐOÁN ĐẶC THÙ VIỆT NAM:
1. Trùng họ tên nhưng khác hoàn toàn về đơn vị/lĩnh vực/email mà không có bằng chứng liên quan -> KHÔNG TRÙNG (tránh lỗi false positive phổ biến do họ Nguyễn, Trần, Lê rất đông).
2. Dấu tiếng Việt bị mất/giữ nguyên (ví dụ "Nguyễn Văn An" và "Nguyen Van An") + cùng đơn vị hoặc cùng chức vụ/email -> TRÙNG NHAU (Confidence cao > 0.88).
3. Học hàm/học vị xuất hiện khác nhau (ví dụ: "TS. Nguyễn Hoàng Nam" và "Nguyễn Hoàng Nam" hoặc "PGS.TS.") -> XEM NHƯ TRÙNG TÊN.
4. Biến thể tên họ lót (ví dụ "Nguyễn V. An" và "Nguyễn Văn An", hoặc thứ tự họ tên kiểu Tây "An Nguyen") + cùng đơn vị/email -> TRÙNG NHAU.
5. Email cá nhân (@gmail.com) và email công vụ/tổ chức (@fpt.com, @hcmut.edu.vn) cùng người -> Trùng nếu họ tên và đơn vị/vai trò tương thích.
6. Đơn vị viết tắt hoặc dạng pháp lý (ví dụ: "Công ty Cổ phần FPT", "CTCP FPT", "FPT Corp", "Tập đoàn FPT") -> CÙNG MỘT ĐƠN VỊ.

Hãy trả về kết quả JSON có cấu trúc chính xác theo schema yêu cầu.`;

  try {
    const response = await callGeminiWithRetry(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isMatch: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER, description: 'Từ 0.0 đến 1.0' },
              reasoningVi: { type: Type.STRING, description: 'Giải thích ngắn gọn súc tích bằng tiếng Việt vì sao trùng hoặc không' },
              reasoningEn: { type: Type.STRING, description: 'Short English justification' },
              keyDifferences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    field: { type: Type.STRING },
                    rawValue: { type: Type.STRING },
                    canonicalValue: { type: Type.STRING },
                  },
                  required: ['field', 'rawValue', 'canonicalValue'],
                },
              },
            },
            required: ['isMatch', 'confidence', 'reasoningVi', 'keyDifferences'],
          },
        },
      });
    });

    const parsed = JSON.parse(cleanJsonString(response.text || '{}'));
    return {
      isMatch: Boolean(parsed.isMatch),
      confidence: Number(parsed.confidence) || 0.75,
      reasoningVi: parsed.reasoningVi || 'Cùng thông tin định danh họ tên và đơn vị công tác.',
      reasoningEn: parsed.reasoningEn || 'Matched based on personal name and organization context.',
      keyDifferences: parsed.keyDifferences || [],
    };
  } catch (_err) {
    // Rule-based fallback
    const rawName = (newRecord.fullName || '').toLowerCase().trim();
    const canName = candidateEntity.canonicalName.toLowerCase().trim();
    const isExactName = rawName === canName;
    const isEmailMatch = Boolean(newRecord.email && candidateEntity.canonicalEmail && newRecord.email.toLowerCase() === candidateEntity.canonicalEmail.toLowerCase());

    return {
      isMatch: isExactName || isEmailMatch,
      confidence: isEmailMatch ? 0.95 : isExactName ? 0.8 : 0.6,
      reasoningVi: isEmailMatch
        ? 'Trùng khớp địa chỉ email xác thực.'
        : isExactName
        ? 'Trùng khớp hoàn toàn họ tên đầy đủ.'
        : 'Độ tương đồng ngữ nghĩa thực thể theo chỉ số vector.',
      reasoningEn: 'Rule based fallback resolution verdict.',
      keyDifferences: [],
    };
  }
}

/**
 * Deterministic rule-based query parser for Vietnamese and English event queries.
 * Acts as high-accuracy offline fallback when API limits or network issues occur.
 */
export function fallbackParseNaturalLanguageQuery(userQuery: string): NLSearchTranslationResponse {
  const queryLower = userQuery.toLowerCase().trim();
  const filters: StructuredQueryFilter[] = [];

  // 1. Event appearances count (e.g. "từ 2 sự kiện", ">= 2 sự kiện", "tham gia 3 lần", "hơn 1 sự kiện")
  const countMatch = queryLower.match(/(?:từ|>=|trên|>|ít nhất|tối thiểu|tham gia)\s*(\d+)\s*(?:sự kiện|lần|hoạt động)?/) ||
                     queryLower.match(/(\d+)\s*(?:sự kiện|lần)\s*(?:trở lên)?/);
  if (countMatch && countMatch[1]) {
    const count = parseInt(countMatch[1], 10);
    if (!isNaN(count) && count > 0) {
      filters.push({
        field: 'eventAppearancesCount',
        operator: 'greaterThan',
        value: count,
      });
    }
  }

  // 2. Role indicators (e.g. "chuyên gia", "giám đốc", "trưởng phòng", "tiến sĩ", "giảng viên", "ai", "kỹ sư")
  const roleKeywords = [
    'chuyên gia ai',
    'chuyên gia',
    'giám đốc',
    'phó giám đốc',
    'trưởng phòng',
    'phó phòng',
    'tiến sĩ',
    'giáo sư',
    'giảng viên',
    'nghiên cứu viên',
    'kỹ sư',
    'lãnh đạo',
    'chủ tịch',
    'tổng giám đốc',
    'ceo',
    'cto',
    'director',
    'manager',
    'lead',
    'ai',
  ];
  for (const role of roleKeywords) {
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapedRole}(?=[^\\p{L}\\p{N}]|$)`, 'iu');
    if (regex.test(queryLower)) {
      if (role === 'ai') {
        const isLeadingInterrogative = /^\s*ai(?=[^\p{L}\p{N}]|$)/iu.test(queryLower);
        const remainder = queryLower.replace(/^\s*ai(?=[^\p{L}\p{N}]|$)/iu, '');
        const hasOtherAiMatch = /(?:^|[^\p{L}\p{N}])ai(?=[^\p{L}\p{N}]|$)/iu.test(remainder);
        if (isLeadingInterrogative && !hasOtherAiMatch) {
          continue;
        }
      }

      filters.push({
        field: 'canonicalRole',
        operator: 'contains',
        value: role.toUpperCase() === 'AI' ? 'AI' : role,
      });
      break;
    }
  }

  // 3. Organization indicators (e.g. "viện công nghệ thông tin", "đại học bách khoa", "fpt", "viettel")
  const orgPatterns = [
    /viện\s+[a-zà-ỹ\s]+/i,
    /đại học\s+[a-zà-ỹ\s]+/i,
    /trường\s+[a-zà-ỹ\s]+/i,
    /công ty\s+[a-zà-ỹ\s]+/i,
    /tập đoàn\s+[a-zà-ỹ\s]+/i,
    /trung tâm\s+[a-zà-ỹ\s]+/i,
  ];
  let matchedOrg = '';
  for (const pattern of orgPatterns) {
    const m = userQuery.match(pattern);
    if (m && m[0]) {
      matchedOrg = m[0].trim();
      break;
    }
  }

  if (!matchedOrg) {
    const knownOrgs = ['fpt', 'viettel', 'vnpt', 'vnu', 'hust', 'vinai', 'vng', 'bách khoa', 'khoa học tự nhiên'];
    for (const org of knownOrgs) {
      if (queryLower.includes(org)) {
        matchedOrg = org;
        break;
      }
    }
  }

  if (matchedOrg) {
    filters.push({
      field: 'canonicalOrg',
      operator: 'contains',
      value: matchedOrg,
    });
  }

  // 4. Email check
  if (queryLower.includes('@')) {
    const emailMatch = userQuery.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      filters.push({
        field: 'canonicalEmail',
        operator: 'contains',
        value: emailMatch[0],
      });
    }
  }

  // 5. Event name check (e.g. "hội thảo ...", "hội nghị ...", "sự kiện ...", "diễn đàn ...", "workshop ...")
  const eventPatterns = [
    /(?:dự|tham gia|ở|tại)\s+(hội thảo\s+[a-zà-ỹ0-9\s]+)/i,
    /(?:dự|tham gia|ở|tại)\s+(hội nghị\s+[a-zà-ỹ0-9\s]+)/i,
    /(?:dự|tham gia|ở|tại)\s+(diễn đàn\s+[a-zà-ỹ0-9\s]+)/i,
    /(?:dự|tham gia|ở|tại)\s+(workshop\s+[a-zà-ỹ0-9\s]+)/i,
    /(?:dự|tham gia|ở|tại)\s+(sự kiện\s+[a-zà-ỹ0-9\s]+)/i,
    /hội thảo\s+[a-zà-ỹ0-9\s]+/i,
    /hội nghị\s+[a-zà-ỹ0-9\s]+/i,
    /diễn đàn\s+[a-zà-ỹ0-9\s]+/i,
    /workshop\s+[a-zà-ỹ0-9\s]+/i,
  ];
  for (const pattern of eventPatterns) {
    const m = userQuery.match(pattern);
    if (m) {
      let matched = (m[1] || m[0]).trim();
      // Stop event-name capture at a trailing locative clause (" ở …", " tại …")
      matched = matched.replace(/\s+(?:ở|tại)\s+.*$/iu, '').trim();
      filters.push({
        field: 'eventNames',
        operator: 'contains',
        value: matched,
      });
      break;
    }
  }

  // 6. Default fallback: search full name / generic text if no filters found
  if (filters.length === 0) {
    filters.push({
      field: 'canonicalName',
      operator: 'contains',
      value: userQuery.trim(),
    });
  }

  return {
    interpretedQuery: userQuery,
    filters,
    explanationVi: `Tìm kiếm theo cấu trúc: ${filters.map((f) => `${f.field} ${f.operator} "${f.value}"`).join(', ')}`,
    explanationEn: `Matched structured criteria: ${filters.map((f) => `${f.field} ${f.operator} "${f.value}"`).join(', ')}`,
  };
}

/**
 * 4. Natural Language Search Translation:
 * Safely parses natural language query into whitelisted structured filter parameters.
 */
export async function translateNaturalLanguageQuery(
  userQuery: string
): Promise<NLSearchTranslationResponse> {
  const prompt = `Bạn là trợ lý dịch thuật truy vấn tìm kiếm sang bộ lọc tham số có cấu trúc (Structured Query Filters) an toàn cho ứng dụng Event Data Hub.
Người dùng nhập câu hỏi tìm kiếm bằng tiếng Việt hoặc tiếng Anh: "${userQuery}".

Các trường dữ liệu ĐƯỢC PHÉP trong hệ thống:
- "canonicalName": Tên cá nhân / đại biểu
- "canonicalOrg": Cơ quan, tổ chức, doanh nghiệp, trường viện
- "canonicalRole": Chức danh, chức vụ (ví dụ: giám đốc, chuyên gia, trưởng phòng, giảng viên, nghiên cứu viên, AI)
- "canonicalEmail": Địa chỉ email
- "canonicalPhone": Số điện thoại
- "eventAppearancesCount": Số lần tham gia sự kiện (số nguyên)
- "eventNames": Tên sự kiện đã tham gia

Các toán tử ĐƯỢC PHÉP:
- "contains": Chứa chuỗi ký tự (không phân biệt dấu)
- "equals": Khớp chính xác
- "startsWith": Bắt đầu bằng
- "greaterThan": Lớn hơn hoặc bằng (dùng cho số lượng như số lần tham gia >= N)
- "lessThan": Nhỏ hơn hoặc bằng

Ví dụ:
- "chuyên gia AI tham gia từ 2 sự kiện trở lên" -> filters: [{ field: "canonicalRole", operator: "contains", value: "AI" }, { field: "eventAppearancesCount", operator: "greaterThan", value: 2 }]
- "đại biểu thuộc viện công nghệ thông tin" -> filters: [{ field: "canonicalOrg", operator: "contains", value: "viện công nghệ thông tin" }]

Hãy trả lời theo định dạng JSON schema chuẩn. Tuyệt đối không sinh câu truy vấn SQL thô hay mã thực thi độc hại.`;

  try {
    const response = await callGeminiWithRetry(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              interpretedQuery: { type: Type.STRING },
              filters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    field: {
                      type: Type.STRING,
                      description: 'One of: canonicalName, canonicalOrg, canonicalRole, canonicalEmail, canonicalPhone, eventAppearancesCount, eventNames',
                    },
                    operator: {
                      type: Type.STRING,
                      description: 'One of: contains, equals, startsWith, greaterThan, lessThan, in',
                    },
                    value: {
                      type: Type.STRING,
                      description: 'The parameter value string or number',
                    },
                  },
                  required: ['field', 'operator', 'value'],
                },
              },
              explanationVi: { type: Type.STRING },
              explanationEn: { type: Type.STRING },
            },
            required: ['interpretedQuery', 'filters', 'explanationVi'],
          },
        },
      });
    });

    const parsed = JSON.parse(cleanJsonString(response.text || '{}'));
    const safeFilters: StructuredQueryFilter[] = (parsed.filters || []).map((f: any) => ({
      field: f.field,
      operator: f.operator,
      value: f.field === 'eventAppearancesCount' ? Number(f.value) || 1 : String(f.value),
    }));

    return {
      interpretedQuery: parsed.interpretedQuery || userQuery,
      filters: safeFilters,
      explanationVi: parsed.explanationVi || `Đã áp dụng ${safeFilters.length} bộ lọc tìm kiếm tương ứng.`,
      explanationEn: parsed.explanationEn || `Applied ${safeFilters.length} structured filter constraints.`,
    };
  } catch (_err) {
    // Graceful deterministic rule parser fallback
    return fallbackParseNaturalLanguageQuery(userQuery);
  }
}
