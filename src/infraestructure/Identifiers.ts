export type containerSymbol = {
  PersonService: symbol;
  EntryService: symbol;
  LoanService: symbol;
  EgressService: symbol;
  MySQLGateway: symbol;
};

const IDENTIFIERS: containerSymbol = {
  PersonService: Symbol.for("PersonService"),
  EntryService: Symbol.for("EntryService"),
  LoanService: Symbol.for("LoanService"),
  EgressService: Symbol.for("EgressService"),
  MySQLGateway: Symbol.for("MySQLGateway"),
};

export { IDENTIFIERS };
