import { useState, useEffect } from 'react';
import { Clock as ClockIcon, Calendar } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function LiveClock() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const displayDate = formatDate(now, dateFormat);

  return (
    <div className="flex flex-col items-center gap-1 sm:items-end">
      <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        <ClockIcon className="h-6 w-6 text-primary-400" />
        <span>{formatTime(now)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <Calendar className="h-4 w-4" />
        <span>{displayDate}</span>
      </div>
    </div>
  );
}
