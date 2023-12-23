import { Observable } from "rxjs";
import { AliasEnum } from "../infraestructure/Tables.enum";

export interface IMetricsService {
  getMetrics(): Observable<Metrics>;
  getTypesMetrics(): Observable<TypeMetric[]>;
}

export interface Metrics {
  total: number;
  cashTotal: number;
  transferTotal: number;
}

export interface TypeMetric {
  id: number;
  description: string;
  sum: number;
}

export interface Sum {
  [AliasEnum.SUM]: number;
}
