import api from '../lib/api';
import type { Product, ProductCategory, PaginatedResponse } from '../types';

export const productsApi = {
  getAll: async (params?: {
    limit?: number;
    offset?: number;
    category_id?: string;
    active?: boolean;
    name?: string;
  }) => {
    // Backend expects 'category' not 'category_id'
    const backendParams = params ? {
      ...params,
      category: params.category_id,
      category_id: undefined,
    } : undefined;
    const { data } = await api.get<PaginatedResponse<Product>>('/products', { params: backendParams });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  create: async (product: Partial<Product>) => {
    const { data } = await api.post<Product>('/products', product);
    return data;
  },

  update: async (id: string, product: Partial<Product>) => {
    const { data } = await api.put<Product>(`/products/${id}`, product);
    return data;
  },

  // Note: Backend does not support DELETE
  delete: async (_id: string) => {
    throw new Error('Deleting products is not supported by the backend');
  },
};

export const categoriesApi = {
  getAll: async (params?: {
    limit?: number;
    offset?: number;
    name?: string;
  }) => {
    const { data } = await api.get<PaginatedResponse<ProductCategory>>('/product-categories', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ProductCategory>(`/product-categories/${id}`);
    return data;
  },

  create: async (category: Partial<ProductCategory>) => {
    const { data } = await api.post<ProductCategory>('/product-categories', category);
    return data;
  },

  // Note: Backend does not support UPDATE for categories
  update: async (_id: string, _category: Partial<ProductCategory>) => {
    throw new Error('Updating product categories is not supported by the backend');
  },

  // Note: Backend does not support DELETE for categories
  delete: async (_id: string) => {
    throw new Error('Deleting product categories is not supported by the backend');
  },
};
