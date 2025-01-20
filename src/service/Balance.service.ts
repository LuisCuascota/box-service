import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { forkJoin, map, mergeMap, Observable, of } from "rxjs";
import knex, { Knex } from "knex";
import { tag } from "rxjs-spy/operators";
import {
  IBalanceService,
  PartnerBalance,
  PartnerEntry,
} from "../repository/IBalance.service";
import {
  IPersonService,
  ModePagination,
  Person,
} from "../repository/IPerson.service";
import {
  buildCol,
  TablesEnum,
  TColDetail,
  TColEntry,
} from "../infraestructure/Tables.enum";
import moment from "moment/moment";

@injectable()
export class BalanceService implements IBalanceService {
  private readonly _knex: Knex = knex({ client: "mysql" });
  private readonly _mysql: IMySQLGateway;
  private readonly _personService: IPersonService;

  constructor(
    @inject(IDENTIFIERS.MySQLGateway) mysql: IMySQLGateway,
    @inject(IDENTIFIERS.PersonService) personService: IPersonService
  ) {
    this._mysql = mysql;
    this._personService = personService;
  }

  public getPartnerBalance(): Observable<PartnerBalance[]> {
    return of(1).pipe(
      mergeMap(() =>
        forkJoin([
          this._personService.getPersons({ mode: ModePagination.ACTIVE_ONLY }),
          this._getEntries(),
        ])
      ),
      map(([person, entries]: [Person[], object[]]) =>
        this._mapHistoricPartnersData(person, entries)
      ),
      tag("BalanceService | getPartnerBalance")
    );
  }

  private _getEntries(): Observable<object[]> {
    return of(1).pipe(
      mergeMap(() =>
        of(
          this._knex
            .select(
              buildCol({ e: TColEntry.NUMBER }),
              buildCol({ e: TColEntry.ACCOUNT_NUMBER }),
              buildCol({ e: TColEntry.DATE }),
              buildCol({ d: TColDetail.VALUE })
            )
            .from({ e: TablesEnum.ENTRY })
            .innerJoin(
              { d: TablesEnum.ENTRY_DETAIL },
              buildCol({ e: TColEntry.NUMBER }),
              buildCol({ d: TColDetail.ENTRY_NUMBER })
            )
            .where(buildCol({ d: TColDetail.TYPE_ID }), 8)
            .toQuery()
        )
      ),
      mergeMap((query: string) => this._mysql.query<object>(query))
    );
  }

  private _mapHistoricPartnersData(
    person: Person[],
    entries: object[]
  ): PartnerBalance[] {
    let totalParticipationRate = 0;

    const initialHistoric = person.map((person: Person) => {
      const partnerEntries = entries.filter(
        (entry) => entry.account_number === person.number
      );
      const entriesBuild = this._buildHistoricEntries(partnerEntries);
      const participationRate = entriesBuild.reduce(
        (sum, entry) => sum + entry.value * entry.monthCount,
        0
      );

      totalParticipationRate += participationRate;

      return {
        account: person.number!,
        names: `${person.names} ${person.surnames}`,
        currentSaving: person.current_saving,
        entries: entriesBuild,
        participationRate,
      };
    });

    return initialHistoric.map((balace: PartnerBalance) => ({
      ...balace,
      participationPercentage:
        balace.participationRate / totalParticipationRate,
    }));
  }

  private _buildHistoricEntries(entries: object[]) {
    const monthCount = this._calculateHistoricMonthsCount();

    const historicEntries: PartnerEntry[] = this._createEmptyHistoric(
      monthCount
    ).map((entry, index) => {
      const historicDate = moment()
        .subtract(monthCount - index - 1, "months")
        .startOf("month");
      const value = entries
        .filter(
          (entry) =>
            moment(entry.date).month() === historicDate.month() &&
            moment(entry.date).year() === historicDate.year()
        )
        .reduce((sum, entry) => sum + entry.value, 0);

      return {
        value: value,
        date: historicDate.format("YYYY-MM-DD"),
        monthCount: monthCount - index - 1,
      };
    });

    return historicEntries;
  }

  private _createEmptyHistoric(monthCount: number): PartnerEntry[] {
    const entriesClean: PartnerEntry[] = Array(monthCount).fill({
      value: 0,
      date: "",
      monthCount: 0,
    });

    return entriesClean;
  }

  private _calculateHistoricMonthsCount(): number {
    const startPeriod = "2022-07-02";
    const init = moment(startPeriod);
    const current = moment();
    const monthCount = current.diff(init, "months") + 1;

    return monthCount;
  }
}
