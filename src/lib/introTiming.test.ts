import test from "node:test";
import assert from "node:assert/strict";
import {
  THREE_HOURS_MS,
  parseIntroTimestamp,
  pickNewestIntroTimestamp,
  shouldShowIntro,
} from "./introTiming";

test("shouldShowIntro returns true when no timestamp exists or value is invalid", () => {
  const now = 1_794_580_000_000;
  assert.equal(shouldShowIntro(null, now), true);
  assert.equal(shouldShowIntro(undefined, now), true);
  assert.equal(shouldShowIntro("", now), true);
  assert.equal(shouldShowIntro("null", now), true);
  assert.equal(shouldShowIntro("undefined", now), true);
  assert.equal(shouldShowIntro("0", now), true);
  assert.equal(shouldShowIntro("-100", now), true);
  assert.equal(shouldShowIntro("not-a-number", now), true);
});

test("shouldShowIntro enforces exact 3-hour cooldown boundary", () => {
  const sixAm = new Date("2026-11-13T06:00:00.000Z").getTime();
  const eightFiftyNineAm = new Date("2026-11-13T08:59:59.999Z").getTime();
  const nineAm = new Date("2026-11-13T09:00:00.000Z").getTime();
  const tenAm = new Date("2026-11-13T10:00:00.000Z").getTime();

  // Immediately after completion and up to 8:59:59.999 -> must NOT show
  assert.equal(shouldShowIntro(String(sixAm), sixAm), false);
  assert.equal(shouldShowIntro(String(sixAm), sixAm + 60_000), false);
  assert.equal(shouldShowIntro(String(sixAm), eightFiftyNineAm), false);

  // At exact 3 hours (9:00 AM) and later (10:00 AM) -> MUST show
  assert.equal(shouldShowIntro(String(sixAm), nineAm), true);
  assert.equal(shouldShowIntro(String(sixAm), tenAm), true);
  assert.equal(nineAm - sixAm, THREE_HOURS_MS);
});

test("shouldShowIntro slides window from latest completion time", () => {
  const tenAm = new Date("2026-11-13T10:00:00.000Z").getTime();
  const twelveFiftyNinePm = new Date("2026-11-13T12:59:00.000Z").getTime();
  const onePm = new Date("2026-11-13T13:00:00.000Z").getTime();
  const sevenPm = new Date("2026-11-13T19:00:00.000Z").getTime();
  const nineFiftyNinePm = new Date("2026-11-13T21:59:00.000Z").getTime();
  const tenPm = new Date("2026-11-13T22:00:00.000Z").getTime();

  assert.equal(shouldShowIntro(tenAm, twelveFiftyNinePm), false);
  assert.equal(shouldShowIntro(tenAm, onePm), true);
  assert.equal(shouldShowIntro(tenAm, sevenPm), true);

  // After completing at 7 PM, hidden until 10 PM
  assert.equal(shouldShowIntro(sevenPm, nineFiftyNinePm), false);
  assert.equal(shouldShowIntro(sevenPm, tenPm), true);
});

test("pickNewestIntroTimestamp keeps latest valid timestamp across local and server", () => {
  assert.equal(pickNewestIntroTimestamp(null, null), null);
  assert.equal(pickNewestIntroTimestamp("1700000000000", null), "1700000000000");
  assert.equal(pickNewestIntroTimestamp(null, 1700005000000), "1700005000000");
  assert.equal(pickNewestIntroTimestamp("1700009000000", "1700001000000"), "1700009000000");
  assert.equal(pickNewestIntroTimestamp("1700001000000", "1700009000000"), "1700009000000");
  assert.equal(parseIntroTimestamp("invalid"), null);
});
