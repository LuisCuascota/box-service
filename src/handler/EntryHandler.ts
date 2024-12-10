import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  Contribution,
  EntryAmount,
  EntryDetail,
  EntryHeader,
  EntryType,
  IEntryService,
} from "../repository/IEntry.service";
import { processResponse } from "../utils/Verifier.utils";

const entryService = CONTAINER.get<IEntryService>(IDENTIFIERS.EntryService);

export const count: Handler = (event) => {
  return processResponse<number>(
    entryService.getEntryCount(event.queryStringParameters),
    event
  );
};

export const types: Handler = (event) => {
  return processResponse<EntryType[]>(entryService.getEntryTypes(), event);
};

export const amounts: Handler = (event) => {
  return processResponse<EntryAmount[]>(
    entryService.getEntryAmounts(event.pathParameters.account),
    event
  );
};

export const entry: Handler = (event) => {
  return processResponse<boolean>(
    entryService.postNewEntry(JSON.parse(event.body)),
    event
  );
};

export const search: Handler = (event) => {
  return processResponse<EntryHeader[]>(
    entryService.searchEntry(event.queryStringParameters),
    event
  );
};

export const detail: Handler = (event) => {
  return processResponse<EntryDetail>(
    entryService.getEntryDetail(event.pathParameters.number),
    event
  );
};

export const contributions: Handler = (event) => {
  return processResponse<Contribution[]>(
    entryService.getContributionList(event.pathParameters.account),
    event
  );
};
