import { User, Clock, Calendar, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import type { JobPipelineCard as JobCard } from '../../types/dashboard';

interface JobPipelineCardProps {
  data: JobCard;
}

const priorityColors = {
  high: 'border-t-red-500',
  medium: 'border-t-yellow-500',
  low: 'border-t-green-500',
};

const priorityBadgeColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export default function JobPipelineCard({ data }: JobPipelineCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const priorityClass = priorityColors[data.priority];
  const priorityBadgeClass = priorityBadgeColors[data.priority];

  const handleClick = () => {
    navigate(`/jobs/${data.job_id}`);
  };

  const paymentPercentage = parseFloat(data.payment_progress.percentage);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-t-4 ${priorityClass} p-4 cursor-pointer hover:shadow-md transition-shadow ${
        data.is_overdue ? 'ring-2 ring-red-500' : ''
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* Header: Customer Name and Days Badge */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900 text-sm line-clamp-1" title={data.customer_name}>
          {data.customer_name}
        </h4>
        <span className={`${priorityBadgeClass} text-xs px-2 py-1 rounded-full whitespace-nowrap mr-2`}>
          {data.days_in_stage} {t('dashboard.jobCard.daysInStage')}
        </span>
      </div>

      {/* Quotation Number */}
      <p className="text-xs text-gray-600 mb-3">
        {data.quotation_number}
      </p>

      {/* Assigned Engineer (if any) */}
      {data.assigned_engineer && (
        <div className="flex items-center text-xs text-gray-600 mb-2">
          <User className="w-3 h-3 ml-1" />
          <span>{data.assigned_engineer}</span>
        </div>
      )}

      {/* Last Activity */}
      <div className="flex items-center text-xs text-gray-500 mb-3">
        <Clock className="w-3 h-3 ml-1" />
        <span>{data.last_activity}</span>
      </div>

      {/* Payment Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{t('dashboard.jobCard.paymentProgress')}</span>
          <span>{paymentPercentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${paymentPercentage}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {parseFloat(data.payment_progress.paid).toLocaleString()} / {parseFloat(data.payment_progress.total).toLocaleString()}
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-1">
        {data.measurement_date && (
          <div className="flex items-center text-xs text-gray-600">
            <Calendar className="w-3 h-3 ml-1" />
            <span>{t('dashboard.jobCard.measurement')}: {new Date(data.measurement_date).toLocaleDateString()}</span>
          </div>
        )}
        {data.installation_date && (
          <div className="flex items-center text-xs text-gray-600">
            <Calendar className="w-3 h-3 ml-1" />
            <span>{t('dashboard.jobCard.installation')}: {new Date(data.installation_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Overdue Indicator */}
      {data.is_overdue && (
        <div className="flex items-center text-xs text-red-600 mt-2 font-medium">
          <AlertCircle className="w-3 h-3 ml-1" />
          <span>{t('dashboard.jobCard.overdue')}</span>
        </div>
      )}
    </div>
  );
}
