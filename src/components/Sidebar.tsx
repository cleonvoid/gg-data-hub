import React from 'react';
import {
  Users,
  GitMerge,
  FileSpreadsheet,
  Building2,
  TrendingDown,
  Layers,
  CheckCircle,
  Filter,
} from 'lucide-react';
import { IngestionStats } from '../types/index';

interface SidebarProps {
  currentTab: 'entities' | 'merges' | 'sources';
  onSelectTab: (tab: 'entities' | 'merges' | 'sources') => void;
  stats: IngestionStats | null;
  selectedOrg: string;
  onSelectOrg: (org: string) => void;
  minAppearances: number;
  onSelectMinAppearances: (min: number) => void;
  pendingMergesCount: number;
}

const COMMON_ORGS = [
  'Tất cả đơn vị',
  'Viện Hàn lâm KH&CN',
  'FPT',
  'ĐH Bách Khoa',
  'Sở Khoa học và Công nghệ',
  'Viettel',
  'NIC',
  'CMC',
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  stats,
  selectedOrg,
  onSelectOrg,
  minAppearances,
  onSelectMinAppearances,
  pendingMergesCount,
}) => {
  return (
    <aside className="w-64 bg-[#F9FAFB] border-r border-[#E5E7EB] flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto p-4">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2 px-2">
            Không gian làm việc
          </p>
          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('entities')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                currentTab === 'entities'
                  ? 'bg-[#EFF6FF] text-[#2563EB] font-bold'
                  : 'text-[#4B5563] font-medium hover:bg-[#F3F4F6]'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 text-[#2563EB]" />
                <span>Thực thể (Entities)</span>
              </div>
              <span className="text-[11px] bg-white border border-[#E5E7EB] text-[#111827] rounded-md px-2 py-0.5 font-bold font-mono">
                {stats?.totalCanonicalEntities ?? 0}
              </span>
            </button>

            <button
              onClick={() => onSelectTab('merges')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                currentTab === 'merges'
                  ? 'bg-[#FFF7ED] text-[#C2410C] font-bold'
                  : 'text-[#4B5563] font-medium hover:bg-[#F3F4F6]'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <GitMerge className="w-4 h-4 text-[#C2410C]" />
                <span>Gợi ý gộp AI</span>
              </div>
              {pendingMergesCount > 0 && (
                <span className="text-[11px] bg-[#C2410C] text-white font-black rounded-md px-2 py-0.5 animate-pulse">
                  {pendingMergesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('sources')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                currentTab === 'sources'
                  ? 'bg-[#ECFDF5] text-[#047857] font-bold'
                  : 'text-[#4B5563] font-medium hover:bg-[#F3F4F6]'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-4 h-4 text-[#059669]" />
                <span>Nguồn & Bảng tính</span>
              </div>
              <span className="text-[11px] bg-white border border-[#E5E7EB] text-[#111827] rounded-md px-2 py-0.5 font-bold font-mono">
                {stats?.totalSourceFiles ?? 0}
              </span>
            </button>
          </nav>
        </div>

        {/* Quick Filter: Appearances */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
              Tần suất tham gia
            </p>
            {minAppearances > 1 && (
              <button
                onClick={() => onSelectMinAppearances(1)}
                className="text-[10px] font-bold uppercase text-[#2563EB] hover:underline"
              >
                Đặt lại
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 px-1">
            {[1, 2, 3].map((min) => (
              <button
                key={min}
                onClick={() => onSelectMinAppearances(min)}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-colors ${
                  minAppearances === min
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-2xs'
                    : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                }`}
              >
                {min === 1 ? 'Tất cả' : `≥ ${min} lần`}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Filter: Organizations */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2 px-2">
            Đơn vị / Cơ quan
          </p>
          <div className="space-y-0.5">
            {COMMON_ORGS.map((org) => {
              const isSelected = (selectedOrg === '' && org === 'Tất cả đơn vị') || selectedOrg === org;
              return (
                <button
                  key={org}
                  onClick={() => onSelectOrg(org === 'Tất cả đơn vị' ? '' : org)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors truncate flex items-center justify-between ${
                    isSelected
                      ? 'bg-white text-[#111827] font-bold shadow-2xs border border-[#E5E7EB]'
                      : 'text-[#4B5563] font-medium hover:bg-[#F3F4F6]'
                  }`}
                >
                  <span className="truncate">{org}</span>
                  {isSelected && <CheckCircle className="w-3.5 h-3.5 text-[#2563EB] shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Status & Aggregate Stats Summary Card at bottom */}
      <div className="mt-6 pt-4 border-t border-[#E5E7EB] space-y-3">
        {/* Gemini Engine Status widget */}
        <div className="p-3.5 border border-[#E5E7EB] rounded-xl bg-white shadow-2xs space-y-2">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Tình trạng AI</p>
          <div className="flex items-center text-xs font-bold text-[#059669]">
            <span className="w-2 h-2 bg-[#059669] rounded-full mr-2 animate-pulse"></span>
            Gemini 3.7 & Embeddings
          </div>
          <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#2563EB] w-4/5 h-full rounded-full"></div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#6B7280] font-semibold">
            <span>Stage 1: Vector 768d</span>
            <span>Stage 2: LLM Active</span>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] space-y-2 shadow-2xs text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Tổng bản ghi</span>
            <span className="font-black text-[#111827] font-mono">
              {stats?.totalRawRecords ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Thực thể chuẩn</span>
            <span className="font-black text-[#2563EB] font-mono">
              {stats?.totalCanonicalEntities ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-[#F3F4F6]">
            <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider flex items-center">
              <TrendingDown className="w-3.5 h-3.5 mr-1" />
              Tỷ lệ trùng lặp
            </span>
            <span className="text-xs font-black text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-md border border-[#A7F3D0] font-mono">
              +{stats?.dedupRatio ?? 0}%
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
