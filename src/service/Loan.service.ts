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
  LoanCounter,
  LoanDefinition,
  LoanDetail,
  LoanDetailToPay,
  LoanPagination,
  LoanPayment,
} from "../repository/ILoan.service";
import { CountFilter } from "../repository/IEntry.service";
import QueryBuilder = Knex.QueryBuilder;
import {
  DATE_FORMAT,
  RegistryStatusEnum,
} from "../infraestructure/RegistryStatusEnum";
import moment from "moment/moment";
import { isDisabledLoanFee } from "../utils/Common.utils";

@injectable()
export class LoanService implements ILoanService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getLoanCount(params?: CountFilter): Observable<LoanCounter> {
    return of(1).pipe(
      map(() =>
        this._knex
          .count(buildCol({ l: TColLoan.NUMBER }, AliasEnum.COUNT))
          .sum(buildCol({ l: TColLoan.VALUE }, AliasEnum.TOTAL))
          .sum(buildCol({ l: TColLoan.DEBT }, AliasEnum.DEBT))
          .from({ l: TablesEnum.LOAN })
      ),
      map((query: QueryBuilder) => {
        this._buildLoanFilters(query, params);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<LoanCounter>(query)),
      map((response: LoanCounter[]) => ({
        count: response[0][AliasEnum.COUNT] ?? 0,
        total: response[0][AliasEnum.TOTAL] ?? 0,
        debt: response[0][AliasEnum.DEBT] ?? 0,
      })),
      tag("LoanService | getLoanCount")
    );
  }

