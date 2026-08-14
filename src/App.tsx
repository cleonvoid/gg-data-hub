import React, { useState, useEffect, useCallback } from 'react';
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
    } catch (err) {
      console.error('Error fetching stats/merges:', err);
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
    } catch (err) {
      console.error('Error loading entities:', err);
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
    setIsSeeding(true);
    try {
      const res = await seedDemoData();
      await loadStatsAndMerges();
      await loadEntities();
      showToast('Đã nạp lại dữ liệu sự kiện mẫu thành công!');
    } catch (err) {
      console.error('Seed failed:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle Ingest completion
  const handleImportComplete = (summary: any) => {
    loadStatsAndMerges();
    loadEntities();
    if (summary.pendingMergeSuggestionsCount > 0) {
      setIsMergeModalOpen(true);
      showToast(`Đã nạp ${summary.totalIngested} bản ghi. Phát hiện ${summary.pendingMergeSuggestionsCount} trường hợp cần duyệt gộp!`);
    } else {
      showToast(`Đã nạp ${summary.totalIngested} bản ghi thành công!`);
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
