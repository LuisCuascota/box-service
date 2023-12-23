import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IMetricsService } from "../repository/IMetrics.service";

const metricsService = CONTAINER.get<IMetricsService>(
  IDENTIFIERS.MetricsService
);

export const metrics: Handler = (_, __, callback) => {
  metricsService.getMetrics().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const types: Handler = (_, __, callback) => {
  metricsService.getTypesMetrics().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};
