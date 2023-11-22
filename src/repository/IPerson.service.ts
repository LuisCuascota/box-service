import { Observable } from "rxjs";
import { TColAccount, TColPerson } from "../infraestructure/Tables.enum";

export interface IPersonService {
  getPersons(): Observable<Person[]>;
}

export interface Person {
  [TColAccount.NUMBER]: number;
  [TColAccount.DNI]: string;
  [TColPerson.NAMES]: string;
  [TColPerson.SURNAMES]: string;
}
