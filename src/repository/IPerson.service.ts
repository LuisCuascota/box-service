import { Observable } from "rxjs";

export interface IPersonService {
  getPersons(params?: PersonPagination): Observable<Person[]>;
  getPersonsCount(): Observable<number>;
  postNewPerson(person: Person): Observable<boolean>;
  updatePerson(dni: string, person: Person): Observable<boolean>;
  deletePerson(account: number): Observable<boolean>;
  getAccount(account: number): Observable<Account>;
  updateAccountSaving(
    account: number,
    currentSaving: number,
    entryAmount: number
  ): Observable<boolean>;
}

export interface Person {
  number?: number;
  dni: string;
  names: string;
  surnames: string;
  phone: string;
  birth_day: string;
  address: string;
  current_saving: number;
  start_amount: number;
  creation_date: string;
  status: string;
}

export interface Account {
  number: number;
  creation_date: string;
  start_amount: number;
  current_saving: number;
}

export interface PersonPagination {
  limit: number;
  offset: number;
}
