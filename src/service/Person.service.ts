import { inject, injectable } from "inversify";
import {
  Account,
  IPersonService,
  ModePagination,
  Person,
  PersonPagination,
} from "../repository/IPerson.service";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  concatMap,
  from,
  iif,
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
  TColAccount,
  TColPerson,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/operators";
import { Contribution, EntryCounter } from "../repository/IEntry.service";
import {
  getContributionListQuery,
  updateLoanStatus,
  updateSavingStatus,
} from "../utils/Common.utils";
import moment from "moment";
import QueryBuilder = Knex.QueryBuilder;
import { ILoanService, Loan } from "../repository/ILoan.service";

@injectable()
export class PersonService implements IPersonService {
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

  public getPersons(params?: PersonPagination): Observable<Person[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select(
            buildCol({ a: TColAccount.NUMBER }),
            buildCol({ a: TColAccount.DNI }),
            buildCol({ a: TColAccount.CURRENT_SAVING }),
            buildCol({ a: TColAccount.CREATION_DATE }),
            buildCol({ a: TColAccount.START_AMOUNT }),
            buildCol({ p: TColPerson.NAMES }),
            buildCol({ p: TColPerson.SURNAMES }),
            buildCol({ p: TColPerson.BIRTH_DAY }),
            buildCol({ p: TColPerson.ADDRESS }),
            buildCol({ p: TColPerson.PHONE }),
            buildCol({ a: TColAccount.IS_DISABLED })
          )
          .from({ p: TablesEnum.PERSON })
          .innerJoin(
            { a: TablesEnum.ACCOUNT },
            buildCol({ p: TColPerson.DNI }),
            buildCol({ a: TColAccount.DNI })
          )
      ),
      map((query: QueryBuilder) => {
        if (params && params.mode && params.mode === ModePagination.ACTIVE_ONLY)
          query.where(buildCol({ a: TColAccount.IS_DISABLED }), false);

        query.orderBy(buildCol({ a: TColAccount.NUMBER }));

        if (params && params.limit && params.offset)
          query.limit(params.limit).offset(params.offset);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<Person>(query)),
      mergeMap((personList: Person[]) =>
        iif(
          () =>
            (params &&
              params.mode &&
              params.mode === ModePagination.FULL) as boolean,
          this._setAccountStatus(personList),
          of(personList)
        )
      ),
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
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<EntryCounter>(query)),
      map((response: EntryCounter[]) => response[0][AliasEnum.COUNT]),
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

  public getAccount(account: number): Observable<Account> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ a: TColAccount.NUMBER }),
              buildCol({ a: TColAccount.CREATION_DATE }),
              buildCol({ a: TColAccount.START_AMOUNT }),
              buildCol({ a: TColAccount.CURRENT_SAVING })
            )
            .from({ a: TablesEnum.ACCOUNT })
            .where(buildCol({ a: TColAccount.NUMBER }), account)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<Account>(query)),
      map((response: Account[]) => response[0]),
      tag("PersonService | getAccount")
    );
  }

  public updateAccountSaving(
    account: number,
    currentSaving: number,
    entryAmount: number
  ): Observable<boolean> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .update({
              [buildCol({ a: TColAccount.CURRENT_SAVING })]: (
                currentSaving + entryAmount
              ).toFixed(2),
            })
            .from({ a: TablesEnum.ACCOUNT })
            .where(buildCol({ a: TColAccount.NUMBER }), account)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<boolean>(query)),
      map(() => true),
      tag("PersonService | updateAccountSaving")
    );
  }

  private _setAccountStatus = (accountList: Person[]): Observable<Person[]> => {
    return from(accountList).pipe(
      concatMap((person: Person) => this._updateSavingStatus(person)),
      concatMap((person: Person) => this._updateLoanStatus(person)),
      toArray()
    );
  };

  private _updateLoanStatus(person: Person): Observable<Person> {
    return of(1).pipe(
      mergeMap(() => this._loanService.searchLoan({ account: person.number })),
      map((loanList: Loan[]) => {
        person.loanCount = loanList.length;

        return updateLoanStatus(loanList);
      }),
      map((loanStatus: string) => {
        person.loanStatus = loanStatus;

        return person;
      })
    );
  }

  private _updateSavingStatus(person: Person): Observable<Person> {
    return of(1).pipe(
      mergeMap(() => updateSavingStatus(person)),
      mergeMap(() =>
        getContributionListQuery(this._knex, person.number!, [11])
      ),
      mergeMap((query: string) => this._mysql.query<Contribution>(query)),
      map((contributionList: Contribution[]) => {
        person.current_saving += contributionList.reduce(
          (sum, contribution) => sum + contribution.value,
          0
        );

        return person;
      })
    );
  }

  private _savePerson = (person: Person) => {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .insert({
              dni: person.dni,
              names: person.names,
              surnames: person.surnames,
              birth_day: person.birth_day,
              address: person.address,
              phone: person.phone,
            })
            .into(TablesEnum.PERSON)
            .toQuery()
        )
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
            .insert({
              dni: person.dni,
              start_amount: person.start_amount,
              current_saving: person.start_amount,
              creation_date: moment().format("YYYY-MM-DD").toString(),
            })
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
