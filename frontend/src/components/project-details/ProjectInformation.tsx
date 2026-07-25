import { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Job, Quotation, Customer } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import JobStatusBadge from '../JobStatusBadge';
import Badge from '../Badge';
import CollapsibleSection from '../CollapsibleSection';
import type { QuotationStatus } from '../../types';

interface ProjectInformationProps {
  job: Job;
  quotation: Quotation;
  customer: Customer | undefined;
  totalPaid: number;
  remainingBalance: number;
  paidPercentage: number;
}

const getQuotationStatusBadgeVariant = (status: QuotationStatus): 'info' | 'success' | 'warning' | 'danger' => {
  const variants: Record<QuotationStatus, 'info' | 'success' | 'warning' | 'danger'> = {
    draft: 'info',
    waiting_for_measurement: 'warning',
    measured: 'info',
    under_negotiation: 'warning',
    sent: 'info',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'danger',
    expired: 'danger',
  };
  return variants[status] || 'info';
};

const getGoogleMapsLink = (address: string) => {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
};

const ProjectInformation = memo(function ProjectInformation({ 
  job, 
  quotation, 
  customer, 
  totalPaid, 
  remainingBalance, 
  paidPercentage 
}: ProjectInformationProps) {
  const { t } = useTranslation();

  return (
    <CollapsibleSection title={t('projects.projectInformation')} defaultOpen={true}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">Job ID</div>
          <div className="text-gray-900">#{job.id.substring(0, 8).toUpperCase()}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.customerName')}</div>
          <div className="text-gray-900">{customer?.full_name || '-'}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.customerPhone')}</div>
          <div className="text-gray-900">{customer?.phone_number || '-'}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('customers.governorate')}</div>
          <div className="text-gray-900">{customer?.governorate || '-'}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('customers.address')}</div>
          <div className="text-gray-900">{customer?.address || '-'}</div>
        </div>
        
        {customer?.address && (
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Google Maps</div>
            <a
              href={getGoogleMapsLink(customer.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              {t('projects.viewOnMaps')}
            </a>
          </div>
        )}
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.currentStatus')}</div>
          <JobStatusBadge status={job.status} />
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.quotationStatus')}</div>
          <Badge variant={getQuotationStatusBadgeVariant(quotation.status)}>
            {t(`quotationStatus.${quotation.status}`)}
          </Badge>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.totalPrice')}</div>
          <div className="text-lg font-semibold text-gray-900">{formatCurrency(quotation.final_price)}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.paid')}</div>
          <div className="text-lg font-semibold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.remaining')}</div>
          <div className="text-lg font-semibold text-red-600">{formatCurrency(remainingBalance)}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.depositPercentage')}</div>
          <div className="text-gray-900">{paidPercentage.toFixed(1)}%</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.createdDate')}</div>
          <div className="text-gray-900">{formatDate(job.created_at)}</div>
        </div>
        
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1">{t('projects.lastUpdated')}</div>
          <div className="text-gray-900">{formatDate(job.updated_at)}</div>
        </div>
      </div>
    </CollapsibleSection>
  );
});

export default ProjectInformation;
