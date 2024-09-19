import moment from "moment";
import { BoxConfig } from "../environment/BoxConfig.env";
import { EntryAmount } from "../repository/IEntry.service";
import { EntryTypesIdEnum } from "../infraestructure/entryTypes.enum";
import { Loan, LoanDetail } from "../repository/ILoan.service";
import { Account } from "../repository/IPerson.service";

const getGlobalContributions = (initAccountDate: string): number => {
  const startDate = moment(initAccountDate);
  //TODO: Reducir el month, solo pruebas
  const currentDate = moment(); //.add(1, "M");

  return currentDate.diff(startDate, "months");
};

const getPayedContributions = (
  currentContribution: number,
  startAccountAmount: number
): number => {
  return (
    (currentContribution - startAccountAmount) / BoxConfig.contributionAmount
  );
};

export const getContributionsToPay = (account: Account): number => {
  const globalContributions = getGlobalContributions(account.creation_date);
  const payedContributions = getPayedContributions(
    account.current_saving,
    account.start_amount
  );

  return Math.round(globalContributions - payedContributions);
};

const isPastMonth = () => {
  const currentMonthFirstSaturday = moment().date(1).day(6);

  return moment().isAfter(currentMonthFirstSaturday);
};

export const calculateContributionAmount = (
  account: Account
): EntryAmount[] => {
  const contributionsToPay = getContributionsToPay(account);
  const entryAmounts: EntryAmount[] = [];

  if (contributionsToPay >= 1) {
    entryAmounts.push({
      id: EntryTypesIdEnum.CONTRIBUTION,
      value: contributionsToPay * BoxConfig.contributionAmount,
    });

    if (account.current_saving === 0) {
      entryAmounts.push({
        id: EntryTypesIdEnum.ADMINISTRATION_FUND,
        value: 10,
      });
      entryAmounts.push({
        id: EntryTypesIdEnum.STRATEGIC_FUND,
        value: (moment().month() + 1) * BoxConfig.strategicFund,
      });
    } else {
      entryAmounts.push({
        id: EntryTypesIdEnum.STRATEGIC_FUND,
        value: contributionsToPay * BoxConfig.strategicFund,
      });

      if (contributionsToPay >= 2)
        entryAmounts.push({
          id: EntryTypesIdEnum.CONTRIBUTION_PENALTY,
          value: (contributionsToPay - 1) * BoxConfig.contributionPenalty,
        });
      else if (isPastMonth())
        entryAmounts.push({
          id: EntryTypesIdEnum.CONTRIBUTION_PENALTY,
          value: contributionsToPay * BoxConfig.contributionPenalty,
        });
    }
  }

  return entryAmounts;
};

export const calculateLoanAmount = (
  loan: Loan,
  loanDetails: LoanDetail[]
): EntryAmount[] => {
  //TODO: Reducir el month, solo pruebas
  const currentDate = moment(); //.add(1, "M");

  let loanFee = 0;
  let loanInterest = 0;
  let loanFeePenalty = 0;

  loanDetails.map((detail: LoanDetail) => {
    if (
      currentDate.isSameOrAfter(detail.payment_date, "month") &&
      currentDate.isAfter(detail.payment_date, "day") &&
      !detail.is_paid
    ) {
      loanFeePenalty += detail.fee_value * BoxConfig.loanPenaltyPercentage;
      loanFee += detail.fee_value;
      loanInterest += detail.interest;

      return;
    }

    if (currentDate.isSame(detail.payment_date, "month") && !detail.is_paid) {
      loanFee += detail.fee_value;
      loanInterest += detail.interest;

      return;
    }
  });

  return buildLoanAmounts(
    loan,
    loanDetails,
    loanFee,
    loanInterest,
    loanFeePenalty
  );
};

const buildLoanAmounts = (
  loan: Loan,
  loanDetails: LoanDetail[],
  loanFee: number,
  loanInterest: number,
  loanFeePenalty: number
): EntryAmount[] => {
  const loanAmounts: EntryAmount[] = [];

  loanAmounts.push({
    id: EntryTypesIdEnum.LOAN_CONTRIBUTION,
    value: +loanFee.toFixed(2),
    amountDefinition: {
      loan,
      loanDetails,
    },
  });

  if (loanInterest > 0) {
    loanAmounts.push({
      id: EntryTypesIdEnum.LOAN_INTEREST,
      value: +loanInterest.toFixed(2),
    });
  }
  if (loanFeePenalty > 0) {
    loanAmounts.push({
      id: EntryTypesIdEnum.LOAN_CONTRIBUTION_PENALTY,
      value: +loanFeePenalty.toFixed(2),
    });
  }

  return loanAmounts;
};
