// utils/dateRangeUtil.ts
export type DateRangeType = "today" | "week" | "month" | "year" | "custom";

export function resolveDateRange(
  rangeType: DateRangeType,
  customStart?: string,
  customEnd?: string
): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date();
  endDate.setHours(23, 59, 59, 999);

  switch (rangeType) {
    case "today":
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      break;

    case "week": {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      break;
    }

    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;

    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;

    case "custom":
      if (!customStart || !customEnd) {
        throw new Error("startDate and endDate are required for custom range");
      }
      startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      break;

    default:
      throw new Error("Invalid rangeType");
  }

  return { startDate, endDate };
}