import test from "node:test";
import assert from "node:assert/strict";
import {
  gregorianToJalali,
  jalaliToGregorian,
  toPersianDigits,
  daysInJalaliMonth,
  dayDiff,
  addDays,
  getSlotsForTimeRange,
} from "./shamsi";

test("gregorianToJalali and jalaliToGregorian round-trip accurately", () => {
  const [jy, jm, jd] = gregorianToJalali(2026, 11, 13);
  assert.deepEqual([jy, jm, jd], [1405, 8, 22]);
  assert.equal(jalaliToGregorian(jy, jm, jd), "2026-11-13");
});

test("daysInJalaliMonth handles 31-day, 30-day, and leap Esfand months", () => {
  assert.equal(daysInJalaliMonth(1405, 1), 31);
  assert.equal(daysInJalaliMonth(1405, 8), 30);
  assert.equal(daysInJalaliMonth(1403, 12), 30); // leap year
  assert.equal(daysInJalaliMonth(1404, 12), 29); // non-leap year
});

test("toPersianDigits converts ASCII digits to Persian numerals", () => {
  assert.equal(toPersianDigits("1405/08/22"), "۱۴۰۵/۰۸/۲۲");
  assert.equal(toPersianDigits(42), "۴۲");
});

test("addDays and dayDiff calculate date offsets correctly", () => {
  const nextWeek = addDays("2026-11-13", 7);
  assert.equal(nextWeek, "2026-11-20");
  assert.equal(dayDiff("2026-11-13", nextWeek), 7);
});

test("getSlotsForTimeRange maps 3-hour time blocks accurately", () => {
  assert.deepEqual(getSlotsForTimeRange("08:30", "12:15"), ["06-09", "09-12", "12-15"]);
  assert.deepEqual(getSlotsForTimeRange("15:00", "18:00"), ["15-18"]);
});
