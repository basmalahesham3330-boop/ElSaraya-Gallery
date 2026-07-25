import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, Edit } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { customersApi } from '../services/customers';
import { formatPhoneNumber } from '../utils';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';
import Badge from '../components/Badge';
import type { Customer } from '../types/index';

export default function Customers() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    city: '',
    address: '',
    notes: '',
  });

  // Fetch customers with filters
  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', searchTerm, cityFilter],
    queryFn: () => customersApi.getAll({
      name: searchTerm || undefined,
      city: cityFilter || undefined,
      limit: 20,
    }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      toast.success(t('success.created'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || t('errors.generic'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) => 
      customersApi.update(id, data),
    onSuccess: () => {
      toast.success(t('success.updated'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || t('errors.generic'));
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone_number: '',
      city: '',
      address: '',
      notes: '',
    });
    setSelectedCustomer(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer) {
      updateMutation.mutate({
        id: selectedCustomer.id,
        data: formData,
      });
    }
  };

  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      full_name: customer.full_name,
      phone_number: customer.phone_number,
      city: customer.city || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const customers = data?.items || [];
  const isLoadingMutation = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('customers.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('customers.subtitle')}</p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('customers.addCustomer')}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.search')}
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('customers.fullName')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('customers.city')}
            </label>
            <Input
              type="text"
              placeholder={t('customers.city')}
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" text={t('common.loading')} />
        </div>
      )}

      {/* Error State */}
      {isError && !isLoading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('errors.generic')}</h3>
          <p className="text-gray-600">{t('errors.networkError')}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && customers.length === 0 && (
        <div className="bg-white rounded-lg shadow">
          <EmptyState
            title={t('common.noResults')}
            description={searchTerm || cityFilter ? t('common.noResults') : t('customers.comingSoon')}
            action={
              <Button onClick={() => setIsCreateModalOpen(true)}>
                {t('customers.addCustomer')}
              </Button>
            }
          />
        </div>
      )}

      {/* Customers Table */}
      {!isLoading && !isError && customers.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('customers.fullName')}</TableHeaderCell>
                <TableHeaderCell>{t('customers.phoneNumber')}</TableHeaderCell>
                <TableHeaderCell>{t('customers.city')}</TableHeaderCell>
                <TableHeaderCell>{t('customers.createdAt')}</TableHeaderCell>
                <TableHeaderCell>{t('common.actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{customer.full_name}</div>
                      {customer.address && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {customer.address}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-gray-900">{formatPhoneNumber(customer.phone_number)}</div>
                  </TableCell>
                  <TableCell>
                    {customer.city ? (
                      <Badge variant="info" size="sm">
                        {customer.city}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString('ar-EG')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(customer)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {t('common.showing')} {customers.length} {t('common.of')} {data.total} {t('common.results')}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={data.offset === 0}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={data.offset + customers.length >= data.total}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title={t('customers.addCustomer')}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('customers.fullName')}
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
                dir="rtl"
              />
              <Input
                label={t('customers.phoneNumber')}
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
                required
                dir="ltr"
                type="tel"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('customers.city')}
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                dir="rtl"
              />
              <Input
                label={t('customers.address')}
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('customers.notes')}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] text-right"
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-gray-200">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}
              disabled={isLoadingMutation}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={isLoadingMutation}
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title={t('customers.editCustomer')}
        size="lg"
      >
        <form onSubmit={handleEditSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('customers.fullName')}
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
                dir="rtl"
              />
              <Input
                label={t('customers.phoneNumber')}
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
                required
                dir="ltr"
                type="tel"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('customers.city')}
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                dir="rtl"
              />
              <Input
                label={t('customers.address')}
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('customers.notes')}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] text-right"
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-gray-200">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                resetForm();
              }}
              disabled={isLoadingMutation}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={updateMutation.isPending}
              disabled={isLoadingMutation}
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
