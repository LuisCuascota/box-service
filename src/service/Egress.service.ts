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
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import { Counter } from "../repository/IEntry.service";
import {
  EgressAmountDetail,
  EgressBillDetail,
  EgressDetail,
  EgressHeader,
  EgressPagination,
  IEgressService,
  NewEgress,
} from "../repository/IEgress.service";
import { updateEntryEgressStatus } from "../utils/Common.utils";

@injectable()
export class EgressService implements IEgressService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;

  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getEgressCount(): Observable<number> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .count(buildCol({ e: TColEgress.NUMBER }, AliasEnum.COUNT))
            .from({ e: TablesEnum.EGRESS })
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Counter>(query)),
      map((response: Counter[]) => response[0][AliasEnum.COUNT]),
      tag("EgressService | getEgressCount")
    );
  }

  public postNewEgress(newEgress: NewEgress): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() => this._saveEgressHead(newEgress.header)),
      mergeMap(() => this._saveEgressDetail(newEgress.detail)),
      mergeMap(() =>
        this._saveEgressBillDetail(
          newEgress.header.number,
          newEgress.billDetail
        )
      ),
      map(() => true),
      tag("EgressService | postNewEgress")
    );
  }

  public searchEgress(params: EgressPagination): Observable<EgressHeader[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ e: TColEgress.NUMBER }),
              buildCol({ e: TColEgress.DATE }),
              buildCol({ e: TColEgress.PLACE }),
              buildCol({ e: TColEgress.AMOUNT }),
              buildCol({ e: TColEgress.BENEFICIARY }),
              buildCol({ b: TColEgressBillDetail.CASH }),
              buildCol({ b: TColEgressBillDetail.TRANSFER })
            )
            .from({ e: TablesEnum.EGRESS })
            .innerJoin(
              { b: TablesEnum.EGRESS_BILL_DETAIL },
              buildCol({ e: TColEgress.NUMBER }),
              buildCol({ b: TColEgressBillDetail.EGRESS_NUMBER })
            )
            .orderBy(buildCol({ e: TColEgress.NUMBER }), "desc")
            .limit(params.limit)
            .offset(params.offset)
            .toQuery()
        )
      ),
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
