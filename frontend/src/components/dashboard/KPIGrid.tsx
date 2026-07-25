import { Briefcase, FileText, Calendar, Wrench, CreditCard, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import type { KPIs } from '../../types/dashboard';
import KPICard from './KPICard';

interface KPIGridProps {
  kpis: KPIs;
}

export default function KPIGrid({ kpis }: KPIGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
    </div>
  );
}
