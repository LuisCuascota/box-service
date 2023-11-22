import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IEntryService } from "../repository/IEntry.service";

const entryService = CONTAINER.get<IEntryService>(IDENTIFIERS.EntryService);

export const count: Handler = (_, __, callback) => {
  entryService.getEntryCount().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const types: Handler = (_, __, callback) => {
  entryService.getEntryTypes().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const amounts: Handler = (event, __, callback) => {
  entryService.getEntryAmounts(event.pathParameters.account).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const entry: Handler = (event, __, callback) => {
  entryService.postNewEntry(JSON.parse(event.body)).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const search: Handler = (event, __, callback) => {
  entryService.searchEntry(event.queryStringParameters).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const detail: Handler = (event, __, callback) => {
  entryService.getEntryDetail(event.pathParameters.number).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};
