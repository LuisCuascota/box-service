import { Contribution, EntryHeader } from "../repository/IEntry.service";
import { map, mergeMap, Observable, of } from "rxjs";
import {
  AccountStatusEnum,
  EntryBillTypeEnum,
  RegistryStatusEnum,
} from "../infraestructure/RegistryStatusEnum";
import { EgressHeader } from "../repository/IEgress.service";
import { Person } from "../repository/IPerson.service";
import { getContributionsToPay } from "./Entry.utils";
import { Loan, LoanDetail } from "../repository/ILoan.service";
import {
  buildCol,
  TablesEnum,
  TColDetail,
  TColEntry,
} from "../infraestructure/Tables.enum";
import { tag } from "rxjs-spy/cjs/operators";
import { Knex } from "knex";
import { IMySQLGateway } from "../repository/IMySQL.gateway";

export const updateEntryEgressStatus = (
  entry: EntryHeader | EgressHeader
): Observable<EgressHeader | EntryHeader> => {
  return of(1).pipe(
    map(() => {
      if (entry.cash > 0 && entry.transfer > 0) {
        entry.status = EntryBillTypeEnum.MIXED;

        return entry;
      }

      if (entry.cash > 0) {
        entry.status = EntryBillTypeEnum.CASH;

        return entry;
      }

      if (entry.transfer > 0) {
        entry.status = EntryBillTypeEnum.TRANSFER;

        return entry;
      }

      return entry;
    })
  );
};

export const updateSavingStatus = (person: Person): Observable<Person> => {
  return of(1).pipe(
    map(() => {
      if (
        getContributionsToPay({
          number: person.number!,
          start_amount: person.start_amount,
          creation_date: person.creation_date,
          current_saving: person.current_saving,
        }) > 0
      ) {
        person.savingStatus = AccountStatusEnum.LATE;

        return person;
      }

      person.savingStatus = AccountStatusEnum.OK;

      return person;
    })
  );
};

export const updateLoanStatus = (loanList: Loan[]): string => {
  if (loanList.some((item) => item.status === RegistryStatusEnum.LATE))
    return RegistryStatusEnum.LATE;
  else if (loanList.some((item) => item.status === RegistryStatusEnum.CURRENT))
    return RegistryStatusEnum.DEBT;
  else if (loanList.every((item) => item.status === RegistryStatusEnum.PAID))
    return RegistryStatusEnum.FREE;
  else return RegistryStatusEnum.FREE;
};

export const getContributionListQuery = (
  knex: Knex,
  account: number,
  types?: number[]
): Observable<string> => {
  return of(1).pipe(
    mergeMap(() =>
      of(
        knex
          .select(
            buildCol({ e: TColEntry.DATE }),
            buildCol({ e: TColEntry.NUMBER }),
            buildCol({ d: TColDetail.VALUE }),
            buildCol({ d: TColDetail.TYPE_ID })
          )
          .from({ d: TablesEnum.ENTRY_DETAIL })
          .innerJoin({ e: TablesEnum.ENTRY }, (builder) =>
            builder.on(
              buildCol({ e: TColEntry.NUMBER }),
              "=",
              buildCol({ d: TColDetail.ENTRY_NUMBER })
            )
          )
          .whereIn(buildCol({ d: TColDetail.TYPE_ID }), types ? types : [8, 11])
          .where(buildCol({ e: TColEntry.ACCOUNT_NUMBER }), account)
          .toQuery()
      )
    )
  );
};

export const isDisabledLoanFee = (fee: LoanDetail): boolean => {
  return (
    fee.fee_total === 0 &&
    fee.balance_after_pay === 0 &&
    fee.interest === 0 &&
    fee.fee_value === 0
  );
};
