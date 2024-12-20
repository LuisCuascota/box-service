import { Observable } from "rxjs";
import { AliasEnum } from "../infraestructure/Tables.enum";
import { EntryLoanData, LoanDefinition } from "./ILoan.service";

export interface IEntryService {
  getEntryCount(params?: CountFilter): Observable<number>;
  getEntryTypes(): Observable<EntryType[]>;
  getEntryAmounts(account: number): Observable<EntryAmount[]>;
  postNewEntry(newEntry: NewEntry): Observable<boolean>;
  searchEntry(params: EntryPagination): Observable<EntryHeader[]>;
  getEntryDetail(number: number): Observable<EntryDetail>;
  getContributionList(account: number): Observable<Contribution[]>;
}

export interface Counter {
  [AliasEnum.COUNT]: number;
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
}

export interface Contribution {
  date: string;
  number: number;
  value: number;
}
export interface EntryBillDetail {
  cash: number;
  transfer: number;
}

export interface EntryDetail {
  billDetail: EntryBillDetail;
  amountDetail: EntryAmountDetail[];
}

export interface CountFilter {
  account?: number;
  startDate?: number;
  endDate?: number;
}
