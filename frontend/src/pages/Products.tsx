import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, Edit, Check, X } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { productsApi, categoriesApi } from '../services/products';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';
import Badge from '../components/Badge';
import type { Product } from '../types/index';

export default function Products() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    active: true,
  });
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });

  // Fetch products with filters
  const { data: productsData, isLoading: isLoadingProducts, isError: isProductsError } = useQuery({
    queryKey: ['products', searchTerm, categoryFilter, statusFilter],
    queryFn: () => productsApi.getAll({
      name: searchTerm || undefined,
      category_id: categoryFilter || undefined,
      active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      limit: 20,
    }),
  });

  // Fetch categories for filter dropdown
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll({ limit: 100 }),
  });

  // Create product mutation
  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      toast.success(t('success.created'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || t('errors.generic'));
    },
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => 
      productsApi.update(id, data),
    onSuccess: () => {
      toast.success(t('success.updated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || t('errors.generic'));
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      toast.success(t('success.created'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryModalOpen(false);
      setCategoryFormData({ name: '', description: '' });
    },
    onError: (error) => {
      toast.error(error.message || t('errors.generic'));
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category_id: '',
      description: '',
      active: true,
    });
    setSelectedProduct(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProduct) {
      updateMutation.mutate({
        id: selectedProduct.id,
        data: formData,
      });
    }
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCategoryMutation.mutate(categoryFormData);
  };

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category_id: product.category_id,
      description: product.description || '',
      active: product.active,
    });
    setIsEditModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCategoryFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getCategoryName = (categoryId: string) => {
    const category = categoriesData?.items.find(c => c.id === categoryId);
    return category ? category.name : t('products.noCategory');
  };

  const products = productsData?.items || [];
  const categories = categoriesData?.items || [];
  const isLoadingMutation = createMutation.isPending || updateMutation.isPending || createCategoryMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('products.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('products.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('productCategories.addCategory')}
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('products.addProduct')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.search')}
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('products.searchProducts')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.category')}
            </label>
            <Select
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value)}
              options={[
                { value: '', label: t('common.all') },
                ...categories.map(category => ({ 
                  value: category.id, 
                  label: category.name 
                }))
              ]}
              placeholder={t('common.all')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.status')}
            </label>
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: 'all', label: t('common.all') },
                { value: 'active', label: t('products.active') },
                { value: 'inactive', label: t('products.inactive') },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {(isLoadingProducts || isLoadingCategories) && (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" text={t('common.loading')} />
        </div>
      )}

      {/* Error State */}
      {isProductsError && !isLoadingProducts && (
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
      {!isLoadingProducts && !isProductsError && products.length === 0 && (
        <div className="bg-white rounded-lg shadow">
          <EmptyState
            title={t('common.noResults')}
            description={searchTerm || categoryFilter || statusFilter !== 'all' ? t('common.noResults') : t('products.comingSoon')}
            action={
              <Button onClick={() => setIsCreateModalOpen(true)}>
                {t('products.addProduct')}
              </Button>
            }
          />
        </div>
      )}

      {/* Products Table */}
      {!isLoadingProducts && !isProductsError && products.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('products.productName')}</TableHeaderCell>
                <TableHeaderCell>{t('products.category')}</TableHeaderCell>
                <TableHeaderCell>{t('products.description')}</TableHeaderCell>
                <TableHeaderCell>{t('products.status')}</TableHeaderCell>
                <TableHeaderCell>{t('common.createdAt')}</TableHeaderCell>
                <TableHeaderCell>{t('common.actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{product.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="info" size="sm">
                      {getCategoryName(product.category_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {product.description ? (
                      <div className="text-gray-600 line-clamp-2 max-w-md">
                        {product.description}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.active ? (
                      <Badge variant="success" className="flex items-center gap-1 w-fit">
                        <Check className="w-3 h-3" />
                        {t('products.active')}
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="flex items-center gap-1 w-fit">
                        <X className="w-3 h-3" />
                        {t('products.inactive')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {new Date(product.created_at).toLocaleDateString('ar-EG')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(product)}
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
          {productsData && productsData.total > 20 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {t('common.showing')} {products.length} {t('common.of')} {productsData.total} {t('common.results')}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={productsData.offset === 0}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={productsData.offset + products.length >= productsData.total}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Product Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title={t('products.addProduct')}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="space-y-4">
            <Input
              label={t('products.productName')}
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              dir="rtl"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('products.category')}
                <span className="text-red-500 mr-1">*</span>
              </label>
              <Select
                value={formData.category_id}
                onChange={(value) => handleSelectChange('category_id', value)}
                options={categories.map(category => ({ 
                  value: category.id, 
                  label: category.name 
                }))}
                placeholder={t('products.selectCategory')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('products.description')}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] text-right"
                dir="rtl"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleSelectChange('active', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t('products.active')}</span>
              </label>
              <p className="mt-1 text-sm text-gray-500">
                {t('products.active')}: {t('products.active')}، {t('products.inactive')}: {t('products.inactive')}
              </p>
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

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title={t('products.editProduct')}
        size="lg"
      >
        <form onSubmit={handleEditSubmit}>
          <div className="space-y-4">
            <Input
              label={t('products.productName')}
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              dir="rtl"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('products.category')}
                <span className="text-red-500 mr-1">*</span>
              </label>
              <Select
                value={formData.category_id}
                onChange={(value) => handleSelectChange('category_id', value)}
                options={categories.map(category => ({ 
                  value: category.id, 
                  label: category.name 
                }))}
                placeholder={t('products.selectCategory')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('products.description')}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] text-right"
                dir="rtl"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleSelectChange('active', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t('products.active')}</span>
              </label>
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

      {/* Add Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCategoryFormData({ name: '', description: '' });
        }}
        title={t('productCategories.addCategory')}
        size="md"
      >
        <form onSubmit={handleCategorySubmit}>
          <div className="space-y-4">
            <Input
              label={t('productCategories.categoryName')}
              name="name"
              value={categoryFormData.name}
              onChange={handleCategoryInputChange}
              required
              dir="rtl"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('productCategories.categoryDescription')}
              </label>
              <textarea
                name="description"
                value={categoryFormData.description}
                onChange={handleCategoryInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px] text-right"
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-gray-200">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsCategoryModalOpen(false);
                setCategoryFormData({ name: '', description: '' });
              }}
              disabled={isLoadingMutation}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={createCategoryMutation.isPending}
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
