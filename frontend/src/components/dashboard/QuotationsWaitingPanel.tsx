import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { jobsApi } from '../../services/jobs';
import Button from '../Button';
import Modal from '../Modal';
import Select from '../Select';

export default function QuotationsWaitingPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch available quotations
  const { data: availableQuotations, isLoading } = useQuery({
    queryKey: ['quotations', 'available-for-job'],
    queryFn: () => jobsApi.getAvailableQuotationsForJob(),
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotationId) return;

    try {
      await jobsApi.create({
        quotation_id: selectedQuotationId,
        notes: notes || undefined,
      });

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });

      setIsCreateModalOpen(false);
      setSelectedQuotationId('');
      setNotes('');
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  if (isLoading || !availableQuotations || availableQuotations.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                {availableQuotations.length} {t('dashboard.pipeline.quotation')} {t('dashboard.kpi.quotationsWaiting')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('dashboard.alerts.quotationWaiting')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {t('projects.createFromQuotation')}
          </Button>
        </div>

        {/* Quick list of quotations */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {availableQuotations.slice(0, 6).map((quotation) => (
            <div
              key={quotation.id}
              className="bg-white border border-gray-200 rounded p-2 text-sm"
            >
              <div className="font-medium">{quotation.quotation_number}</div>
              <div className="text-gray-600">{quotation.customer_name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('projects.createFromQuotation')}
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('projects.selectQuotation')} *
            </label>
            <Select
              value={selectedQuotationId}
              onChange={(value) => setSelectedQuotationId(value)}
              required
            >
              <option value="">{t('projects.selectQuotation')}</option>
              {availableQuotations.map(quotation => (
                <option key={quotation.id} value={quotation.id}>
                  {quotation.quotation_number} - {quotation.customer_name} - {new Date(quotation.quotation_date).toLocaleDateString()}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('projects.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
