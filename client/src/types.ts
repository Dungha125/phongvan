export type PersonStatus = 'waiting' | 'interviewing' | 'done';

export interface Person {
  id: string;
  name: string;
  queueNumber: number;
  tableNumber: number;
  status: PersonStatus;
  checkedInAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TableSlot {
  tableNumber: number;
  person: Person | null;
}

export interface AppState {
  tables: TableSlot[];
  waiting: Person[];
  interviewing: Person[];
  tableCount: number;
  tableNumber: number | null;
  current?: Person | null;
  nextWaiting?: Person | null;
}
