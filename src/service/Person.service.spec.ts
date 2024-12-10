import moment from "moment";
import { PartnerEntry } from "../repository/IBalance.service";

describe("Person Service - Test", () => {
  it("should build query", () => {
    const startPeriod = "2022-07-02";
    const init = moment(startPeriod).startOf("month");
    const current = moment().startOf("month");

    const monthCount = current.diff(init, "months") + 1;
    console.log(monthCount);
    console.log(current, init);

    const entriesClean: PartnerEntry[] = Array(monthCount)
      .fill({
        value: 0,
        date: "",
        monthCount: 0,
      })
      .map((entry, index) => ({
        value: 0,
        date: moment()
          .startOf("month")
          .subtract(monthCount - index - 1, "months")
          .format("YYYY-MM-DD"),
        monthCount: monthCount - index,
      }));

    console.log(entriesClean);
  });
});
