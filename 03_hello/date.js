import date from "date-and-time";

export function currentDateTime() {
  const now = new Date();
  const formattedDate = date.format(now, "YYYY-MM-DD");
  const formattedTime = date.format(now, "HH:mm:ss");

  return {
    date: formattedDate,
    time: formattedTime,
  };
}
