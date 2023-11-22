import { injectable } from "inversify";
import { finalize, Observable, of } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { Connection, createConnection } from "promise-mysql";
import { DBConfigEnv } from "../environment/DBConfig.env";

@injectable()
export class MySQLGateway implements IMySQLGateway {
  public query<T>(query: string): Observable<T[]> {
    return of(1).pipe(
      mergeMap(() => createConnection(DBConfigEnv)),
      mergeMap((connection: Connection) =>
        this._executeQuery<T>(connection, query)
      )
    );
  }
  private _executeQuery<T>(
    connection: Connection,
    query: string
  ): Observable<T[]> {
    return of(1).pipe(
      mergeMap(() => connection.query<T[]>(query)),
      finalize(() => connection.destroy())
    );
  }
}
