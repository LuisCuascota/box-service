import { inject, injectable } from "inversify";
import {
  IPersonService,
  Person,
  PersonPagination,
} from "../repository/IPerson.service";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { map, mergeMap, Observable, of } from "rxjs";
import knex, { Knex } from "knex";
import {
  AliasEnum,
  buildCol,
  TablesEnum,
  TColAccount,
  TColPerson,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import QueryBuilder = Knex.QueryBuilder;
import { Counter } from "../repository/IEntry.service";

@injectable()
export class PersonService implements IPersonService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  constructor(@inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway) {
    this._mysql = mysql;
  }

  public getPersons(params?: PersonPagination): Observable<Person[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ a: TColAccount.NUMBER }),
              buildCol({ a: TColAccount.DNI }),
              buildCol({ p: TColPerson.NAMES }),
              buildCol({ p: TColPerson.SURNAMES }),
              buildCol({ p: TColPerson.BIRTH_DAY }),
              buildCol({ p: TColPerson.ADDRESS }),
              buildCol({ p: TColPerson.PHONE })
            )
            .from({ p: TablesEnum.PERSON })
            .innerJoin(
              { a: TablesEnum.ACCOUNT },
              buildCol({ p: TColPerson.DNI }),
              buildCol({ a: TColAccount.DNI })
            )
            .where(buildCol({ a: TColAccount.IS_DISABLED }), false)
            .orderBy(buildCol({ a: TColAccount.NUMBER }))
        )
      ),
      mergeMap((query: QueryBuilder) => {
        if (params) query.limit(params.limit).offset(params.offset);

        return of(query.toQuery());
      }),
      mergeMap((query: string) => this._mysql.query<Person>(query)),
      tag("PersonService | getPersons")
    );
  }

  public getPersonsCount(): Observable<number> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .count(buildCol({ a: TColAccount.NUMBER }, AliasEnum.COUNT))
            .from({ a: TablesEnum.ACCOUNT })
            .where(buildCol({ a: TColAccount.IS_DISABLED }), false)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Counter>(query)),
      map((response: Counter[]) => response[0][AliasEnum.COUNT]),
      tag("PersonService | getPersonsCount")
    );
  }

  public postNewPerson(person: Person): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() => this._savePerson(person)),
      mergeMap(() => this._createAccount(person)),
      map(() => true),
      tag("PersonService | postNewPerson")
    );
  }

  public updatePerson(dni: string, person: Person): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .update({
              [buildCol({ p: TColPerson.NAMES })]: person.names,
              [buildCol({ p: TColPerson.SURNAMES })]: person.surnames,
              [buildCol({ p: TColPerson.BIRTH_DAY })]: person.birth_day,
              [buildCol({ p: TColPerson.ADDRESS })]: person.address,
              [buildCol({ p: TColPerson.PHONE })]: person.phone,
            })
            .from({ p: TablesEnum.PERSON })
            .where(buildCol({ p: TColPerson.DNI }), dni)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<boolean>(query)),
      map(() => true),
      tag("PersonService | updatePerson")
    );
  }

  public deletePerson(account: number): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .update({
              [buildCol({ a: TColAccount.IS_DISABLED })]: true,
            })
            .from({ a: TablesEnum.ACCOUNT })
            .where(buildCol({ a: TColAccount.NUMBER }), account)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<boolean>(query)),
      map(() => true),
      tag("PersonService | deletePerson")
    );
  }

  private _savePerson = (person: Person) => {
    return of(1).pipe(
      mergeMap(() =>
        of(this._knex.insert(person).into(TablesEnum.PERSON).toQuery())
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("PersonService | _savePerson")
    );
  };

  private _createAccount = (person: Person) => {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .insert({ dni: person.dni })
            .into(TablesEnum.ACCOUNT)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query(query)),
      map(() => true),
      tag("PersonService | _createAccount")
    );
  };
}
