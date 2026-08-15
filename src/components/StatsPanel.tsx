import React from 'react';
import { Users, FileSpreadsheet, Layers, TrendingUp, AlertTriangle } from 'lucide-react';
import { IngestionStats } from '../types/index';

interface StatsPanelProps {
  stats: IngestionStats | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="space-y-4 mb-6">
      {stats.vectorSearchDegraded && (
        <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center space-x-3 text-[#92400E]">
          <AlertTriangle className="w-5 h-5 shrink-0 text-[#D97706]" />
          <div className="text-xs">
            <span className="font-bold">Cảnh báo chỉ mục Vector:</span> Chỉ mục KNN trên Firestore chưa được tạo hoặc đang khởi tạo. Hệ thống đang tự động quét bộ nhớ đệm tạm thời (hiệu năng chậm hơn). Vui lòng tạo composite vector index theo hướng dẫn README.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Raw Ingested Records */}
        <div className="p-4 border border-[#E5E7EB] rounded-xl bg-white shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">
              Tổng bản ghi gốc
            </p>
            <p className="text-2xl font-black text-[#111827] font-mono">
              {stats.totalRawRecords.toLocaleString('vi-VN')}
            </p>
            <p className="text-[10px] font-semibold text-[#9CA3AF] mt-0.5 uppercase tracking-wide">
              Dòng dữ liệu sự kiện
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Total Canonical Entities */}
        <div className="p-4 border border-[#E5E7EB] rounded-xl bg-white shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">
              Thực thể hợp nhất
            </p>
            <p className="text-2xl font-black text-[#111827] font-mono">
              {stats.totalCanonicalEntities.toLocaleString('vi-VN')}
            </p>
            <p className="text-[10px] font-semibold text-[#9CA3AF] mt-0.5 uppercase tracking-wide">
              Hồ sơ cá nhân chuẩn hoá
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] text-[#059669] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Deduplication Efficiency Rate */}
        <div className="p-4 border border-[#E5E7EB] rounded-xl bg-white shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">
              Tỷ lệ trùng lặp
            </p>
            <div className="flex items-baseline space-x-1">
              <p className="text-2xl font-black text-[#2563EB] font-mono">
                +{stats.dedupRatio}%
              </p>
              <span className="text-[10px] font-bold text-[#2563EB] uppercase">thu gọn</span>
            </div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] mt-0.5 uppercase tracking-wide">
              Stage 1 & Stage 2 AI
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Source Spreadsheets Processed */}
        <div className="p-4 border border-[#FED7AA] bg-[#FFF7ED] rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#C2410C] uppercase tracking-wider mb-1">
              Bảng tính đã xử lý
            </p>
            <p className="text-2xl font-black text-[#C2410C] font-mono">
              {stats.totalSourceFiles}
            </p>
            <p className="text-[10px] font-semibold text-[#EA580C] mt-0.5 uppercase tracking-wide">
              Drive: {stats.sourcesBreakdown.drive_sheets} • Excel: {stats.sourcesBreakdown.local_xlsx}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#FED7AA] text-[#C2410C] flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

