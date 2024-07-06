import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  forkJoin,
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
  TColDetail,
  TColEntry,
  TColEntryBillDetail,
  TColEntryType,
  TColPerson,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import {
  Counter,
  EntryAmount,
  EntryType,
  IEntryService,
  NewEntry,
  EntryHeader,
  Total,
  EntryPagination,
  Contribution,
  EntryBillDetail,
  EntryAmountDetail,
  EntryDetail,
} from "../repository/IEntry.service";
import { EntryTypesIdEnum } from "../infraestructure/entryTypes.enum";
import {
  calculateContributionAmount,
  calculateLoanAmount,
} from "../utils/Entry.utils";
import { ILoanService, Loan, LoanDetail } from "../repository/ILoan.service";
import QueryBuilder = Knex.QueryBuilder;

@injectable()
export class EntryService implements IEntryService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  private readonly _loanService: ILoanService;

  constructor(
    @inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway,
    @inject(IDENTIFIERS.LoanService) loanService: ILoanService
  ) {
    this._mysql = mysql;
    this._loanService = loanService;
  }

  public getEntryCount(): Observable<number> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .count(buildCol({ p: TColEntry.NUMBER }, AliasEnum.COUNT))
            .from({ p: TablesEnum.ENTRY })
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Counter>(query)),
      map((response: Counter[]) => response[0][AliasEnum.COUNT]),
      tag("EntryService | getEntryCount")
    );
  }

  public getEntryTypes(): Observable<EntryType[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(this._knex.select().from({ p: TablesEnum.ENTRY_TYPE }).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query<EntryType>(query)),
      tag("EntryService | getEntryTypes")
    );
  }

  public getEntryAmounts(account: number): Observable<EntryAmount[]> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([
          this._calculateContributionAmount(account),
          this._calculateLoanAmount(account),
        ])
      ),
      map(([contributionAmount, loanAMount]: [EntryAmount[], EntryAmount[]]) =>
        contributionAmount.concat(loanAMount)
      ),
      tag("EntryService | getEntryAmounts")
    );
  }

  public postNewEntry(newEntry: NewEntry): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() => this._saveEntryHead(newEntry.header)),
      mergeMap(() => this._saveEntryDetail(newEntry.detail)),
      mergeMap(() =>
        this._saveEntryBillDetail(newEntry.header.number, newEntry.billDetail)
      ),
      mergeMap(() => {
        if (newEntry.entryLoanData)
          return this._loanService.updateLoanDetail(
            newEntry.entryLoanData.loanDetailToPay
          );

        return of(true);
      }),
      mergeMap(() => {
        if (newEntry.entryLoanData && newEntry.entryLoanData.isFinishLoan)
          return this._loanService.updateFinishLoan(
            newEntry.entryLoanData.loanNumber
          );

        return of(true);
      }),
      map(() => true),
      tag("EntryService | postNewEntry")
    );
  }

  public searchEntry(params: EntryPagination): Observable<EntryHeader[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ e: TColEntry.NUMBER }),
              buildCol({ e: TColEntry.DATE }),
              buildCol({ e: TColEntry.AMOUNT }),
              buildCol({ e: TColEntry.PLACE }),
              buildCol({ e: TColEntry.ACCOUNT_NUMBER }),
              buildCol({ p: TColPerson.NAMES }),
              buildCol({ p: TColPerson.SURNAMES })
            )
            .from({ e: TablesEnum.ENTRY })
            .innerJoin(
              { a: TablesEnum.ACCOUNT },
              buildCol({ e: TColEntry.ACCOUNT_NUMBER }),
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
          query.where(
            buildCol({ e: TColEntry.ACCOUNT_NUMBER }),
            params.account
          );

        query
          .orderBy(buildCol({ e: TColEntry.NUMBER }), "desc")
          .limit(params.limit)
          .offset(params.offset)
          .toQuery();

        return of(query.toQuery());
      }),
      mergeMap((query: string) => this._mysql.query<EntryHeader>(query)),
      tag("EntryService | searchEntry")
    );
  }

  public getEntryDetail(number: number): Observable<EntryDetail> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([this._getAmountDetail(number), this._getBillDetail(number)])
      ),
      map(
        ([amountDetail, billDetail]: [
          EntryAmountDetail[],
          EntryBillDetail,
        ]) => ({
          billDetail,
          amountDetail,
        })
      ),
      tag("EntryService | getEntryDetail")
    );
  }

  public getContributionList(account: number): Observable<Contribution[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ e: TColEntry.DATE }),
              buildCol({ e: TColEntry.NUMBER }),
              buildCol({ d: TColDetail.VALUE })
            )
            .from({ d: TablesEnum.ENTRY_DETAIL })
            .innerJoin({ e: TablesEnum.ENTRY }, (builder) =>
              builder.on(
                buildCol({ e: TColEntry.NUMBER }),
                "=",
                buildCol({ d: TColDetail.ENTRY_NUMBER })
              )
            )
            .where(buildCol({ d: TColDetail.TYPE_ID }), 8)
            .where(buildCol({ e: TColEntry.ACCOUNT_NUMBER }), account)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Contribution>(query)),
      tag("EntryService | getContributionList")
    );
  }

  private _getAmountDetail(number: number): Observable<EntryAmountDetail[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ t: TColEntryType.DESCRIPTION }),
              buildCol({ d: TColDetail.VALUE })
            )
            .from({ t: TablesEnum.ENTRY_TYPE })
            .leftJoin({ d: TablesEnum.ENTRY_DETAIL }, (builder) =>
              builder
                .on(
                  buildCol({ d: TColDetail.TYPE_ID }),
                  "=",
                  buildCol({ t: TColEntryType.ID })
                )
                .andOn(
                  buildCol({ d: TColDetail.ENTRY_NUMBER }),
                  "=",
                  this._knex.raw("?", [number])
                )
            )
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<EntryAmountDetail>(query)),
      tag("EntryService | getAmountDetail")
    );
  }

  private _getBillDetail(number: number): Observable<EntryBillDetail> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ t: TColEntryBillDetail.CASH }),
              buildCol({ t: TColEntryBillDetail.TRANSFER })
            )
            .from({ t: TablesEnum.ENTRY_BILL_DETAIL })
            .where(buildCol({ t: TColEntryBillDetail.ENTRY_NUMBER }), number)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<EntryBillDetail>(query)),
      map((response: EntryBillDetail[]) => response[0]),
      tag("EntryService | _getBillDetail")
    );
  }

  private _saveEntryHead = (head: EntryHeader) => {
    return of(1).pipe(
      mergeMap(() =>
        of(this._knex.insert(head).into(TablesEnum.ENTRY).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("EntryService | _saveEntryHead")
    );
  };

  private _saveEntryBillDetail = (
    entryNumber: number,
    billDetail: EntryBillDetail
  ) => {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .insert({ entry_number: entryNumber, ...billDetail })
            .into(TablesEnum.ENTRY_BILL_DETAIL)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("EntryService | _saveEntryBillDetail")
    );
  };

  private _saveEntryDetail = (details: EntryAmountDetail[]) => {
    return of(1).pipe(
      switchMap(() => from(details)),
      mergeMap((detail: EntryAmountDetail) =>
        of(this._knex.insert(detail).into(TablesEnum.ENTRY_DETAIL).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      last(),
      tag("EntryService | _saveEntryDetail")
    );
  };

  private _calculateContributionAmount(
    account: number
  ): Observable<EntryAmount[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .sum(buildCol({ d: TColDetail.VALUE }, AliasEnum.TOTAL))
            .from({ d: TablesEnum.ENTRY_DETAIL })
            .innerJoin(
              { e: TablesEnum.ENTRY },
              buildCol({ d: TColDetail.ENTRY_NUMBER }),
              buildCol({ e: TColEntry.NUMBER })
            )
            .where(buildCol({ e: TColEntry.ACCOUNT_NUMBER }), account)
            .where(
              buildCol({ d: TColDetail.TYPE_ID }),
              EntryTypesIdEnum.CONTRIBUTION
            )
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Total>(query)),
      map((response: Total[]) => response[0][AliasEnum.TOTAL]),
      map((dbContribution: number) =>
        calculateContributionAmount(dbContribution)
      ),
      tag("EntryService | _calculateContributionAmount")
    );
  }

  private _calculateLoanAmount(account: number): Observable<EntryAmount[]> {
    return of(1).pipe(
      mergeMap(() => this._loanService.getLoanByAccount(account)),
      mergeMap((response: Loan | null) =>
        iif(
          () => response !== null,
          this._calculateIfLoanExist(response!),
          of([])
        )
      ),
      tag("EntryService | _calculateLoanAmount")
    );
  }

  private _calculateIfLoanExist(loan: Loan): Observable<EntryAmount[]> {
    return of(1).pipe(
      mergeMap(() => this._loanService.getLoanDetail(loan.number)),
      mergeMap((response: LoanDetail[]) =>
        iif(
          () => response.length > 0,
          of(calculateLoanAmount(loan, response)),
          of([])
        )
      ),
      tag("EntryService | _calculateIfLoanExist")
    );
  }
}
