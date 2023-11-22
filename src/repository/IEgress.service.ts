import { Observable } from "rxjs";

export interface IEgressService {
  getEgressCount(): Observable<number>;
  postNewEgress(newEgress: NewEgress): Observable<boolean>;
  searchEgress(params: EgressPagination): Observable<EgressHeader[]>;
  getEgressDetail(number: number): Observable<EgressDetail[]>;
}

export interface NewEgress {
  header: EgressHeader;
  detail: EgressDetail[];
}

export interface EgressHeader {
  number: number;
  date: string;
  place: string;
  beneficiary: string;
  amount: number;
  is_transfer: boolean;
}

export interface EgressDetail {
  discharge_number: number;
  description: string;
  value: number;
}

export interface EgressPagination {
  limit: number;
  offset: number;
}