  public getLoanByAccount(account: number): Observable<Loan | null> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select()
          .from({ l: TablesEnum.LOAN })
          .where(buildCol({ l: TColLoan.ACCOUNT }), account)
          .where(buildCol({ l: TColLoan.IS_END }), false)
          .toQuery()
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
      map(() =>
        this._knex
          .select()
          .from({ l: TablesEnum.LOAN_DETAIL })
          .where(buildCol({ l: TColLoanDetail.LOAN_NUMBER }), loanNumber)
          .orderBy(buildCol({ l: TColLoanDetail.FEE_NUMBER }))
          .toQuery()
      ),
      mergeMap((query: string) => this._mysql.query<LoanDetail>(query)),
      tag("LoanService | getLoanDetail")
    );
  }

  public updateLoanDetail(details: LoanDetailToPay[]): Observable<boolean> {
    return of(1).pipe(
      switchMap(() => from(details)),
      map((detail: LoanDetailToPay) =>
        this._knex
          .update({
            [buildCol({ l: TColLoanDetail.IS_PAID })]: true,
            [buildCol({ l: TColLoanDetail.ENTRY_NUMBER })]: detail.entry,
          })
          .from({ l: TablesEnum.LOAN_DETAIL })
          .where(buildCol({ l: TColLoanDetail.ID }), detail.id)
          .toQuery()
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
      map(() =>
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

  public updateLoan(newLoan: LoanDefinition): Observable<boolean> {
    return of(1).pipe(
      concatMap(() => this._updateLoanHead(newLoan.loan)),
      concatMap(() => this._updateLoanDetail(newLoan.loanDetails)),
      concatMap(() => this._saveLoanPayment(newLoan.loanPayment)),
      map(() => true),
      tag("LoanService | updateLoan")
    );
  }

  public searchLoan(params: LoanPagination): Observable<Loan[]> {
    return of(1).pipe(
      map(() =>
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
            buildCol({ p: TColPerson.SURNAMES }),
            this._knex.raw(`
              CASE 
                WHEN ${buildCol({ l: TColLoan.IS_END })} = ${true} THEN '${
                  RegistryStatusEnum.PAID
                }'
                WHEN EXISTS (
                  SELECT 1
                  FROM ${TablesEnum.LOAN_DETAIL} d
                  WHERE ${buildCol({ l: TColLoan.NUMBER })} = ${buildCol({
                    d: TColLoanDetail.LOAN_NUMBER,
                  })}
                  AND ${buildCol({ d: TColLoanDetail.IS_PAID })} = ${false}
                  AND ${buildCol({
                    d: TColLoanDetail.PAYMENT_DATE,
                  })} <= '${moment.utc().format(DATE_FORMAT)}'
                ) THEN '${RegistryStatusEnum.LATE}'
                ELSE '${RegistryStatusEnum.CURRENT}'
              END AS status`)
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
      ),
      map((query: QueryBuilder) => {
        this._buildLoanFilters(query, params);
        query.where(buildCol({ l: TColLoan.ENABLED }), true);
        query.orderBy(buildCol({ l: TColLoan.NUMBER }), "desc");

        if (params && params.limit && params.offset)
          query.limit(params.limit).offset(params.offset);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<Loan>(query)),
      tag("LoanService | searchLoan")
    );
  }

  private _buildLoanFilters(
    query: QueryBuilder,
    params?: LoanPagination | CountFilter
  ) {
    if (params) {
      if (params.paymentType && params.paymentType === RegistryStatusEnum.LATE)
        query
          .where(buildCol({ l: TColLoan.IS_END }), false)
          .whereExists((q) => {
            this._buildLoanDetailFilters(q);
          });

      if (
        params.paymentType &&
        params.paymentType === RegistryStatusEnum.CURRENT
      )
        query
          .where(buildCol({ l: TColLoan.IS_END }), false)
          .whereNotExists((q) => {
            this._buildLoanDetailFilters(q);
          });

      if (params.paymentType && params.paymentType === RegistryStatusEnum.PAID)
        query.where(buildCol({ l: TColLoan.IS_END }), true);

      if (params.account)
        query.where(buildCol({ l: TColLoan.ACCOUNT }), params.account);

      if (params.startDate)
        query.where(buildCol({ l: TColLoan.DATE }), ">=", params.startDate);

      if (params.endDate)
        query.where(buildCol({ l: TColLoan.DATE }), "<=", params.endDate);
    }
  }

  private _buildLoanDetailFilters(query: QueryBuilder) {
    query
      .select(1)
      .from({ d: TablesEnum.LOAN_DETAIL })
      .whereRaw(
        `${buildCol({ l: TColLoan.NUMBER })}
                =${buildCol({ d: TColLoanDetail.LOAN_NUMBER })}`
      )
      .where(buildCol({ d: TColLoanDetail.IS_PAID }), false)
      .where(
        buildCol({ d: TColLoanDetail.PAYMENT_DATE }),
        "<",
        moment().format(DATE_FORMAT)
      );
  }

  private _saveLoanHead = (head: Loan) => {
    return of(1).pipe(
      map(() => this._knex.insert(head).into(TablesEnum.LOAN).toQuery()),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("LoanService | _saveLoanHead")
    );
  };

  private _updateLoanHead = (head: Loan) => {
    return of(1).pipe(
      map(() =>
        this._knex
          .update({
            [buildCol({ l: TColLoan.TERM })]: head.term,
            [buildCol({ l: TColLoan.DEBT })]: head.debt.toFixed(2),
          })
          .from({ l: TablesEnum.LOAN })
          .where(buildCol({ l: TColLoan.NUMBER }), head.number)
          .toQuery()
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("LoanService | _updateLoanHead")
    );
  };

  private _saveLoanDetail = (details: LoanDetail[]) => {
    return of(1).pipe(
      switchMap(() => from(details)),
      map((detail: LoanDetail) =>
        this._knex.insert(detail).into(TablesEnum.LOAN_DETAIL).toQuery()
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      last(),
      tag("LoanService | _saveLoanDetail")
    );
  };

  private _updateLoanDetail = (details: LoanDetail[]) => {
    return of(1).pipe(
      switchMap(() => from(details)),
      map((detail: LoanDetail) =>
        this._knex
          .update({
            [buildCol({ l: TColLoanDetail.FEE_VALUE })]: detail.fee_value,
            [buildCol({ l: TColLoanDetail.INTEREST })]: detail.interest,
            [buildCol({ l: TColLoanDetail.FEE_TOTAL })]: detail.fee_total,
            [buildCol({ l: TColLoanDetail.BALANCE_AFTER_PAY })]:
              detail.balance_after_pay,
            [buildCol({ l: TColLoanDetail.IS_DISABLED })]:
              isDisabledLoanFee(detail),
            [buildCol({ l: TColLoanDetail.IS_PAID })]: detail.is_paid,
          })
          .from({ l: TablesEnum.LOAN_DETAIL })
          .where(
            buildCol({ l: TColLoanDetail.LOAN_NUMBER }),
            detail.loan_number
          )
          .where(buildCol({ l: TColLoanDetail.FEE_NUMBER }), detail.fee_number)
          .toQuery()
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      last(),
      tag("LoanService | _updateLoanDetail")
    );
  };

  private _saveLoanPayment = (loanPayment?: LoanPayment) => {
    return of(1).pipe(
      map(() =>
        this._knex.insert(loanPayment).into(TablesEnum.LOAN_PAYMENT).toQuery()
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("LoanService | _saveLoanPayment")
    );
  };
}
