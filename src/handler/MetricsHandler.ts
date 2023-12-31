import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IMetricsService, Metrics } from "../repository/IMetrics.service";
import { processResponse, verifyAuthJwt } from "../utils/Verifier.utils";

const metricsService = CONTAINER.get<IMetricsService>(
  IDENTIFIERS.MetricsService
);

export const metrics: Handler = async (event) => {
  return processResponse<Metrics>(metricsService.getMetrics(), event);
};

export const types: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      metricsService.getTypesMetrics().subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};
