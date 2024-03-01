import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IPersonService, Person } from "../repository/IPerson.service";
import { processResponse } from "../utils/Verifier.utils";

const personService = CONTAINER.get<IPersonService>(IDENTIFIERS.PersonService);

export const find: Handler = (event) => {
  return processResponse<Person[]>(
    personService.getPersons(event.queryStringParameters),
    event
  );
};

export const count: Handler = (event) => {
  return processResponse<number>(personService.getPersonsCount(), event);
};

export const person: Handler = (event) => {
  return processResponse<boolean>(
    personService.postNewPerson(JSON.parse(event.body)),
    event
  );
};

export const update: Handler = (event) => {
  return processResponse<boolean>(
    personService.updatePerson(
      event.pathParameters.account,
      JSON.parse(event.body)
    ),
    event
  );
};

export const disable: Handler = (event) => {
  return processResponse<boolean>(
    personService.deletePerson(event.pathParameters.account),
    event
  );
};
