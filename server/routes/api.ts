import { Router, Request, Response } from 'express';
import { db } from '../db/store.js';
import {
  inferSchemaMapping,
  generateIdentityEmbedding,
  adjudicateEntityMatch,
  translateNaturalLanguageQuery,
} from '../services/geminiService.js';
import {
  listDriveSpreadsheets,
  fetchGoogleSheetRows,
  parseLocalSpreadsheetBuffer,
} from '../services/sheetsService.js';
import { seedInitialEventData } from '../db/seedData.js';
import {
  RawSourceRecord,
  CanonicalSchema,
  ColumnMappingItem,
  MergeSuggestion,
} from '../../src/types/index.js';
import { buildIdentityString } from '../utils/vietnamese.js';

export const apiRouter = Router();

/**
 * 1. Summary Stats
 */
apiRouter.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Query Canonical Entities
 */
apiRouter.get('/entities', (req: Request, res: Response) => {
  try {
    const {
      search,
      organization,
      minAppearances,
      page,
      limit,
      structuredFilters,
    } = req.query;

    let parsedFilters = undefined;
    if (structuredFilters) {
      try {
        parsedFilters = JSON.parse(String(structuredFilters));
      } catch {}
    }

    const result = db.queryEntities({
      search: search ? String(search) : undefined,
      organization: organization ? String(organization) : undefined,
      minAppearances: minAppearances ? Number(minAppearances) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      structuredFilters: parsedFilters,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. Canonical Entity Details & Lineage (Raw Records + Diffs)
 */
apiRouter.get('/entities/:id', (req: Request, res: Response) => {
  try {
    const details = db.getEntityDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'Không tìm thấy thực thể chuẩn hóa' });
    }
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. AI Schema Mapping Inference
 */
apiRouter.post('/schema/infer', async (req: Request, res: Response) => {
  try {
    const { rows, fileName } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Dữ liệu hàng không hợp lệ' });
    }

    const proposal = await inferSchemaMapping(rows, fileName || 'spreadsheet.xlsx');
    res.json(proposal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. Import & Ingestion with Two-Stage Entity Resolution
 */
apiRouter.post('/ingest', async (req: Request, res: Response) => {
  try {
    const {
      sourceFileId,
      sourceFileName,
      sourceType,
      headerRowIndex,
      mappings,
      rows,
      defaultEventName,
      defaultEventDate,
    } = req.body;

    if (!rows || !Array.isArray(rows) || !mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ error: 'Thiếu thông tin ánh xạ hoặc dữ liệu hàng' });
    }

    const dataRows = rows.slice((headerRowIndex ?? 0) + 1);
    const validMappings = mappings.filter((m: ColumnMappingItem) => m.targetField !== 'ignore');

    const createdRecordIds: string[] = [];
    const newSuggestions: MergeSuggestion[] = [];
    let autoCreatedEntitiesCount = 0;

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      if (!row || !Array.isArray(row) || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
        continue; // skip blank rows
      }

      // 1. Parse raw json and mapped fields
      const rawJson: Record<string, any> = {};
      const parsedFields: Partial<CanonicalSchema> = {
        eventName: defaultEventName,
        eventDate: defaultEventDate,
      };

      mappings.forEach((m: ColumnMappingItem, colIdx: number) => {
        const val = row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]).trim() : '';
        rawJson[m.sourceColumn || `Cột_${colIdx + 1}`] = val;

        if (m.targetField && m.targetField !== 'ignore' && val) {
          (parsedFields as any)[m.targetField] = val;
        }
      });

      // Require at least a name or email to be a valid attendee record
      if (!parsedFields.fullName && !parsedFields.email) {
        continue;
      }

      const recId = `raw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const normalizedIdentityKey = buildIdentityString({
        fullName: parsedFields.fullName,
        organization: parsedFields.organization,
        role: parsedFields.role,
        email: parsedFields.email,
      });

      // 2. Generate dense vector embedding for Stage 1 candidate retrieval
      const embedding = await generateIdentityEmbedding(normalizedIdentityKey);

      const rawRecord: RawSourceRecord = {
        id: recId,
        sourceFileId: sourceFileId || `file_${Date.now()}`,
        sourceFileName: sourceFileName || 'imported_file.xlsx',
        sourceType: sourceType || 'local_xlsx',
        rowIndex: (headerRowIndex ?? 0) + 1 + rIdx,
        rawJson,
        parsedFields,
        normalizedIdentityKey,
        embedding,
        importedAt: new Date().toISOString(),
        orgId: 'org_default',
      };

      // Store Layer 1 Raw Record (Immutable)
      db.addRawRecord(rawRecord);
      createdRecordIds.push(rawRecord.id);

      // --- Stage 1: Vector Similarity Candidate Retrieval ---
      const topCandidates = db.findTopCandidatesByVector(embedding, 3, 0.68);

      let foundMatch = false;

      // Filter out candidates previously rejected by user
      const eligibleCandidates = topCandidates.filter(
        (cand) => !db.isPairRejected(rawRecord.id, cand.entity.id)
      );

      if (eligibleCandidates.length > 0) {
        // --- Stage 2: LLM Adjudication for Top Candidate ---
        for (const candidate of eligibleCandidates) {
          const adjudication = await adjudicateEntityMatch(
            {
              fullName: parsedFields.fullName,
              organization: parsedFields.organization,
              role: parsedFields.role,
              email: parsedFields.email,
              phone: parsedFields.phone,
              sourceEvent: parsedFields.eventName,
            },
            {
              canonicalName: candidate.entity.canonicalName,
              canonicalOrg: candidate.entity.canonicalOrg,
              canonicalRole: candidate.entity.canonicalRole,
              canonicalEmail: candidate.entity.canonicalEmail,
              canonicalPhone: candidate.entity.canonicalPhone,
              aliases: candidate.entity.aliases,
              alternateEmails: candidate.entity.alternateEmails,
              alternateOrgs: candidate.entity.alternateOrgs,
            }
          );

          if (adjudication.isMatch && adjudication.confidence >= 0.7) {
            // Surface as pending merge suggestion for explicit user review
            const suggId = `sugg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const suggestion: MergeSuggestion = {
              id: suggId,
              rawRecord,
              targetCanonicalEntity: candidate.entity,
              vectorSimilarity: Math.round(candidate.similarity * 100) / 100,
              llmConfidence: Math.round(adjudication.confidence * 100) / 100,
              llmReasoning: adjudication.reasoningVi,
              keyDifferences: adjudication.keyDifferences,
              createdAt: new Date().toISOString(),
            };

            db.addPendingSuggestion(suggestion);
            newSuggestions.push(suggestion);
            foundMatch = true;
            break;
          }
        }
      }

      // If no valid candidate found, create a new authoritative Canonical Entity
      if (!foundMatch) {
        const newEntity = db.createCanonicalEntity({
          entityType: 'person',
          canonicalName: parsedFields.fullName || 'Khách không tên',
          canonicalOrg: parsedFields.organization,
          canonicalRole: parsedFields.role,
          canonicalEmail: parsedFields.email,
          canonicalPhone: parsedFields.phone,
        });

        // Link raw record to the new canonical entity
        const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        db.addEntityLink({
          id: linkId,
          rawRecordId: rawRecord.id,
          canonicalEntityId: newEntity.id,
          status: 'approved',
          stage1SimilarityScore: 1.0,
          stage2Confidence: 1.0,
          adjudicationReason: 'Khởi tạo thực thể chuẩn mới (không có ứng viên trùng khớp)',
          decidedBy: 'system_initial',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        autoCreatedEntitiesCount++;
      }
    }

    res.json({
      success: true,
      totalIngested: createdRecordIds.length,
      newEntitiesCreated: autoCreatedEntitiesCount,
      pendingMergeSuggestionsCount: newSuggestions.length,
      suggestions: newSuggestions,
    });
  } catch (err: any) {
    console.error('Ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. Pending Merge Suggestions
 */
apiRouter.get('/merges/pending', (req: Request, res: Response) => {
  try {
    const suggestions = db.getPendingSuggestions();
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. Adjudicate Merge Suggestion (Approve or Reject)
 */
apiRouter.post('/merges/adjudicate', (req: Request, res: Response) => {
  try {
    const { suggestionId, rawRecordId, canonicalEntityId, action, reason } = req.body;

    if (!suggestionId || !rawRecordId || !canonicalEntityId || !action) {
      return res.status(400).json({ error: 'Thiếu thông số phê duyệt' });
    }

    if (action === 'approve') {
      const result = db.approveMerge(suggestionId, rawRecordId, canonicalEntityId, 'user');
      return res.json({ success: true, action: 'approved', canonicalEntity: result.canonicalEntity });
    } else if (action === 'reject') {
      db.rejectMerge(suggestionId, rawRecordId, canonicalEntityId, reason || 'Người dùng từ chối gộp');
      return res.json({ success: true, action: 'rejected' });
    } else {
      return res.status(400).json({ error: 'Hành động không hợp lệ' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. Natural Language Search Translation
 */
apiRouter.post('/search/translate', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Thiếu câu truy vấn tìm kiếm' });
    }

    const translated = await translateNaturalLanguageQuery(query);
    res.json(translated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 9. Google Drive File Browser
 */
apiRouter.get('/drive/files', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const files = await listDriveSpreadsheets(token);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 10. Fetch Sheet Rows from Drive
 */
apiRouter.post('/drive/fetch', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!fileId) {
      return res.status(400).json({ error: 'Thiếu ID tệp Google Sheets' });
    }

    const sheetData = await fetchGoogleSheetRows(fileId, token);
    res.json(sheetData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 11. Parse Local XLSX File (Base64 or JSON buffer)
 */
apiRouter.post('/upload/parse', (req: Request, res: Response) => {
  try {
    const { base64Data, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Thiếu dữ liệu tệp base64' });
    }

    const buffer = Buffer.from(base64Data.split(',').pop() || base64Data, 'base64');
    const parsed = parseLocalSpreadsheetBuffer(buffer);
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 12. Seed / Reset Demo Data
 */
apiRouter.post('/seed', async (req: Request, res: Response) => {
  try {
    await seedInitialEventData();
    const stats = db.getStats();
    res.json({ success: true, message: 'Đã nạp dữ liệu mẫu thành công', stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
