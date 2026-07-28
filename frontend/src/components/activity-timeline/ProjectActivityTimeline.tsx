import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown } from 'lucide-react';
import type { Job } from '../../types';
import type { EnhancedActivityLog } from '../../types/activityLog';
import { activityLogsApi } from '../../services/activityLogs';
import { groupEventsByDate, getEventCategory } from '../../utils/activityLogUtils';
import LoadingSpinner from '../LoadingSpinner';
import TimelineCard from './TimelineCard';
import TimelineSearch from './TimelineSearch';
import TimelineFilters from './TimelineFilters';
import TimelineGroup from './TimelineGroup';
import TimelineStatistics from './TimelineStatistics';
import TimelineEmptyState from './TimelineEmptyState';

interface ProjectActivityTimelineProps {
  job: Job;
  onNavigateToSection?: (section: string) => void;
}

export default function ProjectActivityTimeline({ job, onNavigateToSection }: ProjectActivityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOlderEvents, setShowOlderEvents] = useState(false);

  // Fetch activity logs with limit - only recent 20 events initially
  const [limit, setLimit] = useState(20);
  const { data: events = [], isLoading, error } = useQuery<EnhancedActivityLog[]>({
    queryKey: ['activity-logs', job.id, limit],
    queryFn: async () => {
      const logs = await activityLogsApi.getByJobId(job.id, limit);
      // Cast to EnhancedActivityLog - backend may not have all fields yet
      return logs as EnhancedActivityLog[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - activity logs are historical
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection time
  });

  const handleLoadMore = useCallback(() => {
    setLimit(prev => prev + 20);
  }, []);

  // Filter and search events
  const filteredEvents = useMemo(() => {
    let filtered: EnhancedActivityLog[] = [...events];

    // Apply category filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(event => {
        const category = getEventCategory(event.action);
        return category === activeFilter;
      });
    }

    // Apply search (enhanced to include user_name and metadata)
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(event => {
        // Search in description and action
        if (event.description?.toLowerCase().includes(lowerQuery)) return true;
        if (event.action.toLowerCase().includes(lowerQuery)) return true;
        if (event.created_at.includes(searchQuery)) return true;
        
        // Search in user name
        if (event.user_name?.toLowerCase().includes(lowerQuery)) return true;
        
        // Search in metadata
        if (event.metadata) {
          const metadataStr = JSON.stringify(event.metadata).toLowerCase();
          if (metadataStr.includes(lowerQuery)) return true;
        }
        
        // Search in previous/new values
        if (event.previous_value?.toLowerCase().includes(lowerQuery)) return true;
        if (event.new_value?.toLowerCase().includes(lowerQuery)) return true;
        
        return false;
      });
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return filtered;
  }, [events, activeFilter, searchQuery]);

  // Group events by date using utility function
  const groupedEvents = useMemo(() => {
    return groupEventsByDate(filteredEvents);
  }, [filteredEvents]);

  // Calculate event counts by category
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: events.length,
      workflow: 0,
      payments: 0,
      measurements: 0,
      quotation: 0,
      notes: 0,
      documents: 0,
      other: 0,
    };

    events.forEach(event => {
      const category = getEventCategory(event.action);
      if (category in counts) {
        counts[category]++;
      }
    });

    return counts;
  }, [events]);

  // Calculate days since last activity
  const daysSinceLastActivity = useMemo(() => {
    if (events.length === 0) return undefined;
    const lastEvent = events.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    return Math.floor((new Date().getTime() - new Date(lastEvent.created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [events]);

  const handleClearFilters = useCallback(() => {
    setActiveFilter('all');
    setSearchQuery('');
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          فشل تحميل السجل
        </h3>
        <p className="text-sm text-gray-600 text-center">
          {error instanceof Error ? error.message : 'حدث خطأ غير متوقع'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <TimelineStatistics 
        events={events} 
        projectCreatedAt={job.created_at} 
      />

      {/* Search & Filters */}
      <div className="space-y-3">
        <TimelineSearch 
          value={searchQuery}
          onChange={setSearchQuery}
        />
        
        <TimelineFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          eventCounts={eventCounts}
        />
      </div>

      {/* Events Timeline */}
      {filteredEvents.length === 0 ? (
        <TimelineEmptyState
          hasFilters={activeFilter !== 'all'}
          searchQuery={searchQuery}
          onClearFilters={handleClearFilters}
          daysSinceLastActivity={daysSinceLastActivity}
        />
      ) : (
        <div className="space-y-6">
          {/* Today */}
          {groupedEvents.today.length > 0 && (
            <TimelineGroup title="اليوم">
              {groupedEvents.today.map((event, index) => (
                <TimelineCard
                  key={event.id}
                  event={event}
                  onNavigate={onNavigateToSection}
                  isLatest={index === 0}
                />
              ))}
            </TimelineGroup>
          )}

          {/* Yesterday */}
          {groupedEvents.yesterday.length > 0 && (
            <TimelineGroup title="أمس">
              {groupedEvents.yesterday.map(event => (
                <TimelineCard
                  key={event.id}
                  event={event}
                  onNavigate={onNavigateToSection}
                />
              ))}
            </TimelineGroup>
          )}

          {/* Last Week */}
          {groupedEvents.lastWeek.length > 0 && (
            <TimelineGroup title="الأسبوع الماضي">
              {groupedEvents.lastWeek.map(event => (
                <TimelineCard
                  key={event.id}
                  event={event}
                  onNavigate={onNavigateToSection}
                />
              ))}
            </TimelineGroup>
          )}

          {/* Older */}
          {groupedEvents.older.length > 0 && (
            <TimelineGroup title="أقدم">
              {(showOlderEvents ? groupedEvents.older : groupedEvents.older.slice(0, 5)).map(event => (
                <TimelineCard
                  key={event.id}
                  event={event}
                  onNavigate={onNavigateToSection}
                />
              ))}
              
              {/* Show More Button */}
              {!showOlderEvents && groupedEvents.older.length > 5 && (
                <button
                  onClick={() => setShowOlderEvents(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span>عرض أحداث أقدم ({groupedEvents.older.length - 5})</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </TimelineGroup>
          )}
        </div>
      )}

      {/* Load More Button at bottom */}
      {filteredEvents.length >= limit && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            className="px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            تحميل المزيد من الأحداث
          </button>
        </div>
      )}
    </div>
  );
}

