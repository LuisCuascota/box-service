import { Observable } from "rxjs";
import { AliasEnum } from "../infraestructure/Tables.enum";
import { EntryLoanData, LoanDefinition } from "./ILoan.service";

export interface IEntryService {
  getEntryCount(): Observable<number>;
  getEntryTypes(): Observable<EntryType[]>;
  getEntryAmounts(account: number): Observable<EntryAmount[]>;
  postNewEntry(newEntry: NewEntry): Observable<boolean>;
  searchEntry(params: EntryPagination): Observable<EntryHeader[]>;
  getEntryDetail(number: number): Observable<EntryDetail[]>;
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
  detail: EntryDetail[];
  entryLoanData?: EntryLoanData;
}

export interface EntryHeader {
  number: number;
  account_number: number;
  amount: number;
  date: string;
  place: string;
  is_transfer: boolean;
}

export interface EntryDetail {
  entry_number: number;
  type_id: number;
  value: number;
}

export interface EntryPagination {
  limit: number;
  offset: number;
  account?: number;
}
