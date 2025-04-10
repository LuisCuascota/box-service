import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import {
  ILoanService,
  Loan,
  LoanCounter,
  LoanDetail,
} from "../repository/ILoan.service";
import { processResponse } from "../utils/Verifier.utils";

const loanService = CONTAINER.get<ILoanService>(IDENTIFIERS.LoanService);

export const count: Handler = (event) => {
  return processResponse<LoanCounter>(
    loanService.getLoanCount(event.queryStringParameters),
    event
  );
};

export const loan: Handler = (event) => {
  return processResponse<boolean>(
    loanService.postNewLoan(JSON.parse(event.body)),
    event
  );
};

export const search: Handler = (event) => {
  return processResponse<Loan[]>(
    loanService.searchLoan(event.queryStringParameters),
    event
  );
};

export const detail: Handler = (event) => {
  return processResponse<LoanDetail[]>(
    loanService.getLoanDetail(event.pathParameters.number),
    event
  );
};

export const update: Handler = (event) => {
  return processResponse<boolean>(
    loanService.updateLoan(JSON.parse(event.body)),
    event
  );
};
