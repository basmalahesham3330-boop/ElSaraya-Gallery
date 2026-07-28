/**
 * Activity Log Utility Functions
 * 
 * Centralized utilities for processing, formatting, and displaying activity logs
 */

import type { EnhancedActivityLog, ChangeMetadata, EventCategory } from '../types/activityLog';
import { formatCurrency, formatDate } from './formatters';

/**
 * Parse change metadata from activity log
 * Handles both simple description and structured metadata
 */
export function parseChangeMetadata(log: EnhancedActivityLog): ChangeMetadata[] {
  const changes: ChangeMetadata[] = [];
  
  // If we have structured previous/new values
  if (log.previous_value && log.new_value) {
    try {
      const prevData = typeof log.previous_value === 'string' 
        ? JSON.parse(log.previous_value) 
        : log.previous_value;
      const newData = typeof log.new_value === 'string'
        ? JSON.parse(log.new_value)
        : log.new_value;
      
      // If both are objects, compare fields
      if (typeof prevData === 'object' && typeof newData === 'object') {
        Object.keys(newData).forEach(key => {
          if (prevData[key] !== newData[key]) {
            changes.push({
              field: key,
              previousValue: String(prevData[key] || '-'),
              newValue: String(newData[key] || '-'),
              displayType: detectDisplayType(key, newData[key]),
            });
          }
        });
      } else {
        // Simple value change
        changes.push({
          field: 'value',
          previousValue: String(prevData),
          newValue: String(newData),
          displayType: 'text',
        });
      }
    } catch (e) {
      // Fallback: treat as strings
      changes.push({
        field: 'value',
        previousValue: log.previous_value,
        newValue: log.new_value,
        displayType: 'text',
      });
    }
  }
  
  // Parse from description if no structured data (backwards compatibility)
  if (changes.length === 0 && log.description) {
    const parsedChanges = parseDescriptionForChanges(log.description);
    changes.push(...parsedChanges);
  }
  
  return changes;
}

/**
 * Parse description text for change patterns
 * Backwards compatible with simple descriptions
 */
function parseDescriptionForChanges(description: string): ChangeMetadata[] {
  const changes: ChangeMetadata[] = [];
  
  // Pattern: "Status changed from X to Y"
  const statusPattern = /(?:status|حالة).*?(?:from|من)\s+([^\s]+)\s+(?:to|إلى)\s+([^\s]+)/i;
  const statusMatch = description.match(statusPattern);
  if (statusMatch) {
    changes.push({
      field: 'Status',
      previousValue: statusMatch[1],
      newValue: statusMatch[2],
      displayType: 'status',
    });
  }
  
  // Pattern: "Amount changed from 45,000 to 50,000"
  const amountPattern = /(?:amount|مبلغ).*?(?:from|من)\s+([\d,]+)\s+(?:to|إلى)\s+([\d,]+)/i;
  const amountMatch = description.match(amountPattern);
  if (amountMatch) {
    changes.push({
      field: 'Amount',
      previousValue: amountMatch[1],
      newValue: amountMatch[2],
      displayType: 'currency',
    });
  }
  
  // Pattern: "Discount changed from 5% to 10%"
  const percentPattern = /(?:discount|خصم).*?(?:from|من)\s+([\d.]+)%\s+(?:to|إلى)\s+([\d.]+)%/i;
  const percentMatch = description.match(percentPattern);
  if (percentMatch) {
    changes.push({
      field: 'Discount',
      previousValue: percentMatch[1] + '%',
      newValue: percentMatch[2] + '%',
      displayType: 'percentage',
    });
  }
  
  // Pattern: "Quantity changed from 12 to 15"
  const quantityPattern = /(?:quantity|كمية).*?(?:from|من)\s+(\d+)\s+(?:to|إلى)\s+(\d+)/i;
  const quantityMatch = description.match(quantityPattern);
  if (quantityMatch) {
    changes.push({
      field: 'Quantity',
      previousValue: quantityMatch[1],
      newValue: quantityMatch[2],
      displayType: 'text',
    });
  }
  
  return changes;
}

/**
 * Detect display type based on field name and value
 */
