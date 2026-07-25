import api from '../lib/api';
import type { Payment, PaginatedResponse } from '../types';

export const paymentsApi = {
  getJobPayments: async (jobId: string, params?: {
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const { data } = await api.get<PaginatedResponse<Payment>>(`/jobs/${jobId}/payments`, { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<Payment>(`/payments/${id}`);
    return data;
  },

  create: async (jobId: string, payment: {
    payment_type: string;
    payment_method: string;
    percentage: number;
    amount: number;
    due_date?: string;
    paid_date?: string;
    notes?: string;
  }) => {
    const { data } = await api.post<Payment>(`/jobs/${jobId}/payments`, payment);
    return data;
  },

  update: async (id: string, payment: Partial<Payment>) => {
    const { data } = await api.put<Payment>(`/payments/${id}`, payment);
    return data;
  },

  updateStatus: async (id: string, status: string) => {
    const { data } = await api.patch<Payment>(`/payments/${id}/status`, { status });
    return data;
  },
};
