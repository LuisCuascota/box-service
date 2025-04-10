import { Observable } from "rxjs";

export interface IBalanceService {
  getPartnerBalance(filter: BalanceFilters): Observable<PartnerBalance[]>;
  getPeriodList(filter?: BalanceFilters): Observable<Period[]>;
}

export interface PartnerBalance {
  account: number;
  names: string;
  currentSaving: number;
  entries: PartnerEntry[];
  participationRate: number;
}

export interface PartnerEntry {
  value: number;
  date: string;
  monthCount: number;
}

export interface BalanceEntry {
  number: number;
  account_number: number;
  date: string;
  value: number;
}

export interface Period {
  id: number;
  start_date: string;
  enabled: boolean;
  end_date?: string;
  init_cash: number;
  init_transfer: number;
}

export interface PeriodAccount {
  account_id: number;
  period_id: number;
  start_amount: number;
}

export interface BalanceFilters {
  period: number;
}
