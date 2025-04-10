import "reflect-metadata";
import { Handler } from "aws-lambda";
import { CONTAINER } from "../infraestructure/Container";
import { IDENTIFIERS } from "../infraestructure/Identifiers";
import { processResponse } from "../utils/Verifier.utils";
import {
  IBalanceService,
  PartnerBalance,
  Period,
} from "../repository/IBalance.service";

const balancesService = CONTAINER.get<IBalanceService>(
  IDENTIFIERS.BalanceService
);

export const balance: Handler = async (event) => {
  return processResponse<PartnerBalance[]>(
    balancesService.getPartnerBalance(event.queryStringParameters),
    event
  );
};

export const periodList: Handler = async (event) => {
  return processResponse<Period[]>(balancesService.getPeriodList(), event);
};
