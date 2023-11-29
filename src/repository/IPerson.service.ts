import { Observable } from "rxjs";

export interface IPersonService {
  getPersons(params?: PersonPagination): Observable<Person[]>;
  getPersonsCount(): Observable<number>;
  postNewPerson(person: Person): Observable<boolean>;
  updatePerson(dni: string, person: Person): Observable<boolean>;
  deletePerson(account: number): Observable<boolean>;
}

export interface Person {
  number?: number;
  dni: string;
  names: string;
  surnames: string;
  phone: string;
  birth_day: string;
  address: string;
}

export interface PersonPagination {
  limit: number;
  offset: number;
}
