export type PersonStatus = 'pending' | 'waiting' | 'interviewing' | 'done';

export interface Person {
  id: string;
  stt?: number;
  name: string;
  msv?: string;
  classCode?: string;
  startTime?: string;
  endTime?: string;
  queueNumber: number;
  tableNumber: number;
  status: PersonStatus;
  note?: string;
  checkedInAt: string | null;
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
  pending?: Person[];
  people?: Person[];
  tableCount: number;
  tableNumber: number | null;
  current?: Person | null;
  nextWaiting?: Person | null;
  counts?: {
    total: number;
    pending: number;
    waiting: number;
    interviewing: number;
    done: number;
  };
}
