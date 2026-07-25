import type { LucideProps } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ComponentType<LucideProps>;
  color: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
};

export default function KPICard({ label, value, icon: Icon, color, onClick }: KPICardProps) {
  const bgColorClass = colorClasses[color];
  
  // Defensive: ensure value is always a number
  const displayValue = typeof value === 'number' ? value : 0;

  return (
    <div
      className={`bg-white rounded-lg shadow p-6 transition-shadow ${
        onClick ? 'hover:shadow-lg cursor-pointer' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          onClick();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{displayValue.toLocaleString()}</p>
        </div>
        <div className={`${bgColorClass} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
