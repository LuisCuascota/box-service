import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  concatMap,
  forkJoin,
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
  TColDetail,
  TColEntry,
  TColEntryBillDetail,
  TColEntryType,
  TColPerson,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import {
  Contribution,
  EntryCounter,
  CountFilter,
  EntryAmount,
  EntryAmountDetail,
  EntryBillDetail,
  EntryDetail,
  EntryHeader,
  EntryPagination,
  EntryType,
  IEntryService,
  NewEntry,
} from "../repository/IEntry.service";
import {
  calculateContributionAmount,
  calculateLoanAmount,
} from "../utils/Entry.utils";
import { ILoanService, Loan, LoanDetail } from "../repository/ILoan.service";
import { updateEntryEgressStatus } from "../utils/Common.utils";
import { Account, IPersonService } from "../repository/IPerson.service";
import { EntryTypesIdEnum } from "../infraestructure/entryTypes.enum";
import { EntryBillTypeEnum } from "../infraestructure/RegistryStatusEnum";
import QueryBuilder = Knex.QueryBuilder;

@injectable()
export class EntryService implements IEntryService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  private readonly _loanService: ILoanService;
  private readonly _personService: IPersonService;

  constructor(
    @inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway,
    @inject(IDENTIFIERS.LoanService) loanService: ILoanService,
    @inject(IDENTIFIERS.PersonService) personService: IPersonService
  ) {
    this._mysql = mysql;
    this._loanService = loanService;
    this._personService = personService;
  }

  public getEntryCount(params?: CountFilter): Observable<EntryCounter> {
    return of(1).pipe(
      map(() =>
        this._knex
          .count(buildCol({ e: TColEntry.NUMBER }, AliasEnum.COUNT))
          .sum(buildCol({ d: TColEntryBillDetail.CASH }, AliasEnum.CASH))
          .sum(
            buildCol({ d: TColEntryBillDetail.TRANSFER }, AliasEnum.TRANSFER)
          )
          .sum(buildCol({ e: TColEntry.AMOUNT }, AliasEnum.TOTAL))
          .from({ e: TablesEnum.ENTRY })
          .innerJoin(
            { d: TablesEnum.ENTRY_BILL_DETAIL },
            buildCol({ e: TColEntry.NUMBER }),
            buildCol({ d: TColEntryBillDetail.ENTRY_NUMBER })
          )
      ),
      map((query: QueryBuilder) => {
        this._buildEntryFilters(query, params);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<EntryCounter>(query)),
      map((response: EntryCounter[]) => ({
        count: response[0][AliasEnum.COUNT] ?? 0,
        cash: response[0][AliasEnum.CASH] ?? 0,
        transfer: response[0][AliasEnum.TRANSFER] ?? 0,
        total: response[0][AliasEnum.TOTAL] ?? 0,
      })),
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
      mergeMap(() =>
        this._saveEntryDetail(newEntry.detail, newEntry.header.account_number)
      ),
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
        if (newEntry.entryLoanData)
          return this._loanService.updateLoanHead(newEntry.entryLoanData);

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
              buildCol({ p: TColPerson.SURNAMES }),
              buildCol({ d: TColEntryBillDetail.CASH }),
              buildCol({ d: TColEntryBillDetail.TRANSFER })
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
            .innerJoin(
              { d: TablesEnum.ENTRY_BILL_DETAIL },
              buildCol({ e: TColEntry.NUMBER }),
              buildCol({ d: TColEntryBillDetail.ENTRY_NUMBER })
            )
        )
      ),
      map((query: QueryBuilder) => {
        this._buildEntryFilters(query, params);
        query
          .orderBy(buildCol({ e: TColEntry.NUMBER }), "desc")
          .limit(params.limit)
          .offset(params.offset);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<EntryHeader>(query)),
      mergeMap((entryList: EntryHeader[]) => this._setEntryStatus(entryList)),
      tag("EntryService | searchEntry")
    );
  }

  private _setEntryStatus = (
    entryList: EntryHeader[]
  ): Observable<EntryHeader[]> => {
    return from(entryList).pipe(
      concatMap(
        (entry: EntryHeader) =>
          updateEntryEgressStatus(entry) as Observable<EntryHeader>
      ),
      toArray()
    );
  };

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

  private _buildEntryFilters(
    query: QueryBuilder,
    params?: EntryPagination | CountFilter
  ) {
    if (params && params.account)
      query.where(buildCol({ e: TColEntry.ACCOUNT_NUMBER }), params.account);

    if (params && params.startDate)
      query.where(buildCol({ e: TColEntry.DATE }), ">=", params.startDate);

    if (params && params.endDate)
      query.where(buildCol({ e: TColEntry.DATE }), "<=", params.endDate);

    if (
      params &&
      params.paymentType &&
      params.paymentType === EntryBillTypeEnum.MIXED
    ) {
      query.where(buildCol({ d: TColEntryBillDetail.CASH }), ">", 0);
      query.where(buildCol({ d: TColEntryBillDetail.TRANSFER }), ">", 0);
    }

    if (
      params &&
      params.paymentType &&
      params.paymentType === EntryBillTypeEnum.CASH
    ) {
      query.where(buildCol({ d: TColEntryBillDetail.CASH }), ">", 0);
    }

    if (
      params &&
      params.paymentType &&
      params.paymentType === EntryBillTypeEnum.TRANSFER
    ) {
      query.where(buildCol({ d: TColEntryBillDetail.TRANSFER }), ">", 0);
    }
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

  private _saveEntryDetail = (
    details: EntryAmountDetail[],
    account: number
  ) => {
    return of(1).pipe(
      switchMap(() => from(details)),
      mergeMap((detail: EntryAmountDetail) =>
        iif(
          () => detail.type_id === EntryTypesIdEnum.CONTRIBUTION,
          this._updateAccountContribution(detail, account),
          of(detail)
        )
      ),
      mergeMap((detail: EntryAmountDetail) =>
        of(
          this._knex
            .insert({
              entry_number: detail.entry_number,
              type_id: detail.type_id,
              value: detail.value,
            })
            .into(TablesEnum.ENTRY_DETAIL)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      last(),
      tag("EntryService | _saveEntryDetail")
    );
  };

  private _updateAccountContribution(
    detail: EntryAmountDetail,
    account: number
  ): Observable<EntryAmountDetail> {
    return of(1).pipe(
      mergeMap(() =>
        this._personService.updateAccountSaving(
          account,
          detail.currentSaving!,
          detail.value
        )
      ),
      map(() => detail),
      tag("EntryService | _updateAccountContribution")
    );
  }

  private _calculateContributionAmount(
    account: number
  ): Observable<EntryAmount[]> {
    return of(1).pipe(
      mergeMap(() => this._personService.getAccount(account)),
      map((account: Account) => calculateContributionAmount(account)),
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
