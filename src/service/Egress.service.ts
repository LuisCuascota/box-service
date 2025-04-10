import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  concatMap,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  toArray,
} from "rxjs";
import knex, { Knex } from "knex";
import {
  AliasEnum,
  buildCol,
  TablesEnum,
  TColEgress,
  TColEgressBillDetail,
  TColEgressDetail,
  TColEntry,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import {
  EgressAmountDetail,
  EgressBillDetail,
  EgressCounter,
  EgressCountFilter,
  EgressDetail,
  EgressHeader,
  EgressPagination,
  IEgressService,
  NewEgress,
} from "../repository/IEgress.service";
import { updateEntryEgressStatus } from "../utils/Common.utils";
import QueryBuilder = Knex.QueryBuilder;
import { EntryBillTypeEnum } from "../infraestructure/RegistryStatusEnum";

@injectable()
export class EgressService implements IEgressService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;

  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getEgressCount(params?: EgressCountFilter): Observable<EgressCounter> {
    return of(1).pipe(
      map(() =>
        this._knex
          .count(buildCol({ e: TColEgress.NUMBER }, AliasEnum.COUNT))
          .sum(buildCol({ d: TColEgressBillDetail.CASH }, AliasEnum.CASH))
          .sum(
            buildCol({ d: TColEgressBillDetail.TRANSFER }, AliasEnum.TRANSFER)
          )
          .sum(buildCol({ e: TColEgress.AMOUNT }, AliasEnum.TOTAL))

          .from({ e: TablesEnum.EGRESS })
          .innerJoin(
            { d: TablesEnum.EGRESS_BILL_DETAIL },
            buildCol({ e: TColEgress.NUMBER }),
            buildCol({ d: TColEgressBillDetail.EGRESS_NUMBER })
          )
      ),
      map((query: QueryBuilder) => {
        this._buildEgressFilters(query, params);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<EgressCounter>(query)),
      map((response: EgressCounter[]) => ({
        count: response[0][AliasEnum.COUNT] ?? 0,
        cash: response[0][AliasEnum.CASH] ?? 0,
        transfer: response[0][AliasEnum.TRANSFER] ?? 0,
        total: response[0][AliasEnum.TOTAL] ?? 0,
      })),
      tag("EgressService | getEgressCount")
    );
  }

  public postNewEgress(newEgress: NewEgress): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() => this._saveEgressHead(newEgress.header)),
      mergeMap(() => this._saveEgressDetail(newEgress.detail)),
      mergeMap(() =>
        this._saveEgressBillDetail(newEgress.header.number, {
          ...newEgress.billDetail,
          date: newEgress.header.date,
          period_id: newEgress.header.period_id,
        })
      ),
      map(() => true),
      tag("EgressService | postNewEgress")
    );
  }

  public searchEgress(params: EgressPagination): Observable<EgressHeader[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select(
            buildCol({ e: TColEgress.NUMBER }),
            buildCol({ e: TColEgress.DATE }),
            buildCol({ e: TColEgress.PLACE }),
            buildCol({ e: TColEgress.AMOUNT }),
            buildCol({ e: TColEgress.BENEFICIARY }),
            buildCol({ d: TColEgressBillDetail.CASH }),
            buildCol({ d: TColEgressBillDetail.TRANSFER })
          )
          .from({ e: TablesEnum.EGRESS })
          .innerJoin(
            { d: TablesEnum.EGRESS_BILL_DETAIL },
            buildCol({ e: TColEgress.NUMBER }),
            buildCol({ d: TColEgressBillDetail.EGRESS_NUMBER })
          )
      ),
      map((query: QueryBuilder) => {
        this._buildEgressFilters(query, params);

        query
          .orderBy(buildCol({ e: TColEgress.NUMBER }), "desc")
          .limit(params.limit)
          .offset(params.offset);

        return query.toQuery();
      }),

      mergeMap((query: string) => this._mysql.query<EgressHeader>(query)),
      mergeMap((egressList: EgressHeader[]) =>
        this._setEgressStatus(egressList)
      ),
      tag("EgressService | searchEgress")
    );
  }

  private _setEgressStatus = (
    egressList: EgressHeader[]
  ): Observable<EgressHeader[]> => {
    return from(egressList).pipe(
      concatMap(
        (egress: EgressHeader) =>
          updateEntryEgressStatus(egress) as Observable<EgressHeader>
      ),
      toArray()
    );
  };

  public getEgressDetail(number: number): Observable<EgressDetail> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([this._getAmountDetail(number), this._getBillDetail(number)])
      ),
      map(
        ([amountDetail, billDetail]: [
          EgressAmountDetail[],
          EgressBillDetail,
        ]) => ({
          billDetail,
          amountDetail,
        })
      ),
      tag("EgressService | getEgressDetail")
    );
  }

  private _buildEgressFilters(
    query: QueryBuilder,
    params?: EgressPagination | EgressCountFilter
  ) {
    if (params && params.period)
      query.where(buildCol({ e: TColEntry.PERIOD }), params.period);

    if (params && params.type)
      query.where(buildCol({ e: TColEgress.TYPE_ID }), params.type);

    if (params && params.startDate)
      query.where(buildCol({ e: TColEgress.DATE }), ">=", params.startDate);

    if (params && params.endDate)
      query.where(buildCol({ e: TColEgress.DATE }), "<=", params.endDate);

    if (
      params &&
      params.paymentType &&
      params.paymentType === EntryBillTypeEnum.MIXED
    ) {
      query.where(buildCol({ d: TColEgressBillDetail.CASH }), ">", 0);
      query.where(buildCol({ d: TColEgressBillDetail.TRANSFER }), ">", 0);
    }

    if (
      params &&
      params.paymentType &&
      params.paymentType === EntryBillTypeEnum.CASH
    ) {
      query.where(buildCol({ d: TColEgressBillDetail.CASH }), ">", 0);
    }

    if (
      params &&
      params.paymentType &&
      params.paymentType === EntryBillTypeEnum.TRANSFER
    ) {
      query.where(buildCol({ d: TColEgressBillDetail.TRANSFER }), ">", 0);
    }
  }

  private _getAmountDetail(number: number): Observable<EgressAmountDetail[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ d: TColEgressDetail.DESCRIPTION }),
              buildCol({ d: TColEgressDetail.DISCHARGE_NUMBER }),
              buildCol({ d: TColEgressDetail.VALUE })
            )
            .from({ d: TablesEnum.EGRESS_DETAIL })
            .where(buildCol({ d: TColEgressDetail.DISCHARGE_NUMBER }), number)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<EgressAmountDetail>(query)),
      tag("EgressService | _getAmountDetail")
    );
  }

  private _getBillDetail(number: number): Observable<EgressBillDetail> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ t: TColEgressBillDetail.CASH }),
              buildCol({ t: TColEgressBillDetail.TRANSFER })
            )
            .from({ t: TablesEnum.EGRESS_BILL_DETAIL })
            .where(buildCol({ t: TColEgressBillDetail.EGRESS_NUMBER }), number)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<EgressBillDetail>(query)),
      map((response: EgressBillDetail[]) => response[0]),
      tag("EgressService | _getBillDetail")
    );
  }

  private _saveEgressHead = (head: EgressHeader) => {
    return of(1).pipe(
      mergeMap(() =>
        of(this._knex.insert(head).into(TablesEnum.EGRESS).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("EgressService | _saveEgressHead")
    );
  };

  private _saveEgressDetail = (details: EgressDetail[]) => {
    return from(details).pipe(
      mergeMap((detail: EgressDetail) =>
        of(this._knex.insert(detail).into(TablesEnum.EGRESS_DETAIL).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("EgressService | _saveEgressDetail")
    );
  };

  private _saveEgressBillDetail = (
    egressNumber: number,
    billDetail: EgressBillDetail
  ) => {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .insert({ discharge_number: egressNumber, ...billDetail })
            .into(TablesEnum.EGRESS_BILL_DETAIL)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("EgressService | _saveEgressBillDetail")
    );
  };
}
