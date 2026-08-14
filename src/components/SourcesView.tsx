import React from 'react';
import { FileSpreadsheet, HardDrive, Layers, CheckCircle2, Clock, Calendar, Database, Plus } from 'lucide-react';
import { IngestionStats } from '../types/index';

interface SourcesViewProps {
  stats: IngestionStats | null;
  onOpenImport: () => void;
}

export const SourcesView: React.FC<SourcesViewProps> = ({ stats, onOpenImport }) => {
  const mockSources = [
    {
      id: 'drive_file_001',
      name: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
      type: 'Google Drive Sheets',
      rowsCount: 5,
      eventDate: '2025-06-15',
      importedAt: '2025-06-15 08:30',
      status: 'Đã chuẩn hoá',
    },
    {
      id: 'drive_file_002',
      name: 'DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.xlsx',
      type: 'Google Drive Sheets',
      rowsCount: 4,
      eventDate: '2025-08-10',
      importedAt: '2025-08-10 09:00',
      status: 'Đã chuẩn hoá',
    },
    {
      id: 'local_file_003',
      name: 'TapHuan_KhoiNghiep_DoiMoiSangTao_SoKHCN.xlsx',
      type: 'Tệp Excel tải lên',
      rowsCount: 3,
      eventDate: '2025-09-02',
      importedAt: '2025-09-02 14:00',
      status: 'Đã chuẩn hoá',
    },
    {
      id: 'drive_file_004',
      name: 'DienDan_DoanhNghiep_CongNgheSo_2025.xlsx',
      type: 'Google Drive Sheets',
      rowsCount: 2,
      eventDate: '2025-11-20',
      importedAt: '2025-11-20 10:00',
      status: 'Chờ duyệt gộp',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-[#111827] uppercase tracking-tight">
            NGUỒN DỮ LIỆU & LỊCH SỬ NẠP BẢNG TÍNH
          </h2>
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mt-0.5">
            Quản lý các tệp danh sách đại biểu sự kiện từ Google Drive và Excel nội bộ
          </p>
        </div>
        <button
          onClick={onOpenImport}
          className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-xs uppercase tracking-wider transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5 stroke-[3]" />
          Nạp tệp sự kiện mới
        </button>
      </div>

      {/* Sources Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="px-6 py-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
            CÁC TỆP BẢNG TÍNH ĐÃ NẠP ({mockSources.length})
          </span>
          <span className="text-xs font-semibold text-[#6B7280]">
            Tổng cộng: <strong className="text-[#111827] font-black font-mono">{stats?.totalRawRecords || 14} bản ghi thô</strong>
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-black uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3.5 px-6">Tên tệp bảng tính</th>
              <th className="py-3.5 px-6">Hình thức nạp</th>
              <th className="py-3.5 px-6">Ngày sự kiện</th>
              <th className="py-3.5 px-6 text-center">Bản ghi</th>
              <th className="py-3.5 px-6">Thời gian nạp</th>
              <th className="py-3.5 px-6 text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {mockSources.map((s) => (
              <tr key={s.id} className="hover:bg-[#EFF6FF] transition-colors">
                <td className="py-4 px-6 font-bold text-[#111827] flex items-center space-x-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#059669] shrink-0" />
                  <span className="truncate max-w-[280px]" title={s.name}>{s.name}</span>
                </td>
                <td className="py-4 px-6 text-[#4B5563]">
                  <span className="px-2.5 py-1 rounded-md bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] text-[10px] font-bold uppercase tracking-wide">
                    {s.type}
                  </span>
                </td>
                <td className="py-4 px-6 text-[#374151] font-mono font-semibold">
                  {s.eventDate}
                </td>
                <td className="py-4 px-6 text-center font-black text-[#111827] font-mono text-xs">
                  {s.rowsCount}
                </td>
                <td className="py-4 px-6 text-[#6B7280] text-[11px] font-medium">
                  {s.importedAt}
                </td>
                <td className="py-4 px-6 text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      s.status === 'Đã chuẩn hoá'
                        ? 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]'
                        : 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1 text-[#059669]" />
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
