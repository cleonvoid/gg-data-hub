import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { StatsPanel } from './components/StatsPanel';
import { DashboardView } from './components/DashboardView';
import { EntityDetailDrawer } from './components/EntityDetailDrawer';
import { MergeReviewModal } from './components/MergeReviewModal';
import { ImportModal } from './components/ImportModal';
import { SourcesView } from './components/SourcesView';
import {
  IngestionStats,
  CanonicalEntity,
  MergeSuggestion,
  StructuredQueryFilter,
} from './types/index';
import {
  fetchStats,
  fetchEntities,
  fetchPendingMerges,
  seedDemoData,
} from './services/api';
import { AuthState, initAuthListener } from './services/auth';

export function App() {
  // Navigation and active view state
  const [currentTab, setCurrentTab] = useState<'entities' | 'merges' | 'sources'>('entities');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  // Data states
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [entities, setEntities] = useState<CanonicalEntity[]>([]);
  const [totalEntities, setTotalEntities] = useState(0);
  const [pendingMerges, setPendingMerges] = useState<MergeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [minAppearances, setMinAppearances] = useState(1);
  const [activeStructuredFilters, setActiveStructuredFilters] = useState<StructuredQueryFilter[]>([]);

  // Auth State
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isGuestDemo: true,
  });

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Persistent fallback embedding count warning state
  const [fallbackEmbeddingCount, setFallbackEmbeddingCount] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initialize Auth Listener
  useEffect(() => {
    const unsubscribe = initAuthListener((state) => {
      setAuthState(state);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Stats & Pending Merges
  const loadStatsAndMerges = useCallback(async () => {
    try {
      const [statsData, mergesData] = await Promise.all([
        fetchStats(),
        fetchPendingMerges(),
      ]);
      setStats(statsData);
      setPendingMerges(mergesData);
      setServerError(null);
    } catch (err: any) {
      console.error('Error fetching stats/merges:', err);
      setServerError(err?.message || 'Không thể tải dữ liệu thống kê từ máy chủ.');
    }
  }, []);

  // 3. Query Entities with active filters
  const loadEntities = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchEntities({
        search: searchQuery,
        organization: selectedOrg,
        minAppearances: minAppearances > 1 ? minAppearances : undefined,
        page,
        limit,
        structuredFilters: activeStructuredFilters,
      });
      setEntities(res.items);
      setTotalEntities(res.total);
      setServerError(null);
    } catch (err: any) {
      console.error('Error loading entities:', err);
      setServerError(err?.message || 'Không thể tải danh sách thực thể từ máy chủ.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedOrg, minAppearances, page, limit, activeStructuredFilters]);

  // Initial load & when filters change
  useEffect(() => {
    loadStatsAndMerges();
  }, [loadStatsAndMerges]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  // Reset Demo Data
  const handleSeedData = async () => {
    const confirmed = window.confirm(
      'CẢNH BÁO: Thao tác này sẽ XÓA VĨNH VIỄN TOÀN BỘ dữ liệu người tham gia, thực thể chuẩn hóa và lịch sử gộp của tổ chức để nạp lại dữ liệu mẫu.\n\nBạn có chắc chắn muốn tiếp tục không?'
    );
    if (!confirmed) return;

    setIsSeeding(true);
    try {
      const res = await seedDemoData();
      await loadStatsAndMerges();
      await loadEntities();
      showToast('Đã nạp lại dữ liệu sự kiện mẫu thành công!');
    } catch (err: any) {
      console.error('Seed failed:', err);
      showToast(err?.message || 'Không thể nạp dữ liệu mẫu');
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle Ingest completion
  const handleImportComplete = (summary: any) => {
    loadStatsAndMerges();
    loadEntities();
    const skippedText =
      summary.skippedDuplicateCount && summary.skippedDuplicateCount > 0
        ? ` (bỏ qua ${summary.skippedDuplicateCount} bản ghi đã được nhập trước đó)`
        : '';

    if (summary.fallbackEmbeddingCount && summary.fallbackEmbeddingCount > 0) {
      setFallbackEmbeddingCount(summary.fallbackEmbeddingCount);
      showToast(
        `Cảnh báo: ${summary.fallbackEmbeddingCount} bản ghi dùng vector dự phòng do dịch vụ embedding không khả dụng. Chất lượng phân giải thực thể bị giảm.${skippedText}`
      );
    } else if (summary.pendingMergeSuggestionsCount > 0) {
      setIsMergeModalOpen(true);
      showToast(
        `Đã nạp ${summary.totalIngested} bản ghi${skippedText}. Phát hiện ${summary.pendingMergeSuggestionsCount} trường hợp cần duyệt gộp!`
      );
    } else if (summary.skippedDuplicateCount > 0 && summary.totalIngested === 0) {
      showToast(`Toàn bộ ${summary.skippedDuplicateCount} bản ghi đã được nhập trước đó (bỏ qua trùng lặp).`);
    } else {
      showToast(`Đã nạp ${summary.totalIngested} bản ghi thành công!${skippedText}`);
    }
  };

  // Handle Merge adjudication finished
  const handleAdjudicated = async () => {
    await loadStatsAndMerges();
    await loadEntities();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans text-[#111827] antialiased">
      {/* Top Navigation */}
      <Navbar
        authState={authState}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenPendingMerges={() => setIsMergeModalOpen(true)}
        pendingMergesCount={pendingMerges.length}
        onSeedData={handleSeedData}
        isSeeding={isSeeding}
      />

      {/* Main Container */}
      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'merges') {
              setIsMergeModalOpen(true);
            } else {
              setCurrentTab(tab);
            }
          }}
          stats={stats}
          selectedOrg={selectedOrg}
          onSelectOrg={(org) => {
            setSelectedOrg(org);
            setPage(1);
          }}
          minAppearances={minAppearances}
          onSelectMinAppearances={(min) => {
            setMinAppearances(min);
            setPage(1);
          }}
          pendingMergesCount={pendingMerges.length}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Server / Database Connection Error Banner */}
          {serverError && (
            <div className="mb-6 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center justify-between space-x-3 text-[#991B1B]">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                <div className="text-xs">
                  <span className="font-bold">Lỗi máy chủ / Cơ sở dữ liệu:</span> {serverError}
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    loadStatsAndMerges();
                    loadEntities();
                  }}
                  className="px-3 py-1.5 bg-[#DC2626] text-white text-xs font-semibold rounded-lg hover:bg-[#B91C1C] transition-colors cursor-pointer"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => setServerError(null)}
                  className="text-[#991B1B] hover:text-[#7F1D1D] p-1 rounded-lg hover:bg-[#FEE2E2] transition-colors shrink-0 cursor-pointer"
                  title="Đóng thông báo"
                  aria-label="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Persistent Fallback Embedding Warning Banner */}
          {fallbackEmbeddingCount > 0 && (
            <div className="mb-6 p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center justify-between space-x-3 text-[#92400E]">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-[#D97706]" />
                <div className="text-xs">
                  <span className="font-bold">Cảnh báo chất lượng Vector Embedding:</span> Có {fallbackEmbeddingCount} bản ghi đã sử dụng vector dự phòng do dịch vụ embedding không khả dụng. Chất lượng phân giải thực thể và độ chính xác khi ghép nối có thể bị giảm.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFallbackEmbeddingCount(0)}
                className="text-[#92400E] hover:text-[#78350F] p-1 rounded-lg hover:bg-[#FEF3C7] transition-colors shrink-0 cursor-pointer"
                title="Đóng thông báo"
                aria-label="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Metric Cards */}
          <StatsPanel stats={stats} />

          {/* Primary View Router */}
          {currentTab === 'entities' && (
            <DashboardView
              entities={entities}
              total={totalEntities}
              page={page}
              limit={limit}
              onPageChange={setPage}
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setActiveStructuredFilters([]);
                setPage(1);
              }}
              activeStructuredFilters={activeStructuredFilters}
              onApplyStructuredFilters={(filters) => {
                setActiveStructuredFilters(filters);
                setPage(1);
              }}
              onClearFilters={() => {
                setSearchQuery('');
                setSelectedOrg('');
                setMinAppearances(1);
                setActiveStructuredFilters([]);
                setPage(1);
              }}
              onSelectEntity={(id) => setSelectedEntityId(id)}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'sources' && (
            <SourcesView
              stats={stats}
              onOpenImport={() => setIsImportModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Slide-in Entity Detail Drawer */}
      <EntityDetailDrawer
        entityId={selectedEntityId}
        onClose={() => setSelectedEntityId(null)}
      />

      {/* Two-Stage Entity Resolution Merge Review Modal */}
      <MergeReviewModal
        isOpen={isMergeModalOpen}
        suggestions={pendingMerges}
        onClose={() => setIsMergeModalOpen(false)}
        onAdjudicated={handleAdjudicated}
      />

      {/* AI Ingestion & Schema Mapping Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        authState={authState}
        onImportComplete={handleImportComplete}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#111827] text-white px-5 py-3.5 rounded-xl shadow-2xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border border-[#374151] animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
