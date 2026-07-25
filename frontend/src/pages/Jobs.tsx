import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, X, Filter, SortDesc } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useProjectsData } from '../hooks/useProjectsData';
import { useAllJobPayments } from '../hooks/useAllJobPayments';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectCard from '../components/projects/ProjectCard';
import type { JobStatus } from '../types';

type SortOption = 'newest' | 'oldest' | 'highest_value' | 'lowest_value' | 'remaining_balance' | 'alphabetical';

export default function JobsNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get dashboard filter from navigation state
  const dashboardFilter = location.state?.filters;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>(
    dashboardFilter?.status || 'all'
  );
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all projects data
  const { projects, isLoading } = useProjectsData();
  
  // Fetch payments for all jobs
  const jobIds = useMemo(() => projects.map(p => p.job.id), [projects]);
  const { paymentsMap, isLoading: isLoadingPayments } = useAllJobPayments(jobIds);

  // Enrich projects with payments
  const enrichedProjects = useMemo(() => {
    return projects.map(project => ({
      ...project,
      payments: paymentsMap.get(project.job.id) || [],
    }));
  }, [projects, paymentsMap]);

  // Filter projects - memoized
  const filteredProjects = useMemo(() => {
    let filtered = enrichedProjects;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.job.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        return (
          p.customer.full_name.toLowerCase().includes(lowerSearch) ||
          p.quotation.quotation_number.toLowerCase().includes(lowerSearch) ||
          p.job.id.toLowerCase().includes(lowerSearch) ||
          p.customer.phone_number.includes(searchTerm) ||
          p.customer.address?.toLowerCase().includes(lowerSearch) ||
          p.job.notes?.toLowerCase().includes(lowerSearch)
        );
      });
    }

    return filtered;
  }, [enrichedProjects, statusFilter, searchTerm]);

  // Sort projects - memoized  
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];

    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.job.created_at).getTime() - new Date(a.job.created_at).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.job.created_at).getTime() - new Date(b.job.created_at).getTime());
        break;
      case 'highest_value':
        sorted.sort((a, b) => parseFloat(b.quotation.final_price) - parseFloat(a.quotation.final_price));
        break;
      case 'lowest_value':
        sorted.sort((a, b) => parseFloat(a.quotation.final_price) - parseFloat(b.quotation.final_price));
        break;
      case 'remaining_balance': {
        // Pre-calculate remaining balances for better performance
        const balances = new Map();
        sorted.forEach(p => {
          const total = parseFloat(p.quotation.final_price);
          const paid = p.payments
            .filter(pay => pay.status === 'paid')
            .reduce((sum, pay) => sum + parseFloat(pay.amount), 0);
          balances.set(p.job.id, total - paid);
        });
        sorted.sort((a, b) => {
          const remainingA = balances.get(a.job.id) || 0;
          const remainingB = balances.get(b.job.id) || 0;
          return remainingB - remainingA;
        });
        break;
      }
      case 'alphabetical':
        sorted.sort((a, b) => a.customer.full_name.localeCompare(b.customer.full_name, 'ar'));
        break;
    }

    return sorted;
  }, [filteredProjects, sortBy]);

  const handleViewProject = useCallback((jobId: string) => {
    navigate(`/jobs/${jobId}`);
  }, [navigate]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('newest');
  }, []);

  const handleCreateProject = useCallback(() => {
    navigate('/projects/new');
  }, [navigate]);

  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('projects.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {sortedProjects.length} {t('projects.title')}
          </p>
        </div>
        <Button
          onClick={handleCreateProject}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('projects.addProject')}
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('projects.searchProjects')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 w-full"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t('common.filter')}
              {activeFiltersCount > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" />
                {t('projects.clearFilters')}
              </button>
            )}
          </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.status')}
              </label>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as JobStatus | 'all')}
              >
                <option value="all">{t('projects.allStatuses')}</option>
                <option value="pending">{t('jobStatus.pending')}</option>
                <option value="measuring">{t('jobStatus.measuring')}</option>
                <option value="in_production">{t('jobStatus.in_production')}</option>
                <option value="ready_for_installation">{t('jobStatus.ready_for_installation')}</option>
                <option value="installed">{t('jobStatus.installed')}</option>
                <option value="completed">{t('jobStatus.completed')}</option>
                <option value="cancelled">{t('jobStatus.cancelled')}</option>
              </Select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <SortDesc className="w-4 h-4 inline mr-1" />
                {t('projects.sortBy')}
              </label>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as SortOption)}
              >
                <option value="newest">{t('projects.sort.newest')}</option>
                <option value="oldest">{t('projects.sort.oldest')}</option>
                <option value="highest_value">{t('projects.sort.highestValue')}</option>
                <option value="lowest_value">{t('projects.sort.lowestValue')}</option>
                <option value="remaining_balance">{t('projects.sort.remainingBalance')}</option>
                <option value="alphabetical">{t('projects.sort.alphabetical')}</option>
              </Select>
            </div>

            {/* Placeholder for future filters */}
            <div className="opacity-50">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.priority')}
              </label>
              <Select disabled>
                <option>{t('common.all')}</option>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Projects Grid */}
      <div>
        {isLoading || isLoadingPayments ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Search className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('projects.noProjectsFound')}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? t('projects.tryAdjustingFilters')
                : t('projects.noProjectsDescription')}
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <Button variant="outline" onClick={handleClearFilters}>
                {t('projects.clearFilters')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.job.id}
                job={project.job}
                quotation={project.quotation}
                customer={project.customer}
                payments={project.payments}
                onView={handleViewProject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
