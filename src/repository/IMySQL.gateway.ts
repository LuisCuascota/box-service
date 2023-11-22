import { Observable } from "rxjs";

export interface IMySQLGateway {
  query<T>(query: string): Observable<T[]>;
}
