import { Observable } from "rxjs";

export interface ILoanService {
  getLoanCount(): Observable<number>;
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
  limit: number;
  offset: number;
  account?: number;
}
