import "reflect-metadata";
import { Container } from "inversify";
import { PersonService } from "../service/Person.service";
import { IPersonService } from "../repository/IPerson.service";
import { IDENTIFIERS } from "./Identifiers";
import { IMySQLGateway } from "../repository/IMySQL.gateway";
import { MySQLGateway } from "../gateway/MySQL.gateway";
import { IEntryService } from "../repository/IEntry.service";
import { EntryService } from "../service/Entry.service";
import { ILoanService } from "../repository/ILoan.service";
import { LoanService } from "../service/Loan.service";
import { IEgressService } from "../repository/IEgress.service";
import { EgressService } from "../service/Egress.service";

const CONTAINER: Container = new Container();

//Services
CONTAINER.bind<IPersonService>(IDENTIFIERS.PersonService).to(PersonService);
CONTAINER.bind<IEntryService>(IDENTIFIERS.EntryService).to(EntryService);
CONTAINER.bind<ILoanService>(IDENTIFIERS.LoanService).to(LoanService);
CONTAINER.bind<IEgressService>(IDENTIFIERS.EgressService).to(EgressService);

//Gateways
CONTAINER.bind<IMySQLGateway>(IDENTIFIERS.MySQLGateway).to(MySQLGateway);

export { CONTAINER };
