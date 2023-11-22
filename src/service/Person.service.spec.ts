import knex, { Knex } from "knex";
import {
  buildCol,
  TablesEnum,
  TColLoanDetail,
} from "../infraestructure/Tables.enum";

describe("Person Service - Test", () => {
  const newEntry = {
    header: {
      number: 530,
      account_number: 23,
      amount: 1,
      date: "2023-10-31",
      place: "Loreto",
      is_transfer: true,
    },
    detail: [
      {
        id: 1,
        value: 1,
      },
    ],
  };
  const knexInst: Knex = knex({ client: "mysql" });

  it("should build query", () => {
    console.log(
      knexInst
        .update({
          [buildCol({ l: TColLoanDetail.IS_PAID })]: true,
          [buildCol({ l: TColLoanDetail.ENTRY_NUMBER })]: 100,
        })
        .from("ads")
        .where(buildCol({ l: TColLoanDetail.ID }), 20)
        .toQuery()
    );
  });
});
