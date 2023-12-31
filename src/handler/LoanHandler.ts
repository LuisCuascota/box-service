import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { ILoanService } from "../repository/ILoan.service";
import { verifyAuthJwt } from "../utils/Verifier.utils";

const loanService = CONTAINER.get<ILoanService>(IDENTIFIERS.LoanService);

export const count: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      loanService.getLoanCount().subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};

export const loan: Handler = (event, __, callback) => {
  const token = event.headers.Authorization;

  verifyAuthJwt(
    token,
    () =>
      loanService.postNewLoan(JSON.parse(event.body)).subscribe({
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
      loanService.searchLoan(event.queryStringParameters).subscribe({
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
      loanService.getLoanDetail(event.pathParameters.number).subscribe({
        next: (response) => {
          callback(null, { status: 200, body: JSON.stringify(response) });
        },
      }),
    callback
  );
};
