import { memo, useState } from 'react';
import { 
  FileText, Check, X, Calendar, Package, DollarSign, Ruler, 
  Wrench, CheckCircle, Edit, AlertCircle, Clock, User, FileCheck,
  ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';
import type { EnhancedActivityLog } from '../../types/activityLog';
import { formatDate, formatTime } from '../../utils/formatters';
import {
  parseChangeMetadata,
  formatChangeValue,
  isExpandableEvent,
  formatRelativeTime,
} from '../../utils/activityLogUtils';

interface TimelineCardProps {
  event: EnhancedActivityLog;
  onNavigate?: (section: string) => void;
  isLatest?: boolean;
}

const EVENT_CONFIG: Record<string, { icon: typeof FileText; color: string; category: string }> = {
  // Project lifecycle
  'project_created': { icon: FileCheck, color: 'bg-blue-100 text-blue-700', category: 'workflow' },
  'project_completed': { icon: CheckCircle, color: 'bg-green-100 text-green-700', category: 'workflow' },
  'project_cancelled': { icon: X, color: 'bg-red-100 text-red-700', category: 'workflow' },
  
  // Quotation
  'quotation_created': { icon: FileText, color: 'bg-blue-100 text-blue-700', category: 'quotation' },
  'quotation_updated': { icon: Edit, color: 'bg-blue-100 text-blue-700', category: 'quotation' },
  'quotation_approved': { icon: Check, color: 'bg-green-100 text-green-700', category: 'quotation' },
  'quotation_rejected': { icon: X, color: 'bg-red-100 text-red-700', category: 'quotation' },
  'item_added': { icon: Package, color: 'bg-blue-100 text-blue-700', category: 'quotation' },
  'item_removed': { icon: X, color: 'bg-orange-100 text-orange-700', category: 'quotation' },
  'item_updated': { icon: Edit, color: 'bg-blue-100 text-blue-700', category: 'quotation' },
  
  // Measurements
  'measurement_scheduled': { icon: Calendar, color: 'bg-purple-100 text-purple-700', category: 'measurements' },
  'measurement_completed': { icon: Ruler, color: 'bg-purple-100 text-purple-700', category: 'measurements' },
  'measurement_added': { icon: Ruler, color: 'bg-purple-100 text-purple-700', category: 'measurements' },
  'measurement_updated': { icon: Edit, color: 'bg-purple-100 text-purple-700', category: 'measurements' },
  
  // Payments
  'deposit_requested': { icon: DollarSign, color: 'bg-orange-100 text-orange-700', category: 'payments' },
  'deposit_received': { icon: DollarSign, color: 'bg-green-100 text-green-700', category: 'payments' },
  'payment_added': { icon: DollarSign, color: 'bg-blue-100 text-blue-700', category: 'payments' },
  'payment_received': { icon: DollarSign, color: 'bg-green-100 text-green-700', category: 'payments' },
  'payment_updated': { icon: Edit, color: 'bg-blue-100 text-blue-700', category: 'payments' },
  'payment_deleted': { icon: X, color: 'bg-red-100 text-red-700', category: 'payments' },
  'final_payment_requested': { icon: DollarSign, color: 'bg-orange-100 text-orange-700', category: 'payments' },
  'final_payment_received': { icon: DollarSign, color: 'bg-green-100 text-green-700', category: 'payments' },
  
  // Manufacturing
  'manufacturing_started': { icon: Package, color: 'bg-yellow-100 text-yellow-700', category: 'workflow' },
  'manufacturing_completed': { icon: Package, color: 'bg-green-100 text-green-700', category: 'workflow' },
  
  // Installation
  'installation_scheduled': { icon: Calendar, color: 'bg-indigo-100 text-indigo-700', category: 'workflow' },
  'installation_started': { icon: Wrench, color: 'bg-indigo-100 text-indigo-700', category: 'workflow' },
  'installation_completed': { icon: Wrench, color: 'bg-green-100 text-green-700', category: 'workflow' },
  
  // Status changes
  'status_changed': { icon: Edit, color: 'bg-gray-100 text-gray-700', category: 'workflow' },
  'priority_changed': { icon: AlertCircle, color: 'bg-orange-100 text-orange-700', category: 'workflow' },
  
  // Notes
  'notes_updated': { icon: FileText, color: 'bg-gray-100 text-gray-700', category: 'notes' },
  
  // Documents
  'document_uploaded': { icon: FileCheck, color: 'bg-blue-100 text-blue-700', category: 'documents' },
  'document_deleted': { icon: X, color: 'bg-red-100 text-red-700', category: 'documents' },
  
  // Default
  'default': { icon: AlertCircle, color: 'bg-gray-100 text-gray-700', category: 'other' },
};

function TimelineCard({ event, onNavigate, isLatest = false }: TimelineCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const config = EVENT_CONFIG[event.action] || EVENT_CONFIG.default;
  const Icon = config.icon;
  const expandable = isExpandableEvent(event);
  const changes = parseChangeMetadata(event);

  const handleCardClick = () => {
    if (expandable) {
      setIsExpanded(!isExpanded);
    } else if (onNavigate && config.category !== 'other' && config.category !== 'workflow') {
      onNavigate(config.category);
    }
  };

  const isClickable = expandable || (config.category !== 'other' && config.category !== 'workflow');

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative flex flex-col gap-3 p-4 border rounded-lg transition-all
        ${isLatest ? 'border-blue-300 bg-blue-50 shadow-md' : 'border-gray-200 bg-white'}
        ${isClickable ? 'cursor-pointer hover:border-blue-400 hover:shadow-md' : ''}
        ${isExpanded ? 'shadow-lg' : ''}
      `}
    >
      {/* Main Content */}
      <div className="flex gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title & Time */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1">
              {event.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <time className="text-xs text-gray-500" dateTime={event.created_at}>
                {formatTime(event.created_at)}
              </time>
              <span className="text-xs text-gray-400">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
          </div>

          {/* Description (Collapsed) */}
          {event.description && !isExpanded && (
            <p className="text-sm text-gray-700 mb-2 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Footer: Date & User */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(event.created_at)}</span>
            </div>
            {event.user_name && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{event.user_name}</span>
              </div>
            )}
          </div>

          {/* Expand Indicator */}
          {expandable && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-medium">
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>إخفاء التفاصيل</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>عرض التفاصيل</span>
                </>
              )}
            </div>
          )}

          {/* Navigation hint (if not expandable) */}
          {!expandable && isClickable && (
            <div className="mt-2 text-xs text-blue-600 font-medium">
              انقر للانتقال إلى القسم →
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="pt-3 border-t border-gray-200 space-y-3 animate-in fade-in-50 duration-200">
          {/* Full Description */}
          {event.description && (
            <div className="text-sm text-gray-700">
              {event.description}
            </div>
          )}

          {/* Change Comparison */}
          {changes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">التغييرات:</h4>
              {changes.map((change, index) => (
                <div key={index} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                  <span className="font-medium text-gray-700">{change.field}:</span>
                  <span className="text-gray-600 line-through">{formatChangeValue(change.previousValue, change.displayType)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-blue-600">{formatChangeValue(change.newValue, change.displayType)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Metadata (if available) */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">معلومات إضافية:</h4>
              <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{key}:</span>
                    <span className="text-gray-600">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Button (if applicable) */}
          {onNavigate && config.category !== 'other' && config.category !== 'workflow' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(config.category);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span>الانتقال إلى {config.category === 'payments' ? 'المدفوعات' : config.category === 'measurements' ? 'القياسات' : 'عرض السعر'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Latest Badge */}
      {isLatest && (
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
            <Clock className="w-3 h-3" />
            جديد
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(TimelineCard);
