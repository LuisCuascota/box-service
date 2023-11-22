import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { ILoanService } from "../repository/ILoan.service";

const loanService = CONTAINER.get<ILoanService>(IDENTIFIERS.LoanService);

export const count: Handler = (_, __, callback) => {
  loanService.getLoanCount().subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const loan: Handler = (event, __, callback) => {
  loanService.postNewLoan(JSON.parse(event.body)).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const search: Handler = (event, __, callback) => {
  loanService.searchLoan(event.queryStringParameters).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};

export const detail: Handler = (event, __, callback) => {
  loanService.getLoanDetail(event.pathParameters.number).subscribe({
    next: (response) => {
      callback(null, { status: 200, body: JSON.stringify(response) });
    },
  });
};
