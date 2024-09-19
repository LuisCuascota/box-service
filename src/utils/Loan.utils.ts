import { LoanDetail } from "../repository/ILoan.service";
import moment from "moment";

export const checkLoanPaymentsStatus = (loanDetails: LoanDetail[]): boolean => {
  const currentDate = moment();

  return loanDetails.some(
    (detail: LoanDetail) =>
      !detail.is_paid && currentDate.isAfter(moment(detail.payment_date))
  );
};
