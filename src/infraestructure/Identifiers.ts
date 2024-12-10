export type containerSymbol = {
  PersonService: symbol;
  EntryService: symbol;
  LoanService: symbol;
  EgressService: symbol;
  MetricsService: symbol;
  BalanceService: symbol;
  MySQLGateway: symbol;
};

const IDENTIFIERS: containerSymbol = {
  PersonService: Symbol.for("PersonService"),
  EntryService: Symbol.for("EntryService"),
  LoanService: Symbol.for("LoanService"),
  EgressService: Symbol.for("EgressService"),
  MetricsService: Symbol.for("MetricsService"),
  BalanceService: Symbol.for("BalanceService"),
  MySQLGateway: Symbol.for("MySQLGateway"),
};

export { IDENTIFIERS };
