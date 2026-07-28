import api from '../lib/api';
import type { Quotation, QuotationItem, QuotationStatus, QuotationWithJobResponse, PaginatedResponse } from '../types';

export const quotationsApi = {
  getAll: async (params?: {
    limit?: number;
    offset?: number;
    status?: QuotationStatus;
    customer?: string; // UUID
    date_from?: string;
    date_to?: string;
  }) => {
    const { data } = await api.get<PaginatedResponse<Quotation>>('/quotations', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<Quotation>(`/quotations/${id}`);
    return data;
  },

  create: async (quotation: Partial<Quotation>) => {
    const { data } = await api.post<Quotation>('/quotations', quotation);
    return data;
  },

  update: async (id: string, quotation: Partial<Quotation>) => {
    const { data } = await api.put<Quotation>(`/quotations/${id}`, quotation);
    return data;
  },

  updateStatus: async (id: string, status: QuotationStatus) => {
    const { data } = await api.patch<QuotationWithJobResponse>(`/quotations/${id}/status`, { status });
    return data;
  },

  getItems: async (quotationId: string) => {
    const { data } = await api.get<{ items: QuotationItem[]; total: number }>(
      `/quotations/${quotationId}/items`
    );
    return data;
  },

  addItem: async (quotationId: string, item: Partial<QuotationItem>) => {
    const { data } = await api.post<QuotationItem>(
      `/quotations/${quotationId}/items`,
      item
    );
    return data;
  },

  updateItem: async (itemId: string, item: Partial<QuotationItem>) => {
    const { data } = await api.put<QuotationItem>(
      `/quotation-items/${itemId}`,
      item
    );
    return data;
  },

  // Note: Backend does not support DELETE for quotation items
  deleteItem: async (_itemId: string) => {
    throw new Error('Deleting quotation items is not supported by the backend');
  },
};
