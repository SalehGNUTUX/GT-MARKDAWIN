import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../context';
import type { NotifType } from '../types';

const ICONS: Record<NotifType, React.ReactNode> = {
  success: <CheckCircle2 size={15} />,
  error: <XCircle size={15} />,
  warning: <AlertTriangle size={15} />,
  info: <Info size={15} />,
};

export default function Notification() {
  const { notifications } = useApp();

  if (!notifications.length) return null;

  return (
    <div className="notifications">
      {notifications.map(n => (
        <div key={n.id} className={`notif ${n.type}`}>
          {ICONS[n.type]}
          <span>{n.message}</span>
        </div>
      ))}
    </div>
  );
}
