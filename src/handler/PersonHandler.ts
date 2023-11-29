import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IPersonService } from "../repository/IPerson.service";

const personService = CONTAINER.get<IPersonService>(IDENTIFIERS.PersonService);

export const find: Handler = (event, __, callback) => {
  personService.getPersons(event.queryStringParameters).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const count: Handler = (_, __, callback) => {
  personService.getPersonsCount().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const person: Handler = (event, __, callback) => {
  personService.postNewPerson(JSON.parse(event.body)).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const update: Handler = (event, __, callback) => {
  personService
    .updatePerson(event.pathParameters.dni, JSON.parse(event.body))
    .subscribe({
      next: (response) => {
        callback(null, { status: 200, body: JSON.stringify(response) });
      },
    });
};

export const disable: Handler = (event, __, callback) => {
  personService.deletePerson(event.pathParameters.account).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};
