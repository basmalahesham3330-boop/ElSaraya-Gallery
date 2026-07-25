import { useTranslation } from '../../i18n/useTranslation';
import type { Pipeline } from '../../types/dashboard';
import PipelineColumn from './PipelineColumn';

interface PipelineBoardProps {
  pipeline: Pipeline;
}

const columnColors = {
  measurement: 'bg-blue-600',
  quotation: 'bg-yellow-600',
  depositReceived: 'bg-green-600',
  manufacturing: 'bg-purple-600',
  installation: 'bg-orange-600',
  completed: 'bg-gray-600',
  postponed: 'bg-amber-600',
  rejected: 'bg-red-600',
};

export default function PipelineBoard({ pipeline }: PipelineBoardProps) {
  const { t } = useTranslation();

  // Dashboard shows 8 workflow columns as requested:
  // 1. Measurement, 2. Quotation, 3. Deposit Paid, 4. Manufacturing,
  // 5. Installation, 6. Completed, 7. Postponed, 8. Rejected
  // Each job appears in exactly ONE column based on backend logic.

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.pipeline.title')}</h2>
      
      {/* Grid Layout: 4 columns per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Row 1 */}
        <PipelineColumn
          title={t('dashboard.pipeline.measurement')}
          count={pipeline.measurement.length}
          color={columnColors.measurement}
          jobs={pipeline.measurement}
        />
        <PipelineColumn
          title={t('dashboard.pipeline.quotation')}
          count={pipeline.quotation.length}
          color={columnColors.quotation}
          jobs={pipeline.quotation}
        />
        <PipelineColumn
          title={t('dashboard.pipeline.depositReceived')}
          count={pipeline.depositReceived.length}
          color={columnColors.depositReceived}
          jobs={pipeline.depositReceived}
        />
        <PipelineColumn
          title={t('dashboard.pipeline.manufacturing')}
          count={pipeline.manufacturing.length}
          color={columnColors.manufacturing}
          jobs={pipeline.manufacturing}
        />
        
        {/* Row 2 */}
        <PipelineColumn
          title={t('dashboard.pipeline.installation')}
          count={pipeline.installation.length}
          color={columnColors.installation}
          jobs={pipeline.installation}
        />
        <PipelineColumn
          title={t('dashboard.pipeline.completed')}
          count={pipeline.completed.length}
          color={columnColors.completed}
          jobs={pipeline.completed}
        />
        <PipelineColumn
          title={t('dashboard.pipeline.postponed')}
          count={pipeline.postponed?.length || 0}
          color={columnColors.postponed}
          jobs={pipeline.postponed || []}
        />
        <PipelineColumn
          title={t('dashboard.pipeline.rejected')}
          count={pipeline.rejected.length}
          color={columnColors.rejected}
          jobs={pipeline.rejected}
        />
      </div>
    </div>
  );
}
