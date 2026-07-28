import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit2, Save, X } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { measurementsApi } from '../services/measurements';
import { quotationsApi } from '../services/quotations';
import { formatDate } from '../utils/formatters';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/Table';
import type { MeasurementItem } from '../types';

export default function MeasurementDetails() {
  const { jobId, measurementId } = useParams<{ jobId: string; measurementId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [isEditingMeasurement, setIsEditingMeasurement] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [measurementData, setMeasurementData] = useState({
    visit_date: '',
    measured_by: '',
    notes: '',
  });

  const [itemFormData, setItemFormData] = useState({
    quotation_item_id: '',
    room_name: '',
    piece_number: '',
    width: '',
    height: '',
    quantity: 1,
    notes: '',
  });

  // Fetch measurement
  const { data: measurement, isLoading: isLoadingMeasurement } = useQuery({
    queryKey: ['measurements', measurementId],
    queryFn: () => measurementsApi.getById(measurementId!),
    enabled: !!measurementId,
  });

  // Fetch measurement items
  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ['measurement-items', measurementId],
    queryFn: () => measurementsApi.getItems(measurementId!),
    enabled: !!measurementId,
  });

  // Fetch quotation items for dropdown
  const { data: quotationItemsData } = useQuery({
    queryKey: ['quotation-items', measurement?.job_id],
    queryFn: async () => {
      if (!measurement?.job_id) return { items: [] };
      const jobResponse = await fetch(`/api/v1/jobs/${measurement.job_id}`);
      const job = await jobResponse.json();
      return quotationsApi.getItems(job.quotation_id);
    },
    enabled: !!measurement?.job_id && (isAddItemModalOpen || editingItemId !== null),
  });

  // Update measurement mutation
  const updateMeasurementMutation = useMutation({
    mutationFn: (data: typeof measurementData) => measurementsApi.update(measurementId!, data),
    onSuccess: () => {
      toast.success(t('success.updated'));
      queryClient.invalidateQueries({ queryKey: ['measurements', measurementId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setIsEditingMeasurement(false);
    },
    onError: () => {
      toast.error(t('errors.generic'));
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: (data: typeof itemFormData) => measurementsApi.addItem(measurementId!, data),
    onSuccess: () => {
      toast.success(t('success.created'));
      queryClient.invalidateQueries({ queryKey: ['measurement-items', measurementId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setIsAddItemModalOpen(false);
      resetItemForm();
    },
    onError: () => {
      toast.error(t('errors.generic'));
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MeasurementItem> }) => 
      measurementsApi.updateItem(id, data),
    onSuccess: () => {
      toast.success(t('success.updated'));
      queryClient.invalidateQueries({ queryKey: ['measurement-items', measurementId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setEditingItemId(null);
      resetItemForm();
    },
    onError: () => {
      toast.error(t('errors.generic'));
    },
  });

  const handleEditMeasurement = () => {
    if (measurement) {
      setMeasurementData({
        visit_date: measurement.visit_date || '',
        measured_by: measurement.measured_by || '',
        notes: measurement.notes || '',
      });
      setIsEditingMeasurement(true);
    }
  };

  const handleSaveMeasurement = () => {
    updateMeasurementMutation.mutate(measurementData);
  };

  const handleCancelEditMeasurement = () => {
    setIsEditingMeasurement(false);
    if (measurement) {
      setMeasurementData({
        visit_date: measurement.visit_date || '',
        measured_by: measurement.measured_by || '',
        notes: measurement.notes || '',
      });
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    addItemMutation.mutate(itemFormData);
  };

  const handleEditItem = (item: MeasurementItem) => {
    setItemFormData({
      quotation_item_id: item.quotation_item_id,
      room_name: item.room_name || '',
      piece_number: item.piece_number || '',
      width: item.width || '',
      height: item.height || '',
      quantity: item.quantity,
      notes: item.notes || '',
    });
    setEditingItemId(item.id);
  };

  const handleSaveItem = () => {
    if (editingItemId) {
      updateItemMutation.mutate({
        id: editingItemId,
        data: itemFormData,
      });
    }
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    resetItemForm();
  };

  const resetItemForm = () => {
    setItemFormData({
      quotation_item_id: '',
      room_name: '',
      piece_number: '',
      width: '',
      height: '',
      quantity: 1,
      notes: '',
    });
  };

  if (isLoadingMeasurement) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!measurement) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">{t('errors.notFound')}</p>
      </div>
    );
  }

  const measurementItems = items || [];
  const quotationItems = quotationItemsData?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('measurements.measurement')} #{measurement.measurement_number}
            </h1>
            <p className="text-sm text-gray-600">
              {measurement.visit_date ? formatDate(measurement.visit_date) : t('jobs.notSet')}
            </p>
          </div>
        </div>
      </div>

      {/* Measurement Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('measurements.measurementDetails')}</h2>
          {!isEditingMeasurement ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditMeasurement}
              className="flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              {t('common.edit')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditMeasurement}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveMeasurement}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('measurements.visitDate')}
            </label>
            {isEditingMeasurement ? (
              <Input
                type="date"
                value={measurementData.visit_date}
                onChange={(e) => setMeasurementData(prev => ({ ...prev, visit_date: e.target.value }))}
              />
            ) : (
              <p className="text-gray-900">
                {measurement.visit_date ? formatDate(measurement.visit_date) : '-'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('measurements.measuredBy')}
            </label>
            {isEditingMeasurement ? (
              <Input
                type="text"
                value={measurementData.measured_by}
                onChange={(e) => setMeasurementData(prev => ({ ...prev, measured_by: e.target.value }))}
                placeholder={t('measurements.measuredBy')}
              />
            ) : (
              <p className="text-gray-900">{measurement.measured_by || '-'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('measurements.notes')}
            </label>
            {isEditingMeasurement ? (
              <Input
                type="text"
                value={measurementData.notes}
                onChange={(e) => setMeasurementData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('measurements.notes')}
              />
            ) : (
              <p className="text-gray-900">{measurement.notes || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Measurement Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('measurements.items')}</h2>
            <Button
              onClick={() => setIsAddItemModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('measurements.addItem')}
            </Button>
          </div>
        </div>

        {isLoadingItems ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
          </div>
        ) : measurementItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">{t('measurements.noItems')}</p>
            <Button onClick={() => setIsAddItemModalOpen(true)}>
              {t('measurements.addFirstItem')}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('measurements.roomName')}</TableHeaderCell>
                  <TableHeaderCell>{t('measurements.pieceNumber')}</TableHeaderCell>
                  <TableHeaderCell>{t('measurements.width')} ({t('measurements.cm')})</TableHeaderCell>
                  <TableHeaderCell>{t('measurements.height')} ({t('measurements.cm')})</TableHeaderCell>
                  <TableHeaderCell>{t('measurements.quantity')}</TableHeaderCell>
                  <TableHeaderCell>{t('measurements.notes')}</TableHeaderCell>
                  <TableHeaderCell>{t('common.actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {measurementItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <Input
                          type="text"
                          value={itemFormData.room_name}
                          onChange={(e) => setItemFormData(prev => ({ ...prev, room_name: e.target.value }))}
                          className="w-full"
                        />
                      ) : (
                        item.room_name || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <Input
                          type="text"
                          value={itemFormData.piece_number}
                          onChange={(e) => setItemFormData(prev => ({ ...prev, piece_number: e.target.value }))}
                          className="w-full"
                        />
                      ) : (
                        item.piece_number || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={itemFormData.width}
                          onChange={(e) => setItemFormData(prev => ({ ...prev, width: e.target.value }))}
                          className="w-24"
                        />
                      ) : (
                        item.width || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={itemFormData.height}
                          onChange={(e) => setItemFormData(prev => ({ ...prev, height: e.target.value }))}
                          className="w-24"
                        />
                      ) : (
                        item.height || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <Input
                          type="number"
                          min="1"
                          value={itemFormData.quantity}
                          onChange={(e) => setItemFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                          className="w-20"
                        />
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <Input
                          type="text"
                          value={itemFormData.notes}
                          onChange={(e) => setItemFormData(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full"
                        />
                      ) : (
                        item.notes || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveItem}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEditItem}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditItem(item)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          resetItemForm();
        }}
        title={t('measurements.addItem')}
        size="lg"
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('measurements.quotationItem')} *
            </label>
            <Select
              value={itemFormData.quotation_item_id}
              onChange={(value) => setItemFormData(prev => ({ ...prev, quotation_item_id: value }))}
              required
            >
              <option value="">{t('measurements.selectQuotationItem')}</option>
              {quotationItems.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.description || `${t('quotations.item')} #${item.id.slice(0, 8)}`}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('measurements.roomName')}
              </label>
              <Input
                type="text"
                value={itemFormData.room_name}
                onChange={(e) => setItemFormData(prev => ({ ...prev, room_name: e.target.value }))}
                placeholder={t('measurements.roomName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('measurements.pieceNumber')}
              </label>
              <Input
                type="text"
                value={itemFormData.piece_number}
                onChange={(e) => setItemFormData(prev => ({ ...prev, piece_number: e.target.value }))}
                placeholder={t('measurements.pieceNumber')}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('measurements.width')} ({t('measurements.cm')})
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={itemFormData.width}
                onChange={(e) => setItemFormData(prev => ({ ...prev, width: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('measurements.height')} ({t('measurements.cm')})
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={itemFormData.height}
                onChange={(e) => setItemFormData(prev => ({ ...prev, height: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('measurements.quantity')} *
              </label>
              <Input
                type="number"
                min="1"
                value={itemFormData.quantity}
                onChange={(e) => setItemFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('measurements.notes')}
            </label>
            <textarea
              value={itemFormData.notes}
              onChange={(e) => setItemFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder={t('measurements.notes')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddItemModalOpen(false);
                resetItemForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