function detectDisplayType(field: string, _value: any): ChangeMetadata['displayType'] {
  const fieldLower = field.toLowerCase();
  
  if (fieldLower.includes('status') || fieldLower.includes('حالة')) {
    return 'status';
  }
  if (fieldLower.includes('amount') || fieldLower.includes('price') || 
      fieldLower.includes('مبلغ') || fieldLower.includes('سعر')) {
    return 'currency';
  }
  if (fieldLower.includes('discount') || fieldLower.includes('percent') || 
      fieldLower.includes('خصم') || fieldLower.includes('نسبة')) {
    return 'percentage';
  }
  if (fieldLower.includes('date') || fieldLower.includes('تاريخ')) {
    return 'date';
  }
  
  return 'text';
}

/**
 * Format change value based on display type
 */
export function formatChangeValue(value: string, displayType: ChangeMetadata['displayType']): string {
  switch (displayType) {
    case 'currency':
      const numValue = parseFloat(value.replace(/,/g, ''));
      return isNaN(numValue) ? value : formatCurrency(numValue);
    
    case 'percentage':
      return value.includes('%') ? value : value + '%';
    
    case 'date':
      try {
        return formatDate(value);
      } catch {
        return value;
      }
    
    case 'status':
    case 'text':
    default:
      return value;
  }
}

/**
 * Determine if an event is expandable (has additional details)
 */
export function isExpandableEvent(log: EnhancedActivityLog): boolean {
  // Has structured metadata
  if (log.metadata && Object.keys(log.metadata).length > 0) {
    return true;
  }
  
  // Has change data
  if (log.previous_value || log.new_value) {
    return true;
  }
  
  // Has long description (>100 chars)
  if (log.description && log.description.length > 100) {
    return true;
  }
  
  // Specific event types that typically have details
  const expandableActions = [
    'payment_added',
    'payment_updated',
    'quotation_updated',
    'measurement_completed',
    'status_changed',
    'item_added',
    'item_updated',
  ];
  
  return expandableActions.some(action => log.action.toLowerCase().includes(action.toLowerCase()));
}

/**
 * Get event category from action
 */
export function getEventCategory(action: string): EventCategory {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('payment') || actionLower.includes('deposit')) {
    return 'payments';
  }
  if (actionLower.includes('measurement') || actionLower.includes('measure')) {
    return 'measurements';
  }
  if (actionLower.includes('quotation') || actionLower.includes('quote')) {
    return 'quotation';
  }
  if (actionLower.includes('note')) {
    return 'notes';
  }
  if (actionLower.includes('document') || actionLower.includes('file')) {
    return 'documents';
  }
  if (actionLower.includes('status') || actionLower.includes('manufacturing') ||
      actionLower.includes('installation') || actionLower.includes('project') ||
      actionLower.includes('completed') || actionLower.includes('cancelled')) {
    return 'workflow';
  }
  
  return 'other';
}

/**
 * Extract entity reference from activity log
 */
export function extractEntityReference(log: EnhancedActivityLog): { type: string; id: string } | null {
  // Use structured entity_type/entity_id if available
  if (log.entity_type && log.entity_id) {
    return {
      type: log.entity_type,
      id: log.entity_id,
    };
  }
  
  // Fallback: try to parse from description or action
  const category = getEventCategory(log.action);
  if (category !== 'other') {
    return {
      type: category,
      id: log.job_id,  // Default to job_id
    };
  }
  
  return null;
}

/**
 * Format relative time in Arabic
 */
export function formatRelativeTime(dateString: string): string {
  const eventDate = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - eventDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `منذ ${weeks} ${weeks === 1 ? 'أسبوع' : 'أسابيع'}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `منذ ${months} ${months === 1 ? 'شهر' : 'أشهر'}`;
  }
  
  const years = Math.floor(diffDays / 365);
  return `منذ ${years} ${years === 1 ? 'سنة' : 'سنوات'}`;
}

/**
 * Group events by date with Arabic labels
 */
export function groupEventsByDate(events: EnhancedActivityLog[]): Record<string, EnhancedActivityLog[]> {
  const groups: Record<string, EnhancedActivityLog[]> = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  events.forEach(event => {
    const eventDate = new Date(event.created_at);
    
    if (eventDate >= todayStart) {
      groups.today.push(event);
    } else if (eventDate >= yesterdayStart) {
      groups.yesterday.push(event);
    } else if (eventDate >= lastWeekStart) {
      groups.lastWeek.push(event);
    } else {
      groups.older.push(event);
    }
  });

  return groups;
}
