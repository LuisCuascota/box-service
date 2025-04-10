import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  IMetricsService,
  Metrics,
  TypeMetric,
} from "../repository/IMetrics.service";
import { processResponse } from "../utils/Verifier.utils";

const metricsService = CONTAINER.get<IMetricsService>(
  IDENTIFIERS.MetricsService
);

export const metrics: Handler = async (event) => {
  return processResponse<Metrics>(
    metricsService.getMetrics(event.queryStringParameters),
    event
  );
};

export const types: Handler = (event) => {
  return processResponse<TypeMetric[]>(
    metricsService.getTypesMetrics(event.queryStringParameters),
    event
  );
};
