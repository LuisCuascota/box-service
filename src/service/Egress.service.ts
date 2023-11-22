import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { from, map, mergeMap, Observable, of, tap } from "rxjs";
import knex, { Knex } from "knex";
import {
  AliasEnum,
  buildCol,
  TablesEnum,
  TColEgress,
  TColEgressDetail,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import { Counter } from "../repository/IEntry.service";
import {
  EgressDetail,
  EgressHeader,
  EgressPagination,
  IEgressService,
  NewEgress,
} from "../repository/IEgress.service";

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
              buildCol({ e: TColEgress.IS_TRANSFER })
            )
            .from({ e: TablesEnum.EGRESS })
            .orderBy(buildCol({ e: TColEgress.NUMBER }), "desc")
            .limit(params.limit)
            .offset(params.offset)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<EgressHeader>(query)),
      tag("EgressService | searchEgress")
    );
  }

  public getEgressDetail(number: number): Observable<EgressDetail[]> {
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
      mergeMap((query: string) => this._mysql.query<EgressDetail>(query)),
      tag("EgressService | getEgressDetail")
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
}
