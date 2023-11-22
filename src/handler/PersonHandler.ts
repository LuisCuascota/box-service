import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { IPersonService } from "../repository/IPerson.service";

const personService = CONTAINER.get<IPersonService>(IDENTIFIERS.PersonService);

export const find: Handler = (_, __, callback) => {
  personService.getPersons().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};
