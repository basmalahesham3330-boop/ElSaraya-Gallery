import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '../services/jobs';
import { quotationsApi } from '../services/quotations';
import { customersApi } from '../services/customers';
import { paymentsApi } from '../services/payments';
import type { Job, Quotation, Customer, Payment } from '../types';

export interface EnrichedProject {
  job: Job;
  quotation: Quotation;
  customer: Customer;
  payments: Payment[];
}

export function useProjectsData() {
  // Fetch all data in parallel
  const { data: jobsData, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.getAll({ limit: 100, sort_by: 'created_at', sort_order: 'desc' }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: quotationsData, isLoading: isLoadingQuotations } = useQuery({
    queryKey: ['quotations', 'all'],
    queryFn: () => quotationsApi.getAll({ limit: 200 }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll({ limit: 200 }),
    staleTime: 5 * 60 * 1000, // 5 minutes - customers change less frequently
  });

  const jobs = jobsData?.items || [];
  const quotations = quotationsData?.items || [];
  const customers = customersData?.items || [];

  // Fetch payments for each job (we'll aggregate this)
  // For now, we'll fetch payments on-demand per job when needed
  // This is acceptable for Step 1 as we're focusing on architecture

  // Enrich jobs with quotation and customer data
  const projects = useMemo(() => {
    const enrichedProjects: EnrichedProject[] = [];
    
    for (const job of jobs) {
      const quotation = quotations.find(q => q.id === job.quotation_id);
      if (!quotation) continue;

      const customer = customers.find(c => c.id === quotation.customer_id);
      if (!customer) continue;

      enrichedProjects.push({
        job,
        quotation,
        customer,
        payments: [], // Will be populated when card is expanded or details viewed
      });
    }
    
    return enrichedProjects;
  }, [jobs, quotations, customers]);

  const isLoading = isLoadingJobs || isLoadingQuotations || isLoadingCustomers;

  return {
    projects,
    isLoading,
    jobs,
    quotations,
    customers,
  };
}

// Hook to fetch payments for a specific job
export function useJobPayments(jobId: string | null) {
  return useQuery({
    queryKey: ['payments', 'job', jobId],
    queryFn: () => paymentsApi.getJobPayments(jobId!, { limit: 100 }),
    enabled: !!jobId,
  });
}
