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
}

export enum TColEntryType {
  ID = "id",
  DESCRIPTION = "description",
}

export enum TColEntry {
  NUMBER = "number",
  ACCOUNT_NUMBER = "account_number",
  DATE = "date",
  AMOUNT = "amount",
  IS_TRANSFER = "is_transfer",
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
}

export enum TColLoanDetail {
  ID = "id",
  IS_PAID = "is_paid",
  LOAN_NUMBER = "loan_number",
  FEE_NUMBER = "fee_number",
  ENTRY_NUMBER = "entry_number",
  FEE_VALUE = "fee_value",
}

export enum TColEgress {
  NUMBER = "number",
  DATE = "date",
  PLACE = "place",
  BENEFICIARY = "beneficiary",
  AMOUNT = "amount",
  IS_TRANSFER = "is_transfer",
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
}

export const buildCol = (
  object: { [key: string]: string },
  alias?: string
): string => {
  const [key, value] = Object.entries(object)[0];

  return `${key}.${value} ${alias ? `as ${alias}` : ""}`;
};
