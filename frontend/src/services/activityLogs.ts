import api from '../lib/api';
import type { ActivityLog, PaginatedResponse } from '../types';

export const activityLogsApi = {
  /**
   * Get activity logs for a specific job with optional limit
   */
  getByJobId: async (jobId: string, limit?: number): Promise<ActivityLog[]> => {
    const params: { job_id: string; limit?: number } = { job_id: jobId };
    if (limit) {
      params.limit = limit;
    }
    
    const { data } = await api.get<PaginatedResponse<ActivityLog>>('/activity-logs', { params });
    return data.items || [];
  },

  /**
   * Get all activity logs (admin view)
   */
  getAll: async (params?: { limit?: number; offset?: number }): Promise<{ items: ActivityLog[]; total: number }> => {
    const { data } = await api.get<PaginatedResponse<ActivityLog>>('/activity-logs', { params });
    return data;
  },
};
