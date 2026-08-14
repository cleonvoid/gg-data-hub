import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  Tag,
  GitCommit,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CanonicalEntity, RawSourceRecord, EntityLink } from '../types/index';
import { fetchEntityDetails } from '../services/api';

interface EntityDetailDrawerProps {
  entityId: string | null;
  onClose: () => void;
}

export const EntityDetailDrawer: React.FC<EntityDetailDrawerProps> = ({
  entityId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    canonicalEntity: CanonicalEntity;
    rawRecords: {
      rawRecord: RawSourceRecord;
      link: EntityLink;
      fieldDifferences: Record<string, string>;
    }[];
  } | null>(null);

  useEffect(() => {
    if (!entityId) {
      setData(null);
      return;
    }

    setLoading(true);
    fetchEntityDetails(entityId)
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load entity details:', err))
      .finally(() => setLoading(false));
  }, [entityId]);

  if (!entityId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-[#E5E7EB]">
          {/* Header */}
          <div className="px-6 py-4 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white font-black flex items-center justify-center text-sm shadow-xs">
                {data?.canonicalEntity.canonicalName.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-base font-black text-[#111827] leading-tight uppercase tracking-tight">
                  {data?.canonicalEntity.canonicalName || 'CHI TIẾT THỰC THỂ'}
                </h2>
                <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Hồ sơ chuẩn hoá & Phả hệ dữ liệu nguồn (Data Lineage)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#111827] transition-colors"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-[#6B7280] font-bold uppercase tracking-wider">Đang truy xuất phả hệ dữ liệu...</p>
              </div>
            </div>
          ) : data ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              {/* Canonical Entity Authoritative Profile Card */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
                  <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-wider flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-[#059669] mr-1.5" />
                    THÔNG TIN ĐỊNH DANH CHUẨN (CANONICAL PROFILE)
                  </span>
                  <span className="text-[10px] px-2.5 py-1 bg-[#D1FAE5] text-[#065F46] rounded-md font-black border border-[#A7F3D0] uppercase">
                    Đã gộp {data.rawRecords.length} nguồn
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <span className="text-[#6B7280] block text-[10px] font-bold uppercase tracking-wide">Đơn vị công tác chính:</span>
                    <span className="font-bold text-[#111827]">
                      {data.canonicalEntity.canonicalOrg || 'Chưa xác định'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block text-[10px] font-bold uppercase tracking-wide">Chức danh / Vai trò:</span>
                    <span className="font-bold text-[#111827]">
                      {data.canonicalEntity.canonicalRole || 'Đại biểu'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block text-[10px] font-bold uppercase tracking-wide">Email chuẩn:</span>
                    <span className="font-mono font-bold text-[#2563EB]">
                      {data.canonicalEntity.canonicalEmail || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block text-[10px] font-bold uppercase tracking-wide">Số điện thoại:</span>
                    <span className="font-mono font-bold text-[#111827]">
                      {data.canonicalEntity.canonicalPhone || '—'}
                    </span>
                  </div>
                </div>

                {/* Aliases & Alternate records */}
                <div className="pt-3 border-t border-[#E5E7EB] space-y-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block mb-1">
                      Các biến thể tên nhận diện:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.canonicalEntity.aliases.map((alias, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-white text-[#374151] border border-[#E5E7EB] text-xs font-bold"
                        >
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>

                  {data.canonicalEntity.alternateEmails.length > 1 && (
                    <div>
                      <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block mb-1">
                        Email khác phát hiện qua sự kiện:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {data.canonicalEntity.alternateEmails.map((email, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-white text-[#4B5563] border border-[#E5E7EB] text-xs font-mono font-bold"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Merged Source Records Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#111827] uppercase tracking-wider flex items-center">
                    <Layers className="w-4 h-4 text-[#2563EB] mr-2" />
                    LỊCH SỬ THAM GIA SỰ KIỆN ({data.rawRecords.length})
                  </h3>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Dữ liệu nguồn bất biến</span>
                </div>

                <div className="space-y-3.5">
                  {data.rawRecords.map((item, idx) => (
                    <div
                      key={item.rawRecord.id}
                      className="border border-[#E5E7EB] rounded-xl p-4 bg-white hover:border-[#BFDBFE] transition-colors shadow-2xs space-y-3"
                    >
                      {/* Event Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-[#EFF6FF] text-[#2563EB] text-xs font-black flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <h4 className="text-xs font-bold text-[#111827]">
                              {item.rawRecord.parsedFields.eventName || 'Sự kiện không tên'}
                            </h4>
                          </div>
                          <p className="text-[10px] text-[#6B7280] pl-7 flex items-center space-x-2 font-bold uppercase tracking-wider">
                            <span>Tệp nguồn: <strong className="text-[#111827]">{item.rawRecord.sourceFileName}</strong></span>
                            <span>•</span>
                            <span>Dòng: {item.rawRecord.rowIndex}</span>
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-[#F3F4F6] text-[#374151] rounded-md font-mono font-bold">
                          {item.rawRecord.parsedFields.eventDate || item.rawRecord.importedAt.split('T')[0]}
                        </span>
                      </div>

                      {/* Field Differences highlight */}
                      {Object.keys(item.fieldDifferences).length > 0 && (
                        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-2.5 text-xs space-y-1">
                          <p className="text-[10px] font-black text-[#C2410C] uppercase tracking-wider flex items-center">
                            <Sparkles className="w-3 h-3 mr-1 text-[#C2410C]" />
                            Khác biệt so với hồ sơ chuẩn:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                            {Object.entries(item.fieldDifferences).map(([field, val]) => (
                              <div key={field} className="text-[#9A3412]">
                                <span className="font-bold uppercase text-[10px]">{field}:</span>{' '}
                                <span className="bg-white px-1.5 py-0.5 rounded border border-[#FED7AA] font-mono font-bold">
                                  {val}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Raw Record Parsed Columns */}
                      <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB] text-xs">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#6B7280] mb-2">
                          Dữ liệu trích xuất từ bảng tính nguồn:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-[#6B7280] font-medium">Họ tên:</span>{' '}
                            <span className="font-bold text-[#111827]">
                              {item.rawRecord.parsedFields.fullName || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#6B7280] font-medium">Đơn vị:</span>{' '}
                            <span className="font-bold text-[#111827]">
                              {item.rawRecord.parsedFields.organization || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#6B7280] font-medium">Chức vụ:</span>{' '}
                            <span className="font-bold text-[#111827]">
                              {item.rawRecord.parsedFields.role || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#6B7280] font-medium">Email:</span>{' '}
                            <span className="font-bold text-[#111827] font-mono">
                              {item.rawRecord.parsedFields.email || '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Adjudication Verdict info */}
                      <div className="flex items-center justify-between text-[10px] text-[#6B7280] font-semibold pt-1 border-t border-[#F3F4F6]">
                        <span>Lý do phân giải: {item.link.adjudicationReason}</span>
                        <span className="font-mono font-bold text-[#2563EB]">Độ tin cậy: {Math.round(item.link.stage2Confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 text-center text-[#9CA3AF] text-xs">
              Không thể tải thông tin thực thể
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3.5 bg-[#F9FAFB] border-t border-[#E5E7EB] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-[#D1D5DB] text-[#374151] bg-white hover:bg-[#F3F4F6] transition-colors uppercase tracking-wider"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
