import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  HardDrive,
  FolderOpen,
  Calendar,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  ColumnMappingItem,
  SchemaMappingProposal,
  MergeSuggestion,
} from '../types/index';
import {
  inferSchema,
  ingestSpreadsheet,
  parseUploadedXlsx,
  fetchDriveSheet,
  listDriveFiles,
} from '../services/api';
import { AuthState } from '../services/auth';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  authState: AuthState;
  onImportComplete: (summary: {
    totalIngested: number;
    newEntitiesCreated: number;
    pendingMergeSuggestionsCount: number;
    suggestions: MergeSuggestion[];
  }) => void;
}

const CANONICAL_TARGET_FIELDS: { label: string; value: string; desc: string }[] = [
  { label: 'Họ và tên (fullName)', value: 'fullName', desc: 'Tên đại biểu, diễn giả, chuyên gia' },
  { label: 'Cơ quan / Đơn vị (organization)', value: 'organization', desc: 'Viện, trường, doanh nghiệp, sở ban ngành' },
  { label: 'Chức danh / Vị trí (role)', value: 'role', desc: 'Trưởng phòng, Giám đốc, Giảng viên...' },
  { label: 'Email liên hệ (email)', value: 'email', desc: 'Địa chỉ hòm thư điện tử' },
  { label: 'Số điện thoại (phone)', value: 'phone', desc: 'Số điện thoại di động/bàn' },
  { label: 'Tên sự kiện (eventName)', value: 'eventName', desc: 'Tên hoạt động/hội thảo' },
  { label: 'Bỏ qua cột này (ignore)', value: 'ignore', desc: 'Không nhập vào hệ thống' },
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  authState,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'source' | 'mapping' | 'ingesting' | 'done'>('source');
  const [sourceType, setSourceType] = useState<'drive_sheets' | 'local_xlsx'>('drive_sheets');
  const [fileName, setFileName] = useState('');
  const [fileId, setFileId] = useState('');
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mappings, setMappings] = useState<ColumnMappingItem[]>([]);
  const [aiProposal, setAiProposal] = useState<SchemaMappingProposal | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isListingDrive, setIsListingDrive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Load Google Drive spreadsheets
  const handleLoadDriveFiles = async () => {
    setIsListingDrive(true);
    setErrorMsg(null);
    try {
      const files = await listDriveFiles(authState.accessToken || undefined);
      setDriveFiles(files);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải tệp từ Google Drive');
    } finally {
      setIsListingDrive(false);
    }
  };

  // Select a Google Drive spreadsheet
  const handleSelectDriveFile = async (f: any) => {
    setFileName(f.name);
    setFileId(f.id);
    setSourceType('drive_sheets');
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const sheetData = await fetchDriveSheet(f.id, authState.accessToken || undefined);
      setRawRows(sheetData.rows || []);
      setEventName(f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));

      // Call AI Schema Inference
      const proposal = await inferSchema(sheetData.rows, f.name);
      setAiProposal(proposal);
      setHeaderRowIndex(proposal.headerRowIndex);
      setMappings(proposal.mappings);
      if (proposal.suggestedEventName) setEventName(proposal.suggestedEventName);
      if (proposal.suggestedEventDate) setEventDate(proposal.suggestedEventDate);

      setStep('mapping');
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể xử lý tệp Google Sheets');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload local XLSX file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileId(`local_${Date.now()}`);
    setSourceType('local_xlsx');
    setEventName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    setIsLoading(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const base64 = evt.target?.result as string;
        const parsed = await parseUploadedXlsx(base64, file.name);
        setRawRows(parsed.rows || []);

        const proposal = await inferSchema(parsed.rows, file.name);
        setAiProposal(proposal);
        setHeaderRowIndex(proposal.headerRowIndex);
        setMappings(proposal.mappings);
        if (proposal.suggestedEventName) setEventName(proposal.suggestedEventName);
        if (proposal.suggestedEventDate) setEventDate(proposal.suggestedEventDate);

        setStep('mapping');
      } catch (err: any) {
        setErrorMsg(err.message || 'Lỗi khi đọc tệp Excel');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle manual column mapping change
  const handleMappingChange = (colIdx: number, newTarget: string) => {
    setMappings((prev) =>
      prev.map((m, idx) =>
        idx === colIdx ? { ...m, targetField: newTarget, confidence: 1.0 } : m
      )
    );
  };

  // Execute ingestion & two-stage resolution
  const handleExecuteIngest = async () => {
    setIsLoading(true);
    setStep('ingesting');
    setErrorMsg(null);
    try {
      const res = await ingestSpreadsheet({
        sourceFileId: fileId,
        sourceFileName: fileName,
        sourceType,
        headerRowIndex,
        mappings,
        rows: rawRows,
        defaultEventName: eventName,
        defaultEventDate: eventDate,
      });

      onImportComplete(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi nạp dữ liệu');
      setStep('mapping');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#111827] uppercase tracking-tight">
                NẠP & CHUẨN HOÁ DỮ LIỆU SỰ KIỆN
              </h2>
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                Tự động suy luận cấu trúc bảng tính với Gemini AI & phân giải thực thể
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {errorMsg && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] rounded-xl text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: SELECT SOURCE */}
          {step === 'source' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: Google Drive Sheets */}
                <div className="border-2 border-[#E5E7EB] hover:border-[#2563EB] rounded-2xl p-6 bg-white transition-all space-y-4 cursor-pointer group shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#111827] uppercase tracking-tight group-hover:text-[#2563EB] transition-colors">
                      Google Drive & Sheets
                    </h3>
                    <p className="text-xs text-[#6B7280] font-medium mt-1">
                      Chọn bảng tính trực tiếp từ kho Google Drive của đơn vị
                    </p>
                  </div>
                  <button
                    onClick={handleLoadDriveFiles}
                    disabled={isListingDrive || isLoading}
                    className="w-full py-2.5 px-4 text-xs font-bold rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] transition-colors flex items-center justify-center space-x-1.5 uppercase tracking-wider"
                  >
                    <HardDrive className="w-4 h-4 mr-1" />
                    {isListingDrive ? 'Đang đọc Drive...' : 'Duyệt bảng tính Drive'}
                  </button>
                </div>

                {/* Option 2: Upload local XLSX file */}
                <label className="border-2 border-dashed border-[#D1D5DB] hover:border-[#2563EB] rounded-2xl p-6 bg-[#F9FAFB] hover:bg-[#EFF6FF]/40 transition-all space-y-4 cursor-pointer flex flex-col justify-between group shadow-2xs">
                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-xl bg-[#D1FAE5] text-[#059669] flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#111827] uppercase tracking-tight group-hover:text-[#2563EB] transition-colors">
                        Tải tệp Excel từ máy tính (.xlsx, .csv)
                      </h3>
                      <p className="text-xs text-[#6B7280] font-medium mt-1">
                        Kéo thả hoặc nhấp để chọn tệp bảng tính danh sách đại biểu
                      </p>
                    </div>
                  </div>
                  <div className="py-2.5 px-4 text-xs font-bold rounded-lg bg-[#D1FAE5] text-[#065F46] text-center uppercase tracking-wider">
                    Chọn tệp từ máy
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Google Drive Files List */}
              {driveFiles.length > 0 && (
                <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between text-xs">
                    <span className="font-black text-[#111827] uppercase tracking-wider text-[11px]">
                      Bảng tính tìm thấy trên Google Drive ({driveFiles.length})
                    </span>
                    <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Nhấp vào tệp để nạp</span>
                  </div>
                  <div className="divide-y divide-[#F3F4F6] max-h-60 overflow-y-auto">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleSelectDriveFile(file)}
                        className="px-5 py-3.5 hover:bg-[#EFF6FF] cursor-pointer flex items-center justify-between transition-colors text-xs"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <FileSpreadsheet className="w-4 h-4 text-[#059669] shrink-0" />
                          <span className="font-bold text-[#111827] truncate">{file.name}</span>
                        </div>
                        <span className="text-[11px] text-[#2563EB] font-bold shrink-0 ml-2 uppercase tracking-wide">
                          Chọn nạp →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: AI SCHEMA INFERENCE & COLUMN MAPPING REVIEW */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {/* AI Inference Banner */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-[10px] font-black text-[#1E40AF] uppercase tracking-widest">
                    GEMINI AI ĐÃ SUY LUẬN ÁNH XẠ CỘT
                  </h3>
                </div>
                <p className="text-xs text-[#1E3A8A] leading-relaxed font-semibold">
                  {aiProposal?.confidenceExplanation ||
                    'Cấu trúc bảng tính đã được nhận diện tự động. Vui lòng kiểm tra lại ánh xạ cột bên dưới trước khi đồng bộ.'}
                </p>
                <div className="flex items-center space-x-4 text-[10px] text-[#1E40AF] font-bold uppercase tracking-wider pt-1 border-t border-[#BFDBFE]/60">
                  <span>Dòng tiêu đề nhận diện: <strong className="font-mono text-[#2563EB]">Dòng {headerRowIndex + 1}</strong></span>
                  <span>•</span>
                  <span>Tổng số dòng dữ liệu: <strong className="font-mono text-[#2563EB]">{Math.max(0, rawRows.length - headerRowIndex - 1)} dòng</strong></span>
                </div>
              </div>

              {/* Event Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F9FAFB] p-4.5 rounded-xl border border-[#E5E7EB] text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">Tên Sự kiện / Hoạt động:</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Ví dụ: Hội thảo Chuyển đổi số TP.HCM..."
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg font-bold text-[#111827] focus:ring-2 focus:ring-[#2563EB] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">Ngày tổ chức sự kiện:</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg font-bold text-[#111827] font-mono focus:ring-2 focus:ring-[#2563EB] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Column Mapping Table */}
              <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-black text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Cột gốc trong tệp</th>
                      <th className="py-3 px-4">Mẫu dữ liệu thực tế</th>
                      <th className="py-3 px-4">Độ tin cậy AI</th>
                      <th className="py-3 px-4">Ánh xạ vào Trường chuẩn hoá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {mappings.map((mapping, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-[#EFF6FF] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#111827]">
                            {mapping.sourceColumn || `Cột ${idx + 1}`}
                          </td>
                          <td className="py-3 px-4 text-[#6B7280] font-mono text-[11px] max-w-[200px] truncate" title={mapping.sampleValues.join(', ')}>
                            {mapping.sampleValues.slice(0, 2).join(' | ') || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono ${
                                mapping.confidence >= 0.9
                                  ? 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]'
                                  : mapping.confidence >= 0.7
                                  ? 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]'
                                  : 'bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
                              }`}
                            >
                              {Math.round(mapping.confidence * 100)}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={mapping.targetField}
                              onChange={(e) => handleMappingChange(idx, e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-lg font-bold text-[#111827] focus:ring-2 focus:ring-[#2563EB] focus:outline-hidden"
                            >
                              {CANONICAL_TARGET_FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: INGESTING SPINNER */}
          {step === 'ingesting' && (
            <div className="py-16 text-center space-y-4">
              <div className="w-10 h-10 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-black text-[#111827] uppercase tracking-tight">
                  ĐANG PHÂN GIẢI THỰC THỂ HAI GIAI ĐOẠN...
                </h3>
                <p className="text-xs text-[#6B7280] font-semibold mt-1 max-w-md mx-auto">
                  Tạo vector embeddings → Truy vấn tương đồng cosine → Gemini LLM đối chiếu ngôn ngữ tiếng Việt & pháp nhân
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between">
          {step === 'mapping' ? (
            <button
              onClick={() => setStep('source')}
              className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6] uppercase tracking-wider"
            >
              ← Chọn lại tệp
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-[#D1D5DB] text-[#374151] bg-white hover:bg-[#F3F4F6] uppercase tracking-wider"
            >
              Hủy
            </button>

            {step === 'mapping' && (
              <button
                onClick={handleExecuteIngest}
                disabled={isLoading}
                className="inline-flex items-center px-5 py-2 text-xs font-bold rounded-lg text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-xs disabled:opacity-50 uppercase tracking-wider"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Tiến hành Chuẩn hoá & Nạp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
