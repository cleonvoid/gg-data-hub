import React from 'react';
import { Database, Plus, RefreshCw, Sparkles, CheckCircle2, User as UserIcon, LogOut, FileSpreadsheet } from 'lucide-react';
import { AuthState, loginWithGoogle, logoutUser } from '../services/auth';

interface NavbarProps {
  authState: AuthState;
  onOpenImport: () => void;
  onOpenPendingMerges: () => void;
  pendingMergesCount: number;
  onSeedData: () => void;
  isSeeding: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  authState,
  onOpenImport,
  onOpenPendingMerges,
  pendingMergesCount,
  onSeedData,
  isSeeding,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-xs">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-[#111827] text-lg tracking-tight">EVENT DATA HUB</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] uppercase tracking-wider">
                Gemini 3.7 & Embeddings
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest hidden sm:block">
              Hệ thống Chuẩn hoá Dữ liệu & Phân giải Thực thể Sự kiện
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Seed / Reset Demo Button */}
          <button
            onClick={onSeedData}
            disabled={isSeeding}
            title="Khởi tạo lại tập dữ liệu sự kiện mẫu"
            className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-lg text-[#4B5563] bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors disabled:opacity-50 uppercase tracking-wider"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSeeding ? 'animate-spin text-[#2563EB]' : ''}`} />
            {isSeeding ? 'Đang nạp...' : 'Dữ liệu mẫu'}
          </button>

          {/* Pending Merges Notification Pill */}
          {pendingMergesCount > 0 && (
            <button
              onClick={onOpenPendingMerges}
              className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-lg bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] hover:bg-[#FFEDD5] transition-colors uppercase tracking-wider"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#C2410C]" />
              <span>Duyệt gộp ({pendingMergesCount})</span>
            </button>
          )}

          {/* Import New Event Data Button */}
          <button
            onClick={onOpenImport}
            className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors shadow-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 mr-1 stroke-[3]" />
            <span>+ Nhập Dữ liệu mới</span>
          </button>

          {/* Google Auth / User Badge */}
          <div className="border-l border-[#E5E7EB] pl-3">
            {authState.user ? (
              <div className="flex items-center space-x-2">
                {authState.user.photoURL ? (
                  <img
                    src={authState.user.photoURL}
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full border border-[#D1D5DB]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#E5E7EB] border border-[#D1D5DB] flex items-center justify-center font-bold text-[#4B5563] text-xs">
                    AD
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-[#111827] leading-tight">
                    {authState.user.displayName || 'Tài khoản Google'}
                  </p>
                  <p className="text-[10px] font-semibold text-[#6B7280] leading-none truncate max-w-[120px]">
                    {authState.user.email}
                  </p>
                </div>
                <button
                  onClick={logoutUser}
                  title="Đăng xuất"
                  className="text-[#9CA3AF] hover:text-[#4B5563] p-1 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-lg border border-[#D1D5DB] text-[#374151] bg-white hover:bg-[#F9FAFB] transition-colors uppercase tracking-wider"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
