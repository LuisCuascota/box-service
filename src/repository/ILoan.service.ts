import { Observable } from "rxjs";
import { CountFilter } from "./IEntry.service";
import { AliasEnum } from "../infraestructure/Tables.enum";

export interface ILoanService {
  getLoanCount(params?: CountFilter): Observable<LoanCounter>;
  getLoanByAccount(account: number): Observable<Loan | null>;
  getLoanDetail(loanNumber: number): Observable<LoanDetail[]>;
  updateLoanDetail(details: LoanDetailToPay[]): Observable<boolean>;
  updateLoanHead(loanData: EntryLoanData): Observable<boolean>;
  postNewLoan(newLoan: LoanDefinition): Observable<boolean>;
  searchLoan(params: LoanPagination): Observable<Loan[]>;
}

export interface Loan {
  number: number;
  account: number;
  is_end: boolean;
  status: string;
  debt: number;
}

export interface LoanDetail {
  payment_date: string;
  is_paid: boolean;
  fee_value: number;
  interest: number;
}

export interface LoanDefinition {
  loan: Loan;
  loanDetails: LoanDetail[];
}

export interface LoanDetailToPay {
  id: number;
  entry: number;
  feeValue: number;
}

export interface EntryLoanData {
  loanDetailToPay: LoanDetailToPay[];
  loanNumber: number;
  isFinishLoan: boolean;
  currentDebt: number;
}

export interface LoanPagination {
  limit?: number;
  offset?: number;
  account?: number;
  startDate?: number;
  endDate?: number;
  paymentType?: string;
}

export interface LoanCounter {
  [AliasEnum.COUNT]: number;
  [AliasEnum.TOTAL]: number;
  [AliasEnum.DEBT]: number;
}
