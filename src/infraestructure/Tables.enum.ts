export enum TablesEnum {
  PERSON = "Person",
  ACCOUNT = "Account",
  ENTRY = "Entry",
  ENTRY_TYPE = "Entry_type",
  ENTRY_DETAIL = "Entry_detail",
  LOAN = "Loan",
  LOAN_DETAIL = "Loan_detail",
  EGRESS = "Discharge",
  EGRESS_DETAIL = "Discharge_detail",
  ENTRY_BILL_DETAIL = "Entry_bill_detail",
  EGRESS_BILL_DETAIL = "Discharge_bill_detail",
}

export enum TColPerson {
  NAMES = "names",
  SURNAMES = "surnames",
  DNI = "dni",
  BIRTH_DAY = "birth_day",
  ADDRESS = "address",
  PHONE = "phone",
}

export enum TColAccount {
  NUMBER = "number",
  DNI = "dni",
  IS_DISABLED = "is_disabled",
  CREATION_DATE = "creation_date",
  START_AMOUNT = "start_amount",
  CURRENT_SAVING = "current_saving",
}

export enum TColEntryType {
  ID = "id",
  DESCRIPTION = "description",
}

export enum TColEntryBillDetail {
  CASH = "cash",
  TRANSFER = "transfer",
  ENTRY_NUMBER = "entry_number",
}

export enum TColEgressBillDetail {
  CASH = "cash",
  TRANSFER = "transfer",
  EGRESS_NUMBER = "discharge_number",
}

export enum TColEntry {
  NUMBER = "number",
  ACCOUNT_NUMBER = "account_number",
  DATE = "date",
  AMOUNT = "amount",
  PLACE = "place",
}

export enum TColDetail {
  VALUE = "value",
  ENTRY_NUMBER = "entry_number",
  TYPE_ID = "type_id",
}

export enum TColLoan {
  NUMBER = "number",
  ACCOUNT = "account",
  IS_END = "is_end",
  DATE = "date",
  VALUE = "value",
  TERM = "term",
  RATE = "rate",
  DEBT = "debt",
  ENABLED = "enabled",
}

export enum TColLoanDetail {
  ID = "id",
  IS_PAID = "is_paid",
  LOAN_NUMBER = "loan_number",
  FEE_NUMBER = "fee_number",
  ENTRY_NUMBER = "entry_number",
  FEE_VALUE = "fee_value",
  PAYMENT_DATE = "payment_date",
}

export enum TColEgress {
  NUMBER = "number",
  DATE = "date",
  PLACE = "place",
  BENEFICIARY = "beneficiary",
  AMOUNT = "amount",
  TYPE_ID = "type_id",
}

export enum TColEgressDetail {
  DISCHARGE_NUMBER = "discharge_number",
  DESCRIPTION = "description",
  VALUE = "value",
}

export enum AliasEnum {
  COUNT = "count",
  TOTAL = "total",
  SUM = "sum",
  CASH = "cash",
  TRANSFER = "transfer",
  DEBT = "debt",
  LOAN_COUNT = "loanCount",
}

export const buildCol = (
  object: { [key: string]: string },
  alias?: string
): string => {
  const [key, value] = Object.entries(object)[0];

  return `${key}.${value} ${alias ? `as ${alias}` : ""}`;
};
