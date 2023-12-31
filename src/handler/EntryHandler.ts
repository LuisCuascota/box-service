import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IEntryService } from "../repository/IEntry.service";
import { verifyAuthJwt } from "../utils/Verifier.utils";

const entryService = CONTAINER.get<IEntryService>(IDENTIFIERS.EntryService);

export const count: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      entryService.getEntryCount().subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const types: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      entryService.getEntryTypes().subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const amounts: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      entryService.getEntryAmounts(event.pathParameters.account).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const entry: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      entryService.postNewEntry(JSON.parse(event.body)).subscribe({
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
      entryService.searchEntry(event.queryStringParameters).subscribe({
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
      entryService.getEntryDetail(event.pathParameters.number).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};
