import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { forkJoin, map, mergeMap, Observable, of } from "rxjs";
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
  TColEntryType,
  TColLoanDetail,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import {
  IMetricsService,
  Metrics,
  Sum,
  TypeMetric,
} from "../repository/IMetrics.service";

@injectable()
export class MetricsService implements IMetricsService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getMetrics(): Observable<Metrics> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([
          this._getTotalAmountByParams(
            TablesEnum.ENTRY_BILL_DETAIL,
            TColEntryBillDetail.TRANSFER
          ),
          this._getTotalAmountByParams(
            TablesEnum.EGRESS_BILL_DETAIL,
            TColEgressBillDetail.TRANSFER
          ),
          this._getTotalAmountByParams(
            TablesEnum.ENTRY_BILL_DETAIL,
            TColEntryBillDetail.CASH
          ),
          this._getTotalAmountByParams(
            TablesEnum.EGRESS_BILL_DETAIL,
            TColEgressBillDetail.CASH
          ),
          this._getTotalLoanDispatched(),
        ])
      ),
      map(
        ([entryTransfer, egressTransfer, entryCash, egressCash, totalLoan]: [
          number,
          number,
          number,
          number,
          number,
        ]) => ({
          total: +(
            entryTransfer +
            entryCash -
            (egressTransfer + egressCash)
          ).toFixed(2),
          cashTotal: +(entryCash - egressCash).toFixed(2),
          transferTotal: +(entryTransfer - egressTransfer).toFixed(2),
          loanTotalDispatched: +totalLoan.toFixed(2),
        })
      ),
      tag("MetricsService | getMetrics")
    );
  }

  public getTypesMetrics(): Observable<TypeMetric[]> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([
          this._getTotalTypeByParams(TablesEnum.ENTRY_DETAIL, TColDetail.VALUE),
          this._getTotalTypeByParams(TablesEnum.EGRESS, TColEgress.AMOUNT),
        ])
      ),
      map(([entryTypes, egressTypes]: [TypeMetric[], TypeMetric[]]) => {
        const dictionaryEgress: { [id: number]: number } = {};

        egressTypes.forEach((type) => {
          dictionaryEgress[type.id] = +type.sum.toFixed(2);
        });

        entryTypes.forEach((type) => {
          if (dictionaryEgress[type.id] !== undefined) {
            type.sum = +(type.sum - dictionaryEgress[type.id]).toFixed(2);
          } else type.sum = +type.sum.toFixed(2);
        });

        return entryTypes;
      }),
      tag("MetricsService | getTypesMetrics")
    );
  }

  private _getTotalAmountByParams(
    table: TablesEnum,
    column: string
  ): Observable<number> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .sum(buildCol({ t: column }, AliasEnum.SUM))
            .from({ t: table })
            .toQuery()
        )
      ),
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

  private _getTotalTypeByParams(
    table: TablesEnum,
    column: string
  ): Observable<TypeMetric[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ t: TColEntryType.ID }),
              buildCol({ t: TColEntryType.DESCRIPTION })
            )
            .sum(buildCol({ e: column }, AliasEnum.SUM))
            .from({ e: table })
            .innerJoin(
              { t: TablesEnum.ENTRY_TYPE },
              buildCol({ t: TColEntryType.ID }),
              buildCol({ e: TColDetail.TYPE_ID })
            )
            .groupBy(buildCol({ e: TColDetail.TYPE_ID }))
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<TypeMetric>(query)),
      tag("MetricsService | _getTotalTypeByParams")
    );
  }
}
