import { Observable } from "rxjs";
import { AliasEnum } from "../infraestructure/Tables.enum";
import { EntryLoanData, LoanDefinition } from "./ILoan.service";

export interface IEntryService {
  getEntryCount(params?: CountFilter): Observable<EntryCounter>;
  getEntryTypes(): Observable<EntryType[]>;
  getEntryAmounts(account: number): Observable<EntryAmount[]>;
  postNewEntry(newEntry: NewEntry): Observable<boolean>;
  searchEntry(params: EntryPagination): Observable<EntryHeader[]>;
  getEntryDetail(number: number): Observable<EntryDetail>;
  getContributionList(account: number): Observable<Contribution[]>;
}

export interface EntryCounter {
  [AliasEnum.COUNT]: number;
  [AliasEnum.CASH]: number;
  [AliasEnum.TRANSFER]: number;
  [AliasEnum.TOTAL]: number;
}

export interface Total {
  [AliasEnum.TOTAL]: number;
}

export interface EntryType {
  id: number;
  description: string;
}

export interface EntryAmount {
  id: number;
  value: number;
  amountDefinition?: LoanDefinition;
}

export interface NewEntry {
  header: EntryHeader;
  detail: EntryAmountDetail[];
  billDetail: EntryBillDetail;
  entryLoanData?: EntryLoanData;
}

export interface EntryHeader {
  number: number;
  account_number: number;
  amount: number;
  date: string;
  place: string;
  cash: number;
  transfer: number;
  status: string;
  period_id: number;
}

export interface EntryAmountDetail {
  entry_number: number;
  type_id: number;
  value: number;
  currentSaving?: number;
}

export interface EntryPagination {
  limit: number;
  offset: number;
  account?: number;
  startDate?: number;
  endDate?: number;
  paymentType?: string;
  period?: number;
}

export interface Contribution {
  date: string;
  number: number;
  value: number;
  type_id: number;
}
export interface EntryBillDetail {
  cash: number;
  transfer: number;
  period_id: number;
  date: string;
}

export interface EntryLoanDetail {
  number: number;
  term: number;
  value: number;
  fee_number: number;
  fee_value: number;
  interest: number;
  fee_total: number;
  balance_after_pay: number;
}

export interface EntryDetail {
  billDetail: EntryBillDetail;
  amountDetail: EntryAmountDetail[];
  entryLoanDetail?: EntryLoanDetail;
}

export interface CountFilter {
  account?: number;
  startDate?: number;
  endDate?: number;
  paymentType?: string;
  period?: number;
}
