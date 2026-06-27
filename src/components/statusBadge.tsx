import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/types';

const LABELS: Record<DocumentStatus, string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  accepted: 'Geaccepteerd',
  rejected: 'Afgewezen',
  expired: 'Verlopen',
  partially_paid: 'Deels betaald',
  paid: 'Betaald',
  overdue: 'Te laat',
  credited: 'Gecrediteerd',
  processed: 'Verwerkt',
};

const CLASSES: Partial<Record<DocumentStatus, string>> = {
  paid: 'bg-green-600',
  accepted: 'bg-green-600',
  partially_paid: 'bg-amber-500',
  sent: 'bg-blue-600',
  overdue: 'bg-red-600',
  rejected: 'bg-red-600',
  credited: 'bg-purple-600',
  processed: 'bg-green-600',
};

export const statusBadge = (status: DocumentStatus) => {
  const cls = CLASSES[status];
  if (cls) return <Badge className={cls}>{LABELS[status]}</Badge>;
  return <Badge variant="secondary">{LABELS[status]}</Badge>;
};
