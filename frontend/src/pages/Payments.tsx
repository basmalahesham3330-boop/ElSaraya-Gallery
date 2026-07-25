import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, DollarSign, Plus } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { jobsApi } from '../services/jobs';
import { paymentsApi } from '../services/payments';
import { quotationsApi } from '../services/quotations';
import { customersApi } from '../services/customers';
import { formatDate, formatCurrency } from '../utils/formatters';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import type { Payment, PaymentStatus, PaymentType, PaymentMethod } from '../types';

export default function Payments() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('deposit');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [percentage, setPercentage] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Fetch all jobs to get payments
  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobsApi.getAll({ limit: 200 }),
  });

  // Fetch quotations
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations', 'all'],
    queryFn: () => quotationsApi.getAll({ limit: 200 }),
  });

  // Fetch customers
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll({ limit: 200 }),
  });

  // Fetch payments for each job
  const jobs = jobsData?.items || [];
  const quotations = quotationsData?.items || [];
  const customers = customersData?.items || [];

  // Fetch all payments from all jobs
  const paymentQueries = useQuery({
    queryKey: ['allPayments', jobs.map(j => j.id).join(',')],
    queryFn: async () => {
      const allPayments: Payment[] = [];
      for (const job of jobs) {
        const paymentsData = await paymentsApi.getJobPayments(job.id, { limit: 100 });
        allPayments.push(...paymentsData.items);
      }
      return allPayments;
    },
    enabled: jobs.length > 0,
  });

  const payments = paymentQueries.data || [];
  const isLoading = paymentQueries.isLoading;

  // Helper to get job details
  const getJobDetails = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { jobNumber: '-', quotationNumber: '-', customerName: '-' };
    
    const quotation = quotations.find(q => q.id === job.quotation_id);
    const customer = quotation ? customers.find(c => c.id === quotation.customer_id) : null;
    
    return {
      jobNumber: job.id.substring(0, 8),
      quotationNumber: quotation?.quotation_number || '-',
      customerName: customer?.full_name || '-',
    };
  };

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const { quotationNumber, customerName } = getJobDetails(payment.job_id);
    
    // Status filter
    if (statusFilter && payment.status !== statusFilter) return false;
    
    // Type filter
    if (typeFilter && payment.payment_type !== typeFilter) return false;
    
    // Method filter
    if (methodFilter && payment.payment_method !== methodFilter) return false;
    
    // Search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        quotationNumber.toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower) ||
        payment.payment_order.toString().includes(searchLower)
      );
    }
    
    return true;
  });

  // Sort by payment order and date
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    // First by job, then by payment_order
    if (a.job_id === b.job_id) {
      return a.payment_order - b.payment_order;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleRowClick = (payment: Payment) => {
    // Navigate to job details
    navigate(`/jobs/${payment.job_id}`);
  };

  const paymentStatuses: PaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];
  const paymentTypes: PaymentType[] = ['deposit', 'production', 'final'];
  const paymentMethods: PaymentMethod[] = ['cash', 'bank_transfer', 'instapay', 'cheque', 'other'];

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) return;

    try {
      // Get the job to determine payment order
      const jobPayments = await paymentsApi.getJobPayments(selectedJobId, { limit: 100 });
      const paymentOrder = jobPayments.items.length + 1;

      await paymentsApi.create(selectedJobId, {
        payment_type: paymentType,
        payment_method: paymentMethod,
        percentage: parseFloat(percentage) || 0,
        amount: parseFloat(amount) || 0,
        due_date: dueDate || undefined,
        notes: paymentNotes || undefined,
      });

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      // Reset form and close modal
      setIsAddPaymentModalOpen(false);
      setSelectedJobId('');
      setPaymentType('deposit');
      setPaymentMethod('cash');
      setPercentage('');
      setAmount('');
      setDueDate('');
      setPaymentNotes('');
    } catch (error) {
      console.error('Failed to create payment:', error);
    }
  };

  // Calculate summary stats
  const totalPaid = filteredPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  const totalPending = filteredPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  const totalOverdue = filteredPayments
    .filter(p => p.status === 'overdue')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('payments.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('payments.subtitle')}</p>
        </div>
        <Button
          onClick={() => setIsAddPaymentModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('payments.addPayment')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.totalPaid')}</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.totalPending')}</p>
              <p className="text-2xl font-bold text-gray-600">{formatCurrency(totalPending)}</p>
            </div>
            <DollarSign className="w-10 h-10 text-gray-400 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.totalOverdue')}</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
            </div>
            <DollarSign className="w-10 h-10 text-red-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.totalPayments')}</p>
              <p className="text-2xl font-bold text-blue-600">{filteredPayments.length}</p>
            </div>
            <DollarSign className="w-10 h-10 text-blue-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.search')}
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('payments.searchPayments')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.status')}
            </label>
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
            >
              <option value="">{t('payments.allStatuses')}</option>
              {paymentStatuses.map(status => (
                <option key={status} value={status}>
                  {t(`paymentStatus.${status}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.paymentType')}
            </label>
            <Select
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
            >
              <option value="">{t('payments.allTypes')}</option>
              {paymentTypes.map(type => (
                <option key={type} value={type}>
                  {t(`paymentType.${type}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.paymentMethod')}
            </label>
            <Select
              value={methodFilter}
              onChange={(value) => setMethodFilter(value)}
            >
              <option value="">{t('payments.allMethods')}</option>
              {paymentMethods.map(method => (
                <option key={method} value={method}>
                  {t(`paymentMethod.${method}`)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => paymentQueries.refetch()}
              className="flex items-center gap-2 w-full"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.refresh')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : sortedPayments.length === 0 ? (
          <EmptyState
            title={t('payments.noPaymentsFound')}
            description={t('payments.noPaymentsDescription')}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('payments.paymentOrder')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.quotationNumber')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.customer')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.paymentType')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.paymentMethod')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.percentage')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.amount')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.dueDate')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.paidDate')}</TableHeaderCell>
                  <TableHeaderCell>{t('payments.status')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPayments.map((payment) => {
                  const { quotationNumber, customerName } = getJobDetails(payment.job_id);
                  const isOverdue = payment.status === 'overdue' || 
                    (payment.status === 'pending' && payment.due_date && 
                     new Date(payment.due_date) < new Date());
                  
                  return (
                    <TableRow
                      key={payment.id}
                      onClick={() => handleRowClick(payment)}
                      className={`cursor-pointer hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}
                    >
                      <TableCell className="font-medium">#{payment.payment_order}</TableCell>
                      <TableCell>{quotationNumber}</TableCell>
                      <TableCell>{customerName}</TableCell>
                      <TableCell>{t(`paymentType.${payment.payment_type}`)}</TableCell>
                      <TableCell>{t(`paymentMethod.${payment.payment_method}`)}</TableCell>
                      <TableCell>{payment.percentage}%</TableCell>
                      <TableCell className="font-medium">{formatCurrency(parseFloat(payment.amount))}</TableCell>
                      <TableCell>
                        {payment.due_date ? (
                          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                            {formatDate(payment.due_date)}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {payment.paid_date ? formatDate(payment.paid_date) : '-'}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      <Modal
        isOpen={isAddPaymentModalOpen}
        onClose={() => setIsAddPaymentModalOpen(false)}
        title={t('payments.addPayment')}
      >
        <form onSubmit={handleAddPayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.projectNumber')} *
            </label>
            <Select
              value={selectedJobId}
              onChange={(value) => setSelectedJobId(value)}
              required
            >
              <option value="">{t('projects.selectProject')}</option>
              {jobs.map(job => {
                const { quotationNumber, customerName } = getJobDetails(job.id);
                const jobNumber = job.id.substring(0, 8).toUpperCase();
                return (
                  <option key={job.id} value={job.id}>
                    PROJECT-{jobNumber} - {customerName} - {quotationNumber}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.paymentType')} *
              </label>
              <Select
                value={paymentType}
                onChange={(value) => setPaymentType(value as PaymentType)}
                required
              >
                {paymentTypes.map(type => (
                  <option key={type} value={type}>
                    {t(`paymentType.${type}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.paymentMethod')} *
              </label>
              <Select
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                required
              >
                {paymentMethods.map(method => (
                  <option key={method} value={method}>
                    {t(`paymentMethod.${method}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.percentage')} *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.amount')} *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.dueDate')}
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.notes')}
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddPaymentModalOpen(false)}
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
