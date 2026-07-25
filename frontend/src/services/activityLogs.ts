import type { ActivityLog } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const activityLogsApi = {
  /**
   * Get activity logs for a specific job with optional limit
   */
  getByJobId: async (jobId: string, limit?: number): Promise<ActivityLog[]> => {
    const params = new URLSearchParams({ job_id: jobId });
    if (limit) {
      params.append('limit', limit.toString());
    }
    
    const response = await fetch(`${API_BASE_URL}/api/v1/activity-logs?${params}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch activity logs');
    }

    const data = await response.json();
    return data.items || data || [];
  },

  /**
   * Get all activity logs (admin view)
   */
  getAll: async (params?: { limit?: number; offset?: number }): Promise<{ items: ActivityLog[]; total: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetch(`${API_BASE_URL}/api/v1/activity-logs?${queryParams}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch activity logs');
    }

    return response.json();
  },
};
