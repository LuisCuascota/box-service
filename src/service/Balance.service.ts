import { inject, injectable } from "inversify";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { forkJoin, map, mergeMap, Observable, of } from "rxjs";
import knex, { Knex } from "knex";
import { tag } from "rxjs-spy/operators";
import {
  BalanceEntry,
  BalanceFilters,
  IBalanceService,
  PartnerBalance,
  PartnerEntry,
  Period,
  PeriodAccount,
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
  TColPeriod,
  TColPeriodAccount,
} from "../infraestructure/Tables.enum";
import moment from "moment/moment";
import QueryBuilder = Knex.QueryBuilder;

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

  public getPartnerBalance(
    filter: BalanceFilters
  ): Observable<PartnerBalance[]> {
    return of(1).pipe(
      mergeMap(() => this.getPeriodList(filter)),
      mergeMap((period: Period[]) =>
        forkJoin([
          this._personService.getPersons({ mode: ModePagination.ACTIVE_ONLY }),
          this._getEntries(period[0]),
          this.getPeriodAccountList(period[0]),
          of(period[0]),
        ])
      ),
      map(
        ([person, entries, periodAccount, period]: [
          Person[],
          BalanceEntry[],
          PeriodAccount[],
          Period,
        ]) =>
          this._mapHistoricPartnersData(person, entries, periodAccount, period)
      ),
      tag("BalanceService | getPartnerBalance")
    );
  }

  public getPeriodList(filter?: BalanceFilters): Observable<Period[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select(
            buildCol({ p: TColPeriod.ID }),
            buildCol({ p: TColPeriod.START_DATE }),
            buildCol({ p: TColPeriod.END_DATE }),
            buildCol({ p: TColPeriod.ENABLED }),
            buildCol({ p: TColPeriod.INIT_CASH }),
            buildCol({ p: TColPeriod.INIT_TRANSFER })
          )
          .from({ p: TablesEnum.PERIOD })
      ),
      map((query: QueryBuilder) => {
        if (filter && filter.period)
          query.where(buildCol({ p: TColPeriod.ID }), filter.period);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<Period>(query))
    );
  }

  public getPeriodAccountList(period: Period): Observable<PeriodAccount[]> {
    return of(1).pipe(
      map(() =>
        this._knex
          .select()
          .from({ p: TablesEnum.PERIOD_ACCOUNT })
          .where(buildCol({ p: TColPeriodAccount.PERIOD_ID }), period.id)
          .toQuery()
      ),
      mergeMap((query: string) => this._mysql.query<PeriodAccount>(query))
    );
  }

  private _getEntries(period: Period): Observable<BalanceEntry[]> {
    return of(1).pipe(
      map(() =>
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
          .whereIn(buildCol({ d: TColDetail.TYPE_ID }), [8, 11])
          .where(buildCol({ e: TColEntry.PERIOD }), period.id)
      ),
      map((query: QueryBuilder) => {
        if (period.end_date)
          query.where(buildCol({ e: TColEntry.DATE }), "<=", period.end_date);

        return query.toQuery();
      }),
      mergeMap((query: string) => this._mysql.query<BalanceEntry>(query))
    );
  }

  private _mapHistoricPartnersData(
    person: Person[],
    entries: BalanceEntry[],
    periodAccountList: PeriodAccount[],
    period: Period
  ): PartnerBalance[] {
    let totalParticipationRate = 0;

    const initialHistoric = person.map((person: Person) => {
      const partnerEntries = entries.filter(
        (entry) => entry.account_number === person.number
      );
      const partnerPeriodData = periodAccountList.find(
        (account) => account.account_id === person.number
      );
      const entriesBuild = this._buildHistoricEntries(
        partnerEntries,
        period,
        partnerPeriodData
      );
      const participationRate = entriesBuild.reduce(
        (sum, entry) => sum + entry.value * entry.monthCount,
        0
      );

      let partnerSaving = partnerEntries.reduce(
        (sum, entry) => sum + entry.value,
        0
      );

      if (partnerPeriodData) partnerSaving += partnerPeriodData.start_amount;

      totalParticipationRate += participationRate;

      return {
        account: person.number!,
        names: `${person.names} ${person.surnames}`,
        currentSaving: partnerSaving,
        entries: entriesBuild,
        participationRate,
      };
    });

    return initialHistoric.map((balance: PartnerBalance) => ({
      ...balance,
      participationPercentage:
        balance.participationRate / totalParticipationRate,
    }));
  }

  private _buildHistoricEntries(
    entries: BalanceEntry[],
    period: Period,
    periodAccount?: PeriodAccount
  ): PartnerEntry[] {
    const monthCount = this._calculateHistoricMonthsCount(
      period.start_date,
      period.end_date
    );

    return this._createEmptyHistoric(monthCount).map((entry, index) => {
      const historicDate = (
        period.end_date ? moment(period.end_date) : moment()
      )
        .subtract(monthCount - index, "months")
        .startOf("month");
      let value = entries
        .filter(
          (entry) =>
            moment(entry.date).month() === historicDate.month() &&
            moment(entry.date).year() === historicDate.year()
        )
        .reduce((sum, entry) => sum + entry.value, 0);

      if (index === 0 && periodAccount) value += periodAccount.start_amount;

      return {
        value: value,
        date: historicDate.format("YYYY-MM-DD"),
        monthCount: monthCount - index,
      };
    });
  }

  private _createEmptyHistoric(monthCount: number): PartnerEntry[] {
    return Array(monthCount + 1).fill({
      value: 0,
      date: "",
      monthCount: 0,
    });
  }

  private _calculateHistoricMonthsCount(
    startPeriod: string,
    endPeriod?: string
  ): number {
    const init = moment(startPeriod).startOf("month");
    const current = endPeriod ? moment(endPeriod) : moment();

    return current.startOf("month").diff(init, "months");
  }
}
