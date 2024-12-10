import { EntryHeader } from "../repository/IEntry.service";
import { map, Observable, of } from "rxjs";
import {
  AccountStatusEnum,
  EntryBillTypeEnum,
} from "../infraestructure/RegistryStatusEnum";
import { EgressHeader } from "../repository/IEgress.service";
import { Person } from "../repository/IPerson.service";
import { getContributionsToPay } from "./Entry.utils";

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

export const updatePersonStatus = (person: Person): Observable<Person> => {
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
        person.status = AccountStatusEnum.LATE;

        return person;
      }

      person.status = AccountStatusEnum.OK;

      return person;
    })
  );
};
