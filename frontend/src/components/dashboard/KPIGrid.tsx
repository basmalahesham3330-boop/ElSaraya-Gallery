import { Briefcase, FileText, Calendar, Wrench, CreditCard, AlertTriangle, Factory, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import type { KPIs } from '../../types/dashboard';
import KPICard from './KPICard';

interface KPIGridProps {
  kpis: KPIs;
}

export default function KPIGrid({ kpis }: KPIGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* Row 1: Core Operational KPIs */}
      <KPICard
        label={t('dashboard.kpi.totalActiveJobs')}
        value={kpis.total_active_jobs}
        icon={Briefcase}
        color="blue"
      />
      <KPICard
        label={t('dashboard.kpi.pendingQuotations')}
        value={kpis.pending_quotations}
        icon={FileText}
        color="yellow"
      />
      <KPICard
        label={t('dashboard.kpi.measurementsScheduledToday')}
        value={kpis.measurements_scheduled_today}
        icon={Calendar}
        color="green"
      />
      <KPICard
        label={t('dashboard.kpi.installationsScheduledToday')}
        value={kpis.installations_scheduled_today}
        icon={Wrench}
        color="purple"
      />
      <KPICard
        label={t('dashboard.kpi.manufacturingQueue')}
        value={kpis.manufacturing_queue}
        icon={Factory}
        color="purple"
      />

      {/* Row 2: Performance & Alert KPIs */}
      <KPICard
        label={t('dashboard.kpi.completedLast7Days')}
        value={kpis.completed_last_7_days}
        icon={CheckCircle2}
        color="green"
      />
      <KPICard
        label={t('dashboard.kpi.lateManufacturing')}
        value={kpis.late_manufacturing}
        icon={AlertCircle}
        color="red"
      />
      <KPICard
        label={t('dashboard.kpi.overduePayments')}
        value={kpis.overdue_payments}
        icon={CreditCard}
        color="red"
      />
      <KPICard
        label={t('dashboard.kpi.delayedProjects')}
        value={kpis.delayed_projects}
        icon={AlertTriangle}
        color="orange"
      />
      <KPICard
        label={t('dashboard.kpi.maintenanceJobs')}
        value={kpis.maintenance_jobs}
        icon={Settings}
        color="blue"
      />
    </div>
  );
}
