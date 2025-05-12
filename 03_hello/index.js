import { currentDateTime } from "./date.js";

const { date, time } = currentDateTime();
console.log(`Today is ${date}, the current time is ${time}.`);
