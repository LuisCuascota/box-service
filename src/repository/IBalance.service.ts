import { Observable } from "rxjs";

export interface IBalanceService {
  getPartnerBalance(): Observable<PartnerBalance[]>;
}

export interface PartnerBalance {
  account: number;
  names: string;
  currentSaving: number;
  entries: PartnerEntry[];
}

export interface PartnerEntry {
  value: number;
  date: string;
  monthCount: number;
}
