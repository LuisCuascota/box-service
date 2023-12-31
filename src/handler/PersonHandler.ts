import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IPersonService } from "../repository/IPerson.service";
import { verifyAuthJwt } from "../utils/Verifier.utils";

const personService = CONTAINER.get<IPersonService>(IDENTIFIERS.PersonService);

export const find: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      personService.getPersons(event.queryStringParameters).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const count: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      personService.getPersonsCount().subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const person: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      personService.postNewPerson(JSON.parse(event.body)).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const update: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      personService
        .updatePerson(event.pathParameters.account, JSON.parse(event.body))
        .subscribe({
          next: (response) => {
            callback(null, { status: 200, body: JSON.stringify(response) });
          },
        }),
    callback
  );
};

export const disable: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      personService.deletePerson(event.pathParameters.account).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};
