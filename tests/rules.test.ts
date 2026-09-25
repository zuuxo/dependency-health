import test from "node:test";
import assert from "node:assert/strict";
import semver from "semver";

test("semver detects major upgrade", () => {
  assert.equal(semver.diff("1.5.0", "2.0.0"), "major");
});

test("semver minVersion reads caret ranges", () => {
  assert.equal(semver.minVersion("^4.18.0")?.version, "4.18.0");
});
