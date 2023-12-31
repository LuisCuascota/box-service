import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IEgressService } from "../repository/IEgress.service";
import { verifyAuthJwt } from "../utils/Verifier.utils";

const egressService = CONTAINER.get<IEgressService>(IDENTIFIERS.EgressService);

export const count: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      egressService.getEgressCount().subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const egress: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      egressService.postNewEgress(JSON.parse(event.body)).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const search: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      egressService.searchEgress(event.queryStringParameters).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const detail: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      egressService.getEgressDetail(event.pathParameters.number).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};
