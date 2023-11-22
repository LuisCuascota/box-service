import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IEgressService } from "../repository/IEgress.service";

const egressService = CONTAINER.get<IEgressService>(IDENTIFIERS.EgressService);

export const count: Handler = (_, __, callback) => {
  egressService.getEgressCount().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const egress: Handler = (event, __, callback) => {
  egressService.postNewEgress(JSON.parse(event.body)).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const search: Handler = (event, __, callback) => {
  egressService.searchEgress(event.queryStringParameters).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const detail: Handler = (event, __, callback) => {
  egressService.getEgressDetail(event.pathParameters.number).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};
