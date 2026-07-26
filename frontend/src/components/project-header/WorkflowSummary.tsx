import { memo, useMemo } from 'react';
import { FileText, Ruler, DollarSign, Package, Wrench, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { Job, Quotation, Payment } from '../../types';
import type { JobStatus } from '../../types';
import { formatDate } from '../../utils/formatters';

interface WorkflowSummaryProps {
  job: Job;
  quotation: Quotation;
  payments: Payment[];
}

interface WorkflowStage {
  id: string;
  name: string;
  icon: typeof FileText;
  status: 'completed' | 'current' | 'upcoming' | 'delayed';
  date?: string;
  isOverdue?: boolean;
}

function WorkflowSummary({ job, quotation, payments }: WorkflowSummaryProps) {
  const workflowStages = useMemo((): WorkflowStage[] => {
    const now = new Date();
    
    // Helper: check if deposit paid
    const depositPaid = payments.some(p => 
      p.payment_type === 'deposit' && p.status === 'paid'
    );

    // Helper: check status order (correct business workflow)
    const statusOrder: JobStatus[] = [
      'pending',
      'measuring',
      'in_production',
      'ready_for_installation',
      'installed',
      'completed'
    ];
    
    const currentStatusIndex = statusOrder.indexOf(job.status);

    // CORRECT BUSINESS WORKFLOW:
    // 1. Measurements → 2. Quotation → 3. Customer Approval & Deposit Paid → 4. Manufacturing → 5. Installation → 6. Completed
    const stages: WorkflowStage[] = [
      {
        id: 'measurement',
        name: 'القياس',
        icon: Ruler,
        status: currentStatusIndex >= 1 ? 'completed' : currentStatusIndex === 0 ? 'current' : 'upcoming',
        date: job.measurement_date || undefined,
        isOverdue: !job.measurement_date && currentStatusIndex <= 0,
      },
      {
        id: 'quotation',
        name: 'عرض السعر',
        icon: FileText,
        status: quotation.status === 'approved' ? 'completed' : 
                quotation.status === 'rejected' ? 'delayed' : 
                currentStatusIndex >= 1 ? 'current' : 'upcoming',
        date: quotation.quotation_date,
        isOverdue: false,
      },
      {
        id: 'deposit',
        name: 'العربون (70%)',
        icon: DollarSign,
        status: depositPaid ? 'completed' : currentStatusIndex >= 2 ? 'current' : 'upcoming',
        date: payments.find(p => p.payment_type === 'deposit' && p.paid_date)?.paid_date,
        isOverdue: !depositPaid && currentStatusIndex >= 2,
      },
      {
        id: 'manufacturing',
        name: 'التصنيع',
        icon: Package,
        status: currentStatusIndex >= 3 ? 'completed' : currentStatusIndex === 2 ? 'current' : 'upcoming',
        date: job.production_start || undefined,
        isOverdue: !!(job.production_end && new Date(job.production_end) < now && currentStatusIndex < 3),
      },
      {
        id: 'installation',
        name: 'التركيب',
        icon: Wrench,
        status: currentStatusIndex >= 5 ? 'completed' : currentStatusIndex === 4 ? 'current' : 'upcoming',
        date: job.installation_date || undefined,
        isOverdue: !!(job.installation_date && new Date(job.installation_date) < now && currentStatusIndex < 5),
      },
      {
        id: 'completed',
        name: 'مكتمل',
        icon: CheckCircle,
        status: job.status === 'completed' ? 'completed' : 'upcoming',
        date: job.completion_date || undefined,
        isOverdue: false,
      },
    ];

    return stages;
  }, [job, quotation, payments]);

  const getStageColor = (status: WorkflowStage['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'current':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'delayed':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'upcoming':
        return 'bg-gray-100 text-gray-500 border-gray-300';
    }
  };

  const getConnectorColor = (stage: WorkflowStage, nextStage: WorkflowStage) => {
    if (stage.status === 'completed') return 'bg-green-400';
    if (stage.status === 'delayed' || nextStage.status === 'delayed') return 'bg-red-400';
    return 'bg-gray-300';
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {workflowStages.map((stage, index) => {
          const Icon = stage.icon;
          const isLast = index === workflowStages.length - 1;
          const nextStage = workflowStages[index + 1];

          return (
            <div key={stage.id} className="flex items-center flex-shrink-0">
              {/* Stage Badge */}
              <div className="flex flex-col items-center min-w-[80px] sm:min-w-[100px]">
                <div
                  className={`
                    w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2
                    ${getStageColor(stage.status)}
                    transition-all duration-300
                    ${stage.status === 'current' ? 'shadow-lg scale-110' : ''}
                  `}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  {stage.isOverdue && (
                    <AlertCircle className="w-3 h-3 text-red-600 absolute -top-1 -right-1" />
                  )}
                </div>
                
                <span className="text-xs sm:text-sm font-medium mt-2 text-center">
                  {stage.name}
                </span>
                
                {stage.date && (
                  <span className="text-xs text-gray-500 mt-1">
                    {formatDate(stage.date)}
                  </span>
                )}
                
                {stage.isOverdue && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <Clock className="w-3 h-3" />
                    متأخر
                  </div>
                )}
              </div>

              {/* Connector Line */}
              {!isLast && nextStage && (
                <div className="flex items-center px-2 sm:px-4">
                  <div
                    className={`h-1 w-8 sm:w-12 rounded-full transition-all duration-300 ${getConnectorColor(stage, nextStage)}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(WorkflowSummary);
