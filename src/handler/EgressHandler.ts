import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  EgressDetail,
  EgressHeader,
  IEgressService,
} from "../repository/IEgress.service";
import { processResponse } from "../utils/Verifier.utils";

const egressService = CONTAINER.get<IEgressService>(IDENTIFIERS.EgressService);

export const count: Handler = (event) => {
  return processResponse<number>(egressService.getEgressCount(), event);
};

export const egress: Handler = (event) => {
  return processResponse<boolean>(
    egressService.postNewEgress(JSON.parse(event.body)),
    event
  );
};

export const search: Handler = (event) => {
  return processResponse<EgressHeader[]>(
    egressService.searchEgress(event.queryStringParameters),
    event
  );
};

export const detail: Handler = (event) => {
  return processResponse<EgressDetail>(
    egressService.getEgressDetail(event.pathParameters.number),
    event
  );
};
