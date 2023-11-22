import { inject, injectable } from "inversify";
import { IPersonService, Person } from "../repository/IPerson.service";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { mergeMap, Observable, of } from "rxjs";
import knex, { Knex } from "knex";
import {
  buildCol,
  TablesEnum,
  TColAccount,
  TColPerson,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";

@injectable()
export class PersonService implements IPersonService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getPersons(): Observable<Person[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ a: TColAccount.NUMBER }),
              buildCol({ a: TColAccount.DNI }),
              buildCol({ p: TColPerson.NAMES }),
              buildCol({ p: TColPerson.SURNAMES })
            )
            .from({ p: TablesEnum.PERSON })
            .innerJoin(
              { a: TablesEnum.ACCOUNT },
              buildCol({ p: TColPerson.DNI }),
              buildCol({ a: TColAccount.DNI })
            )
            .orderBy(buildCol({ a: TColAccount.NUMBER }))
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Person>(query)),
      tag("PersonService | getPersons")
    );
  }
}
