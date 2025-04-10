import { Observable } from "rxjs";
import { AliasEnum } from "../infraestructure/Tables.enum";

export interface IEgressService {
  getEgressCount(params?: EgressCountFilter): Observable<EgressCounter>;
  postNewEgress(newEgress: NewEgress): Observable<boolean>;
  searchEgress(params: EgressPagination): Observable<EgressHeader[]>;
  getEgressDetail(number: number): Observable<EgressDetail>;
}

export interface EgressCounter {
  [AliasEnum.COUNT]: number;
  [AliasEnum.CASH]: number;
  [AliasEnum.TRANSFER]: number;
  [AliasEnum.TOTAL]: number;
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
  period_id: number;
}

export interface EgressAmountDetail {
  discharge_number: number;
  description: string;
  value: number;
}

export interface EgressPagination {
  limit: number;
  offset: number;
  type?: number;
  startDate?: number;
  endDate?: number;
  paymentType?: string;
  period?: number;
}

export interface EgressBillDetail {
  cash: number;
  transfer: number;
  period_id: number;
  date: string;
}

export interface EgressDetail {
  billDetail: EgressBillDetail;
  amountDetail: EgressAmountDetail[];
}

export interface EgressCountFilter {
  type?: number;
  startDate?: number;
  endDate?: number;
  paymentType?: string;
  period?: number;
}
