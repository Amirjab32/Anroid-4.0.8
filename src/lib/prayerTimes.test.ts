import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrayerTimes, IRAN_CITIES } from "./prayerTimes";

test("calculatePrayerTimes produces ordered daily prayer times for Tehran", () => {
  const date = new Date(2026, 10, 13); // 2026-11-13
  const res = calculatePrayerTimes(date, "تهران", 0);

  assert.ok(res.fajrMin < res.sunriseMin, "Fajr must precede sunrise");
  assert.ok(res.sunriseMin < res.dhuhrMin, "Sunrise must precede Dhuhr");
  assert.ok(res.dhuhrMin < res.asrMin, "Dhuhr must precede Asr");
  assert.ok(res.asrMin < res.sunsetMin, "Asr must precede sunset");
  assert.ok(res.sunsetMin <= res.maghribMin, "Sunset must precede Maghrib");
  assert.ok(res.maghribMin < res.ishaMin, "Maghrib must precede Isha");
  assert.match(res.fajr, /^\d{2}:\d{2}$/);
  assert.match(res.dhuhr, /^\d{2}:\d{2}$/);
});

test("calculatePrayerTimes applies minute offset consistently", () => {
  const date = new Date(2026, 10, 13);
  const base = calculatePrayerTimes(date, "مشهد", 0);
  const shifted = calculatePrayerTimes(date, "مشهد", 5);
  assert.equal(shifted.dhuhrMin - base.dhuhrMin, 5);
});

test("IRAN_CITIES contains expected major cities", () => {
  assert.ok(IRAN_CITIES.some((c) => c.name === "تهران"));
  assert.ok(IRAN_CITIES.some((c) => c.name === "اصفهان"));
  assert.ok(IRAN_CITIES.some((c) => c.name === "شیراز"));
});
