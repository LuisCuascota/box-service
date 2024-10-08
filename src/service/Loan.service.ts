import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  concatMap,
  from,
  iif,
  last,
  map,
  mergeMap,
  Observable,
  of,
  switchMap,
  toArray,
} from "rxjs";
import knex, { Knex } from "knex";
import {
  AliasEnum,
  buildCol,
  TablesEnum,
  TColAccount,
  TColLoan,
  TColLoanDetail,
  TColPerson,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import {
  EntryLoanData,
  ILoanService,
  Loan,
  LoanDefinition,
  LoanDetail,
  LoanDetailToPay,
  LoanPagination,
} from "../repository/ILoan.service";
import { Counter } from "../repository/IEntry.service";
import QueryBuilder = Knex.QueryBuilder;
import { checkLoanPaymentsStatus } from "../utils/Loan.utils";
import { RegistryStatusEnum } from "../infraestructure/RegistryStatusEnum";

@injectable()
export class LoanService implements ILoanService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getLoanCount(): Observable<number> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .count(buildCol({ l: TColLoan.NUMBER }, AliasEnum.COUNT))
            .from({ l: TablesEnum.LOAN })
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Counter>(query)),
      map((response: Counter[]) => response[0][AliasEnum.COUNT]),
      tag("LoanService | getLoanCount")
    );
  }

  public getLoanByAccount(account: number): Observable<Loan | null> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select()
            .from({ l: TablesEnum.LOAN })
            .where(buildCol({ l: TColLoan.ACCOUNT }), account)
            .where(buildCol({ l: TColLoan.IS_END }), false)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Loan>(query)),
      mergeMap((response: Loan[]) =>
        iif(() => response.length > 0, of(response[0]), of(null))
      ),
      tag("LoanService | getLoanByAccount")
    );
  }

  public getLoanDetail(loanNumber: number): Observable<LoanDetail[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select()
            .from({ l: TablesEnum.LOAN_DETAIL })
            .where(buildCol({ l: TColLoanDetail.LOAN_NUMBER }), loanNumber)
            .orderBy(buildCol({ l: TColLoanDetail.FEE_NUMBER }))
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<LoanDetail>(query)),
      tag("LoanService | getLoanDetail")
    );
  }

  public updateLoanDetail(details: LoanDetailToPay[]): Observable<boolean> {
    return of(1).pipe(
      switchMap(() => from(details)),
      mergeMap((detail: LoanDetailToPay) =>
        of(
          this._knex
            .update({
              [buildCol({ l: TColLoanDetail.IS_PAID })]: true,
              [buildCol({ l: TColLoanDetail.ENTRY_NUMBER })]: detail.entry,
            })
            .from({ l: TablesEnum.LOAN_DETAIL })
            .where(buildCol({ l: TColLoanDetail.ID }), detail.id)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<boolean>(query)),
      map(() => true),
      last(),
      tag("LoanService | updateLoanDetail")
    );
  }

  public updateLoanHead(loanData: EntryLoanData): Observable<boolean> {
    const totalPaid = loanData.loanDetailToPay.reduce(
      (sum, entry) => sum + entry.feeValue,
      0
    );

    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .update({
              [buildCol({ l: TColLoan.IS_END })]: loanData.isFinishLoan,
              [buildCol({ l: TColLoan.DEBT })]: (
                loanData.currentDebt - totalPaid
              ).toFixed(2),
            })
            .from({ l: TablesEnum.LOAN })
            .where(buildCol({ l: TColLoan.NUMBER }), loanData.loanNumber)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<boolean>(query)),
      map(() => true),
      tag("LoanService | updateFinishLoan")
    );
  }

  public postNewLoan(newLoan: LoanDefinition): Observable<boolean> {
    return of(1).pipe(
      concatMap(() => this._saveLoanHead(newLoan.loan)),
      concatMap(() => this._saveLoanDetail(newLoan.loanDetails)),
      map(() => true),
      tag("LoanService | postNewLoan")
    );
  }

  public searchLoan(params: LoanPagination): Observable<Loan[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ l: TColLoan.NUMBER }),
              buildCol({ l: TColLoan.ACCOUNT }),
              buildCol({ l: TColLoan.DATE }),
              buildCol({ l: TColLoan.VALUE }),
              buildCol({ l: TColLoan.IS_END }),
              buildCol({ l: TColLoan.RATE }),
              buildCol({ l: TColLoan.TERM }),
              buildCol({ l: TColLoan.DEBT }),
              buildCol({ p: TColPerson.NAMES }),
              buildCol({ p: TColPerson.SURNAMES })
            )
            .from({ l: TablesEnum.LOAN })
            .innerJoin(
              { a: TablesEnum.ACCOUNT },
              buildCol({ l: TColLoan.ACCOUNT }),
              buildCol({ a: TColAccount.NUMBER })
            )
            .innerJoin(
              { p: TablesEnum.PERSON },
              buildCol({ p: TColPerson.DNI }),
              buildCol({ a: TColAccount.DNI })
            )
        )
      ),
      mergeMap((query: QueryBuilder) => {
        if (params.account)
          query.where(buildCol({ l: TColLoan.ACCOUNT }), params.account);

        query
          .orderBy(buildCol({ l: TColLoan.NUMBER }), "desc")
          .limit(params.limit)
          .offset(params.offset)
          .toQuery();

        return of(query.toQuery());
      }),
      mergeMap((query: string) => this._mysql.query<Loan>(query)),
      mergeMap((loanList: Loan[]) => this._setLoanStatus(loanList)),
      tag("LoanService | searchLoan")
    );
  }

  private _setLoanStatus = (loanList: Loan[]): Observable<Loan[]> => {
    return from(loanList).pipe(
      concatMap((loan: Loan) =>
        iif(
          () => loan.is_end,
          of({ ...loan, status: RegistryStatusEnum.PAID }),
          this._verifyLoanStatus(loan)
        )
      ),
      toArray()
    );
  };

  private _verifyLoanStatus = (loan: Loan) => {
    return this.getLoanDetail(loan.number).pipe(
      map((loanDetails: LoanDetail[]) => {
        const isDelayed = checkLoanPaymentsStatus(loanDetails);

        if (isDelayed) {
          loan.status = RegistryStatusEnum.LATE;

          return loan;
        }

        loan.status = RegistryStatusEnum.CURRENT;

        return loan;
      })
    );
  };

  private _saveLoanHead = (head: Loan) => {
    return of(1).pipe(
      mergeMap(() =>
        of(this._knex.insert(head).into(TablesEnum.LOAN).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("LoanService | _saveLoanHead")
    );
  };

  private _saveLoanDetail = (details: LoanDetail[]) => {
    return of(1).pipe(
      switchMap(() => from(details)),
      mergeMap((detail: LoanDetail) =>
        of(this._knex.insert(detail).into(TablesEnum.LOAN_DETAIL).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      last(),
      tag("LoanService | _saveLoanDetail")
    );
  };
}
