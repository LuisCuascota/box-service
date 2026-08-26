import moment from "moment";
import { BoxConfig } from "../environment/BoxConfig.env";
import { EntryAmount, EntryAmountDetail } from "../repository/IEntry.service";
import { EntryTypesIdEnum } from "../infraestructure/entryTypes.enum";
import { EntryLoanData, Loan, LoanDetail } from "../repository/ILoan.service";
import { Account } from "../repository/IPerson.service";

const getFirstSaturdayOfMonth = (): moment.Moment => {
  const firstDay = moment().startOf("month");
  const daysUntilSaturday = (6 - firstDay.day() + 7) % 7;

  return moment().startOf("month").add(daysUntilSaturday, "days");
};

const isCurrentMonthDue = (): boolean =>
  moment().isSameOrAfter(getFirstSaturdayOfMonth(), "day");

const isPastFirstSaturday = (): boolean =>
  moment().isAfter(getFirstSaturdayOfMonth(), "day");

const getGlobalContributions = (initAccountDate: string): number => {
  const startDate = moment(initAccountDate).startOf("month");
  const currentDate = moment().startOf("month");
  const months = currentDate.diff(startDate, "months");

  return isCurrentMonthDue() ? months : months - 1;
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

export const calculateContributionAmount = (
  account: Account
): EntryAmount[] => {
  const contributionsToPay = getContributionsToPay(account);
  const entryAmounts: EntryAmount[] = [];

  entryAmounts.push({
    id: EntryTypesIdEnum.CONTRIBUTION,
    value:
      contributionsToPay >= 1
        ? contributionsToPay * BoxConfig.contributionAmount
        : 0,
  });

  if (contributionsToPay >= 1) {
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

      const overdueCount = isCurrentMonthDue()
        ? isPastFirstSaturday()
          ? contributionsToPay
          : contributionsToPay - 1
        : contributionsToPay;

      if (overdueCount > 0)
        entryAmounts.push({
          id: EntryTypesIdEnum.CONTRIBUTION_PENALTY,
          value: overdueCount * BoxConfig.contributionPenalty,
        });
    }
  }

  return entryAmounts;
};

export const calculateLoanAmount = (
  loan: Loan,
  loanDetails: LoanDetail[]
): EntryAmount[] => {
  return [
    {
      id: EntryTypesIdEnum.LOAN_CONTRIBUTION,
      value: 0,
      amountDefinition: {
        loan,
        loanDetails,
      },
    },
    {
      id: EntryTypesIdEnum.LOAN_INTEREST,
      value: 0,
    },
    {
      id: EntryTypesIdEnum.LOAN_CONTRIBUTION_PENALTY,
      value: 0,
    },
  ];
};

export const validateLoanEntry = (
  detail: EntryAmountDetail[],
  entryLoanData: EntryLoanData,
  loanDetails: LoanDetail[]
): void => {
  const loanContribution = detail.find(
    (d) => d.type_id === EntryTypesIdEnum.LOAN_CONTRIBUTION
  );
  const loanInterest = detail.find(
    (d) => d.type_id === EntryTypesIdEnum.LOAN_INTEREST
  );
  const loanPenalty = detail.find(
    (d) => d.type_id === EntryTypesIdEnum.LOAN_CONTRIBUTION_PENALTY
  );

  const paidIds = entryLoanData.loanDetailToPay.map((p) => p.id);
  const selectedDetails = loanDetails.filter((ld) => paidIds.includes(ld.id));

  const alreadyPaid = selectedDetails.filter((ld) => ld.is_paid);

  if (alreadyPaid.length > 0) {
    const paidFees = alreadyPaid.map((ld) => ld.fee_number).join(", ");

    throw new Error(`Las cuotas [${paidFees}] ya fueron pagadas`);
  }

  const expectedCapital = +entryLoanData.loanDetailToPay
    .reduce((sum, p) => sum + p.feeValue, 0)
    .toFixed(2);

  if (
    loanContribution &&
    +loanContribution.value.toFixed(2) !== expectedCapital
  )
    throw new Error(
      `Capital inválido: esperado ${expectedCapital}, recibido ${loanContribution.value}`
    );

  const expectedInterest = +selectedDetails
    .reduce((sum, ld) => sum + ld.interest, 0)
    .toFixed(2);

  if (loanInterest && +loanInterest.value.toFixed(2) !== expectedInterest)
    throw new Error(
      `Interés inválido: esperado ${expectedInterest}, recibido ${loanInterest.value}`
    );

  if (loanPenalty && loanPenalty.value < 0)
    throw new Error("La multa no puede ser negativa");
};
