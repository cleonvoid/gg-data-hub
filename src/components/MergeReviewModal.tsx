import React, { useState } from 'react';
import {
  X,
  GitMerge,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MergeSuggestion } from '../types/index';
import { adjudicateMerge } from '../services/api';

interface MergeReviewModalProps {
  suggestions: MergeSuggestion[];
  isOpen: boolean;
  onClose: () => void;
  onAdjudicated: () => void;
}

export const MergeReviewModal: React.FC<MergeReviewModalProps> = ({
  suggestions,
  isOpen,
  onClose,
  onAdjudicated,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen || suggestions.length === 0) return null;

  const current = suggestions[Math.min(currentIndex, suggestions.length - 1)];
  if (!current) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    setActionSuccess(null);
    try {
      await adjudicateMerge({
        suggestionId: current.id,
        rawRecordId: current.rawRecord.id,
        canonicalEntityId: current.targetCanonicalEntity.id,
        action: 'approve',
      });
      setActionSuccess('Đã phê duyệt gộp thực thể thành công!');
      setTimeout(() => {
        setActionSuccess(null);
        onAdjudicated();
      }, 500);
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setActionSuccess(null);
    try {
      await adjudicateMerge({
        suggestionId: current.id,
        rawRecordId: current.rawRecord.id,
        canonicalEntityId: current.targetCanonicalEntity.id,
        action: 'reject',
        reason: 'Người dùng từ chối gộp và chọn tạo thực thể riêng biệt',
      });
      setActionSuccess('Đã tách bản ghi thành thực thể riêng biệt!');
      setTimeout(() => {
        setActionSuccess(null);
        onAdjudicated();
      }, 500);
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black text-[#111827] uppercase tracking-tight">
                  DUYỆT GỘP THỰC THỂ (STAGE 2 ADJUDICATION)
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] font-mono">
                  {currentIndex + 1} / {suggestions.length}
                </span>
              </div>
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                Giai đoạn 1: Vector Similarity (768d) → Giai đoạn 2: Gemini 3.7 LLM Reasoning
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

        {/* Action feedback toast */}
        {actionSuccess && (
          <div className="bg-[#059669] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white">
          {/* AI Metrics & Reasoning Banner */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#BFDBFE]/60">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#2563EB]" />
                <span className="text-[10px] font-black text-[#1E40AF] uppercase tracking-widest">
                  KẾT LUẬN PHÂN TÍCH TỪ GEMINI AI
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs px-2.5 py-1 rounded-md bg-white text-[#1E40AF] font-bold border border-[#BFDBFE]">
                  Vector Similarity: <strong className="text-[#2563EB] font-black font-mono">{Math.round(current.vectorSimilarity * 100)}%</strong>
                </span>
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#D1FAE5] text-[#065F46] font-bold border border-[#A7F3D0]">
                  LLM Confidence: <strong className="text-[#047857] font-black font-mono">{Math.round(current.llmConfidence * 100)}%</strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-[#1E3A8A] leading-relaxed font-semibold">
              "{current.llmReasoning}"
            </p>

            {current.keyDifferences.length > 0 && (
              <div className="pt-2.5 border-t border-[#BFDBFE]/60">
                <span className="text-[10px] font-black text-[#1E40AF] uppercase tracking-wider block mb-1.5">
                  Điểm khác biệt nhận diện:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {current.keyDifferences.map((diff, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-[#BFDBFE] text-[11px]">
                      <span className="font-bold text-[#4B5563] uppercase text-[10px]">{diff.field}:</span>{' '}
                      <span className="text-[#DC2626] font-bold font-mono">{diff.rawValue}</span>{' '}
                      <ArrowRight className="w-3 h-3 inline text-[#9CA3AF] mx-1" />{' '}
                      <span className="text-[#059669] font-bold font-mono">{diff.canonicalValue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Side-by-Side Comparison Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Column 1: Existing Canonical Entity */}
            <div className="border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-wider flex items-center">
                  <ShieldCheck className="w-4 h-4 text-[#2563EB] mr-1.5" />
                  THỰC THỂ CHUẨN HIỆN CÓ (CANONICAL)
                </span>
                <span className="text-[10px] font-black bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] px-2 py-0.5 rounded-md uppercase">
                  {current.targetCanonicalEntity.eventAppearancesCount} sự kiện
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Họ và tên chuẩn:</span>
                  <p className="text-sm font-black text-[#111827]">
                    {current.targetCanonicalEntity.canonicalName}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Cơ quan / Đơn vị:</span>
                  <p className="font-bold text-[#374151]">
                    {current.targetCanonicalEntity.canonicalOrg || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Chức vụ / Danh xưng:</span>
                  <p className="font-bold text-[#374151]">
                    {current.targetCanonicalEntity.canonicalRole || '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Email chính:</span>
                    <p className="font-mono font-bold text-[#374151] truncate text-[11px]" title={current.targetCanonicalEntity.canonicalEmail}>
                      {current.targetCanonicalEntity.canonicalEmail || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Điện thoại:</span>
                    <p className="font-mono font-bold text-[#374151] text-[11px]">
                      {current.targetCanonicalEntity.canonicalPhone || '—'}
                    </p>
                  </div>
                </div>

                {current.targetCanonicalEntity.aliases.length > 0 && (
                  <div className="pt-2.5 border-t border-[#E5E7EB]">
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block mb-1">Các biến thể đã lưu:</span>
                    <div className="flex flex-wrap gap-1">
                      {current.targetCanonicalEntity.aliases.map((a, i) => (
                        <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-[#E5E7EB] text-[#374151] font-bold">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Incoming Raw Record */}
            <div className="border border-[#FED7AA] rounded-xl bg-[#FFF7ED]/40 p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#FED7AA]">
                <span className="text-[10px] font-black text-[#C2410C] uppercase tracking-wider flex items-center">
                  <AlertCircle className="w-4 h-4 text-[#C2410C] mr-1.5" />
                  BẢN GHI MỚI NHẬP (CANDIDATE RAW)
                </span>
                <span className="text-[10px] font-bold bg-[#FFEDD5] text-[#C2410C] px-2 py-0.5 rounded-md truncate max-w-[160px]" title={current.rawRecord.sourceFileName}>
                  {current.rawRecord.sourceFileName}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Họ và tên trong tệp:</span>
                  <p className="text-sm font-black text-[#111827]">
                    {current.rawRecord.parsedFields.fullName || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Đơn vị công tác ghi nhận:</span>
                  <p className="font-bold text-[#374151]">
                    {current.rawRecord.parsedFields.organization || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Chức vụ trong sự kiện:</span>
                  <p className="font-bold text-[#374151]">
                    {current.rawRecord.parsedFields.role || '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Email:</span>
                    <p className="font-mono font-bold text-[#374151] truncate text-[11px]" title={current.rawRecord.parsedFields.email}>
                      {current.rawRecord.parsedFields.email || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Điện thoại:</span>
                    <p className="font-mono font-bold text-[#374151] text-[11px]">
                      {current.rawRecord.parsedFields.phone || '—'}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#FED7AA]">
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide block">Sự kiện nguồn:</span>
                  <p className="text-xs font-black text-[#C2410C]">
                    {current.rawRecord.parsedFields.eventName || 'Sự kiện chưa đặt tên'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Decisions Bar */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="p-2 rounded-lg border border-[#D1D5DB] bg-white text-[#4B5563] disabled:opacity-40 hover:bg-[#F3F4F6] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              disabled={currentIndex >= suggestions.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(suggestions.length - 1, prev + 1))}
              className="p-2 rounded-lg border border-[#D1D5DB] bg-white text-[#4B5563] disabled:opacity-40 hover:bg-[#F3F4F6] transition-colors"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {/* Reject Action */}
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg border border-[#D1D5DB] text-[#DC2626] bg-white hover:bg-[#FEF2F2] hover:border-[#FCA5A5] transition-colors disabled:opacity-50 uppercase tracking-wider"
            >
              <XCircle className="w-4 h-4 mr-1.5 text-[#DC2626]" />
              Từ chối & Tách riêng
            </button>

            {/* Approve Action */}
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="inline-flex items-center px-5 py-2 text-xs font-bold rounded-lg text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-xs transition-colors disabled:opacity-50 uppercase tracking-wider"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Phê duyệt Gộp thực thể
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
