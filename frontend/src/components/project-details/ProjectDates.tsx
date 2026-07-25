import { memo } from 'react';
import { Calendar } from 'lucide-react';
import type { Job, Quotation } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import Input from '../Input';
import CollapsibleSection from '../CollapsibleSection';

interface ProjectDatesProps {
  job: Job;
  quotation: Quotation;
  onDateUpdate: (field: string, value: string) => void;
}

const ProjectDates = memo(function ProjectDates({ job, quotation, onDateUpdate }: ProjectDatesProps) {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('projects.projectDates')}
      defaultOpen={true}
      badge={<Calendar className="w-5 h-5 text-gray-400" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.quotationSentDate')}
          </label>
          <Input
            type="date"
            value={quotation.quotation_date || ''}
            disabled
            className="bg-gray-50"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.measurementDate')}
          </label>
          <Input
            type="date"
            value={job.measurement_date || ''}
            onChange={(e) => onDateUpdate('measurement_date', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.manufacturingStart')}
          </label>
          <Input
            type="date"
            value={job.production_start || ''}
            onChange={(e) => onDateUpdate('production_start', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.manufacturingFinish')}
          </label>
          <Input
            type="date"
            value={job.production_end || ''}
            onChange={(e) => onDateUpdate('production_end', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.installationDate')}
          </label>
          <Input
            type="date"
            value={job.installation_date || ''}
            onChange={(e) => onDateUpdate('installation_date', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.deliveryDate')}
          </label>
          <Input
            type="date"
            value={job.delivery_date || ''}
            onChange={(e) => onDateUpdate('delivery_date', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('projects.completionDate')}
          </label>
          <Input
            type="date"
            value={job.completion_date || ''}
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">Auto-set when status changes to completed</p>
        </div>
      </div>
    </CollapsibleSection>
  );
});

export default ProjectDates;
