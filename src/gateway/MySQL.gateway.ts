import { injectable } from "inversify";
import { finalize, from, Observable, of } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { Connection, createConnection } from "promise-mysql";
import { DBConfigEnvDev } from "../environment/DBConfig.env.dev";

@injectable()
export class MySQLGateway implements IMySQLGateway {
  public query<T>(query: string): Observable<T[]> {
    return of(1).pipe(
      mergeMap(() => from(this._getDBConfig())),
      mergeMap((dbConfig: object) => createConnection(dbConfig)),
      mergeMap((connection: Connection) =>
        this._executeQuery<T>(connection, query)
      )
    );
  }

  private async _getDBConfig() {
    const envConfig = process.env.DB_DATA ? process.env.DB_DATA : "{}";

    //return JSON.parse(envConfig);
    return DBConfigEnvDev;
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
