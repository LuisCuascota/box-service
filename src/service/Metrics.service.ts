import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { forkJoin, iif, map, mergeMap, Observable, of } from "rxjs";
import knex, { Knex } from "knex";
import {
  AliasEnum,
  buildCol,
  TablesEnum,
  TColDetail,
  TColEgress,
  TColEgressBillDetail,
  TColEntry,
  TColEntryBillDetail,
  TColLoanDetail,
  TColPeriodEntryType,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import {
  IMetricsService,
  Metrics,
  MetricsFilters,
  PeriodType,
  Sum,
  TypeMetric,
} from "../repository/IMetrics.service";
import QueryBuilder = Knex.QueryBuilder;
import { IBalanceService, Period } from "../repository/IBalance.service";
import { EntryType } from "../repository/IEntry.service";

@injectable()
export class MetricsService implements IMetricsService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  private readonly _balanceService: IBalanceService;

  constructor(
    @inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway,
    @inject(IDENTIFIERS.BalanceService) balanceService: IBalanceService
  ) {
    this._mysql = mysql;
    this._balanceService = balanceService;
  }

  public getMetrics(params: MetricsFilters): Observable<Metrics> {
    return of(1).pipe(
      mergeMap(() =>
        this._balanceService.getPeriodList({ period: params.period })
      ),
      mergeMap((period: Period[]) =>
        forkJoin([
          this._getTotalAmountByParams(
            TablesEnum.ENTRY_BILL_DETAIL,
            TColEntryBillDetail.TRANSFER,
            params
          ),
          this._getTotalAmountByParams(
            TablesEnum.EGRESS_BILL_DETAIL,
            TColEgressBillDetail.TRANSFER,
            params
          ),
          this._getTotalAmountByParams(
            TablesEnum.ENTRY_BILL_DETAIL,
            TColEntryBillDetail.CASH,
            params
          ),
          this._getTotalAmountByParams(
            TablesEnum.EGRESS_BILL_DETAIL,
            TColEgressBillDetail.CASH,
            params
          ),
          this._getTotalLoanDispatched(),
          of(period[0]),
        ])
      ),
      map(
        ([
          entryTransfer,
          egressTransfer,
          entryCash,
          egressCash,
          totalLoan,
          period,
        ]: [number, number, number, number, number, Period]) => ({
          total: +(
            entryTransfer +
            entryCash +
            period.init_cash +
            period.init_transfer -
            (egressTransfer + egressCash)
          ).toFixed(2),
          cashTotal: +(entryCash + period.init_cash - egressCash).toFixed(2),
          transferTotal: +(
            entryTransfer +
            period.init_transfer -
            egressTransfer
          ).toFixed(2),
          loanTotalDispatched: +totalLoan.toFixed(2),
        })
      ),
      tag("MetricsService | getMetrics")
    );
  }

  public getTypesMetrics(params?: MetricsFilters): Observable<TypeMetric[]> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([
          this._getEntryTypes(),
          this._getTotalEntryTypeByParams(params),
          this._getTotalEgressTypeByParams(params),
          iif(
            () => !!params?.period,
            this._getPeriodHistoricTypesValue(params),
            of([])
          ),
        ])
      ),
      map(
        ([types, entries, egress, historic]: [
          TypeMetric[],
          TypeMetric[],
          TypeMetric[],
          PeriodType[],
        ]) => {
          entries.map((entry: TypeMetric) => {
            const type = types.find((type) => type.id === entry.id);

            if (type) type.sum += entry.sum;
          });
          egress.map((egress: TypeMetric) => {
            const type = types.find((type) => type.id === egress.id);

            if (type) type.sum -= egress.sum;
          });
          historic.map((historic: PeriodType) => {
            const type = types.find((type) => type.id === historic.type_id);

            if (type) type.sum += historic.start_amount;
          });

          types.map((type: TypeMetric) => (type.sum = +type.sum.toFixed(2)));

          return types;
        }
      ),
      tag("MetricsService | getTypesMetrics")
    );
  }

  private _getTotalAmountByParams(
    table: TablesEnum,
    column: string,
    params: MetricsFilters
  ): Observable<number> {
    return of(1).pipe(
      map(() =>
        this._knex
          .sum(buildCol({ t: column }, AliasEnum.SUM))
          .from({ t: table })
      ),
      map((query: QueryBuilder) => {
        if (params && params.period)
          query.where(buildCol({ t: TColEntry.PERIOD }), params.period);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<Sum>(query)),
      map((response: Sum[]) => response[0][AliasEnum.SUM]),
      tag("MetricsService | _getTotalAmountByParams")
    );
  }

  private _getTotalLoanDispatched(): Observable<number> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .sum(buildCol({ l: TColLoanDetail.FEE_VALUE }, AliasEnum.SUM))
            .from({ l: TablesEnum.LOAN_DETAIL })
            .where(buildCol({ l: TColLoanDetail.IS_PAID }), false)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Sum>(query)),
      map((response: Sum[]) => response[0][AliasEnum.SUM]),
      tag("MetricsService | _getTotalAmountByParams")
    );
  }

  private _getTotalEntryTypeByParams(
    params?: MetricsFilters
  ): Observable<TypeMetric[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select(buildCol({ d: TColDetail.TYPE_ID }, AliasEnum.ID))
          .sum(buildCol({ d: TColDetail.VALUE }, AliasEnum.SUM))
          .from({ d: TablesEnum.ENTRY_DETAIL })
          .innerJoin(
            { e: TablesEnum.ENTRY },
            buildCol({ d: TColDetail.ENTRY_NUMBER }),
            buildCol({ e: TColEntry.NUMBER })
          )
      ),
      map((query: QueryBuilder) => {
        if (params && params.period)
          query.where(buildCol({ e: TColEntry.PERIOD }), params.period);

        query.groupBy(buildCol({ d: TColDetail.TYPE_ID }));

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<TypeMetric>(query)),
      tag("MetricsService | _getTotalEntryTypeByParams")
    );
  }

  private _getTotalEgressTypeByParams(
    params?: MetricsFilters
  ): Observable<TypeMetric[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select(buildCol({ e: TColEgress.TYPE_ID }, AliasEnum.ID))
          .sum(buildCol({ e: TColEgress.AMOUNT }, AliasEnum.SUM))
          .from({ e: TablesEnum.EGRESS })
      ),
      map((query: QueryBuilder) => {
        if (params && params.period)
          query.where(buildCol({ e: TColEgress.PERIOD }), params.period);

        query.groupBy(buildCol({ e: TColEgress.TYPE_ID }));

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<TypeMetric>(query)),
      tag("MetricsService | _getTotalEgressTypeByParams")
    );
  }

  private _getPeriodHistoricTypesValue(
    params?: MetricsFilters
  ): Observable<PeriodType[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select()
          .from({ e: TablesEnum.PERIOD_ENTRY_TYPE })
          .where(buildCol({ e: TColPeriodEntryType.PERIOD_ID }), params?.period)
          .toQuery()
      ),
      mergeMap((query: string) => this._mysql.query<PeriodType>(query)),
      tag("MetricsService | _getPeriodHistoricTypesValue")
    );
  }

  private _getEntryTypes(): Observable<TypeMetric[]> {
    return of(1).pipe(
      map(() =>
        this._knex.select().from({ e: TablesEnum.ENTRY_TYPE }).toQuery()
      ),
      mergeMap((query: string) => this._mysql.query<EntryType>(query)),
      map((types: EntryType[]) =>
        types.map((type: EntryType) => ({
          id: type.id,
          description: type.description,
          sum: 0,
        }))
      ),
      tag("MetricsService | _getEntryTypes")
    );
  }
}
