import moment from "moment";
import { BoxConfig } from "../environment/BoxConfig.env";
import { EntryAmount } from "../repository/IEntry.service";
import { EntryTypesIdEnum } from "../infraestructure/entryTypes.enum";
import { Loan, LoanDetail } from "../repository/ILoan.service";

const getMonthsContribution = (): number => {
  const startDate = moment(BoxConfig.startDate);
  //TODO: Reducir el month, solo pruebas
  const currentDate = moment(); //.add(1, "M");

  return currentDate.diff(startDate, "months");
};
const calculateTotalContribution = (): number => {
  const monthsContribution = getMonthsContribution();

  return (
    BoxConfig.startAmount + monthsContribution * BoxConfig.contributionAmount
  );
};

const getContributionsToPay = (dbContribution: number): number => {
  const calculatedContribution = calculateTotalContribution();

  return Math.round(
    (calculatedContribution - dbContribution) / BoxConfig.contributionAmount
  );
};

export const calculateContributionAmount = (
  dbContribution: number
): EntryAmount[] => {
  const contributionsToPay = getContributionsToPay(dbContribution);
  const entryAmounts: EntryAmount[] = [];

  if (contributionsToPay >= 1) {
    entryAmounts.push({
      id: EntryTypesIdEnum.CONTRIBUTION,
      value: contributionsToPay * BoxConfig.contributionAmount,
    });

    if (dbContribution === null) {
      entryAmounts.push({
        id: EntryTypesIdEnum.ADMINISTRATION_FUND,
        value: 10,
      });
      entryAmounts.push({
        id: EntryTypesIdEnum.STRATEGIC_FUND,
        value: 5 + getMonthsContribution() * BoxConfig.strategicFund,
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
  const currentDay = currentDate.date();
  const currentMonth = currentDate.month();
  const currentYear = currentDate.year();

  let loanFee = 0;
  let loanInterest = 0;
  let loanFeePenalty = 0;

  loanDetails.map((detail: LoanDetail) => {
    const detailDate = moment(detail.payment_date);
    const detailDay = detailDate.date();
    const detailMonth = detailDate.month();
    const detailYear = detailDate.year();

    if (
      currentYear >= detailYear &&
      currentMonth >= detailMonth &&
      !detail.is_paid
    ) {
      loanFee += detail.fee_value;
      loanInterest += detail.interest;
      if (currentDay > detailDay)
        loanFeePenalty += detail.fee_value * BoxConfig.loanPenaltyPercentage;
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
