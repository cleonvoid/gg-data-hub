import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  Calendar,
  Layers,
  HelpCircle,
  Tag,
  ArrowRight,
  FilterX,
  Bot,
} from 'lucide-react';
import { CanonicalEntity, NLSearchTranslationResponse, StructuredQueryFilter } from '../types/index';
import { translateSearch } from '../services/api';

interface DashboardViewProps {
  entities: CanonicalEntity[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeStructuredFilters: StructuredQueryFilter[];
  onApplyStructuredFilters: (filters: StructuredQueryFilter[]) => void;
  onClearFilters: () => void;
  onSelectEntity: (entityId: string) => void;
  isLoading: boolean;
}

const SAMPLE_NL_QUERIES = [
  'Chuyên gia AI tham gia từ 2 sự kiện',
  'Đại biểu thuộc Viện Hàn lâm KH&CN',
  'Cán bộ Sở Khoa học và Công nghệ',
  'Kỹ sư Cloud Viettel',
  'Giảng viên ĐH Bách Khoa',
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  entities,
  total,
  page,
  limit,
  onPageChange,
  searchQuery,
  onSearchChange,
  activeStructuredFilters,
  onApplyStructuredFilters,
  onClearFilters,
  onSelectEntity,
  isLoading,
}) => {
  const [nlInput, setNlInput] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiInterpretation, setAiInterpretation] = useState<NLSearchTranslationResponse | null>(null);

  const handleNlSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nlInput.trim()) return;

    setIsTranslating(true);
    try {
      const res = await translateSearch(nlInput.trim());
      setAiInterpretation(res);
      onApplyStructuredFilters(res.filters);
      onSearchChange('');
    } catch (err) {
      console.error('NL Search translation failed, using keyword search:', err);
      onSearchChange(nlInput);
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePresetClick = async (query: string) => {
    setNlInput(query);
    setIsTranslating(true);
    try {
      const res = await translateSearch(query);
      setAiInterpretation(res);
      onApplyStructuredFilters(res.filters);
      onSearchChange('');
    } catch (err) {
      onSearchChange(query);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleResetSearch = () => {
    setNlInput('');
    setAiInterpretation(null);
    onClearFilters();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-5">
      {/* Smart Search Bar with Natural Language Translation */}
      <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3.5">
        <form onSubmit={handleNlSearch} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={nlInput}
              onChange={(e) => {
                setNlInput(e.target.value);
                if (!e.target.value) {
                  onSearchChange('');
                }
              }}
              placeholder="Tìm kiếm bằng tiếng Việt tự nhiên (ví dụ: 'chuyên gia AI tham gia từ 2 sự kiện', 'thuộc Sở KH&CN')..."
              className="w-full pl-10 pr-28 py-2.5 text-xs sm:text-sm bg-[#F3F4F6] border-none rounded-full text-[#111827] font-medium focus:ring-2 focus:ring-[#2563EB] outline-none transition-all placeholder:text-[#9CA3AF]"
            />
            <div className="absolute inset-y-0 right-1.5 flex items-center">
              <button
                type="submit"
                disabled={isTranslating || !nlInput.trim()}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-full text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors uppercase tracking-wider"
              >
                <Sparkles className={`w-3.5 h-3.5 mr-1 ${isTranslating ? 'animate-spin' : ''}`} />
                {isTranslating ? 'Đang dịch...' : 'Tìm AI'}
              </button>
            </div>
          </div>

          {(activeStructuredFilters.length > 0 || searchQuery || nlInput) && (
            <button
              type="button"
              onClick={handleResetSearch}
              title="Xoá bộ lọc"
              className="px-3.5 py-2 text-xs font-bold text-[#4B5563] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-full flex items-center transition-colors uppercase tracking-wider"
            >
              <FilterX className="w-4 h-4 mr-1" />
              Xóa lọc
            </button>
          )}
        </form>

        {/* Preset Natural Language Prompts */}
        <div className="flex items-center space-x-2 text-xs overflow-x-auto pb-1">
          <span className="text-[#9CA3AF] shrink-0 flex items-center font-bold text-[10px] uppercase tracking-wider">
            <Bot className="w-3.5 h-3.5 mr-1 text-[#2563EB]" />
            Gợi ý:
          </span>
          {SAMPLE_NL_QUERIES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className="px-3 py-1 rounded-full bg-[#F3F4F6] text-[#4B5563] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:border-[#BFDBFE] border border-[#E5E7EB] whitespace-nowrap transition-colors text-[11px] font-bold"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* AI Translation Feedback Banner */}
        {aiInterpretation && (
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 flex items-start justify-between text-xs">
            <div className="flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-[#1E40AF] uppercase tracking-wider text-[11px]">Gemini đã biên dịch: </span>
                <span className="text-[#1E3A8A] font-medium">{aiInterpretation.explanationVi}</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {aiInterpretation.filters.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-[#2563EB] border border-[#BFDBFE] font-mono text-[10px] font-bold uppercase"
                    >
                      {f.field} {f.operator} "{String(f.value)}"
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setAiInterpretation(null)}
              className="text-[#93C5FD] hover:text-[#1E40AF] font-bold text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Canonical Entity Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden flex flex-col">
        <div className="px-6 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
          <div className="flex items-center space-x-3">
            <h2 className="text-sm font-black text-[#111827] uppercase tracking-tight">
              DANH SÁCH THỰC THỂ ({total})
            </h2>
            <span className="text-[11px] text-[#6B7280] font-bold uppercase tracking-wider hidden md:inline">
              • Hợp nhất đa sự kiện
            </span>
          </div>
          <span className="text-xs text-[#6B7280] font-bold uppercase tracking-wider">
            Trang {page} / {totalPages}
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#6B7280] font-bold uppercase tracking-wider">Đang đồng bộ và truy vấn dữ liệu...</p>
          </div>
        ) : entities.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Layers className="w-10 h-10 text-[#D1D5DB] mx-auto" />
            <p className="text-sm font-bold text-[#374151]">Không tìm thấy thực thể nào phù hợp</p>
            <p className="text-xs text-[#9CA3AF]">Hãy thử từ khoá khác hoặc nhấn "Dữ liệu mẫu" để nạp lại</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6">Tên / Thực thể</th>
                  <th className="py-3.5 px-6">Tổ chức / Chức vụ</th>
                  <th className="py-3.5 px-6">Liên hệ (Email / SĐT)</th>
                  <th className="py-3.5 px-6">Biến thể (Aliases)</th>
                  <th className="py-3.5 px-6 text-center">Số sự kiện</th>
                  <th className="py-3.5 px-6 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] text-xs font-medium">
                {entities.map((entity) => {
                  const initial = entity.canonicalName.charAt(0) || 'U';
                  return (
                    <tr
                      key={entity.id}
                      onClick={() => onSelectEntity(entity.id)}
                      className="hover:bg-[#EFF6FF] cursor-pointer transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] font-black flex items-center justify-center text-xs shrink-0 border border-[#BFDBFE]">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-[#111827] group-hover:text-[#2563EB] transition-colors text-xs">
                              {entity.canonicalName}
                            </div>
                            <div className="text-[10px] text-[#6B7280] uppercase font-mono tracking-wide">
                              ID: {entity.id.substring(0, 12)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Organization & Role */}
                      <td className="py-4 px-6 max-w-[240px]">
                        <div className="space-y-0.5">
                          <div className="font-bold text-[#111827] truncate" title={entity.canonicalOrg}>
                            {entity.canonicalOrg || 'Chưa cập nhật đơn vị'}
                          </div>
                          <div className="text-[11px] text-[#6B7280] font-medium truncate" title={entity.canonicalRole}>
                            {entity.canonicalRole || 'Đại biểu'}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-4 px-6 max-w-[200px]">
                        <div className="space-y-1">
                          {entity.canonicalEmail && (
                            <div className="flex items-center space-x-1.5 text-[#374151] truncate font-mono text-[11px]">
                              <Mail className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                              <span className="truncate">{entity.canonicalEmail}</span>
                            </div>
                          )}
                          {entity.canonicalPhone && (
                            <div className="flex items-center space-x-1.5 text-[#374151] truncate font-mono text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                              <span>{entity.canonicalPhone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Aliases */}
                      <td className="py-4 px-6 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {entity.aliases.slice(0, 3).map((alias, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-white text-[#4B5563] text-[10px] border border-[#E5E7EB] font-bold truncate max-w-[160px]"
                              title={alias}
                            >
                              {alias}
                            </span>
                          ))}
                          {entity.aliases.length > 3 && (
                            <span className="text-[10px] text-[#9CA3AF] font-bold self-center">
                              +{entity.aliases.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Appearances count */}
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black font-mono ${
                            entity.eventAppearancesCount >= 3
                              ? 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]'
                              : entity.eventAppearancesCount === 2
                              ? 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]'
                              : 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]'
                          }`}
                        >
                          {entity.eventAppearancesCount}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEntity(entity.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-white text-[#9CA3AF] hover:text-[#2563EB] transition-colors inline-flex items-center border border-transparent hover:border-[#E5E7EB]"
                        >
                          <span className="sr-only">Xem chi tiết</span>
                          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-3.5 border-t border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
            <p className="text-xs text-[#6B7280] font-bold uppercase tracking-wider">
              Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total} THỰC THỂ
            </p>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40 uppercase tracking-wider"
              >
                Trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40 uppercase tracking-wider"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
