import { Observable } from "rxjs";
import { AliasEnum } from "../infraestructure/Tables.enum";

export interface IMetricsService {
  getMetrics(params: MetricsFilters): Observable<Metrics>;
  getTypesMetrics(params?: MetricsFilters): Observable<TypeMetric[]>;
}

export interface Metrics {
  total: number;
  cashTotal: number;
  transferTotal: number;
  loanTotalDispatched: number;
}

export interface TypeMetric {
  id: number;
  description: string;
  sum: number;
}

export interface Sum {
  [AliasEnum.SUM]: number;
}

export interface MetricsFilters {
  startDate?: string;
  endDate?: string;
  period: number;
}

export interface PeriodType {
  period_id: number;
  type_id: number;
  start_amount: number;
}
