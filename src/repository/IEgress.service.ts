import { Observable } from "rxjs";

export interface IEgressService {
  getEgressCount(): Observable<number>;
  postNewEgress(newEgress: NewEgress): Observable<boolean>;
  searchEgress(params: EgressPagination): Observable<EgressHeader[]>;
  getEgressDetail(number: number): Observable<EgressDetail>;
}

export interface NewEgress {
  header: EgressHeader;
  detail: EgressDetail[];
  billDetail: EgressBillDetail;
}

export interface EgressHeader {
  number: number;
  date: string;
  place: string;
  beneficiary: string;
  amount: number;
  type_id: number;
  cash: number;
  transfer: number;
  status: string;
}

export interface EgressAmountDetail {
  discharge_number: number;
  description: string;
  value: number;
}

export interface EgressPagination {
  limit: number;
  offset: number;
}

export interface EgressBillDetail {
  cash: number;
  transfer: number;
}

export interface EgressDetail {
  billDetail: EgressBillDetail;
  amountDetail: EgressAmountDetail[];
}
