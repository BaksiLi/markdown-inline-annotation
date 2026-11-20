const assert = require("node:assert/strict");

function assertRenderFixture(html, fixture) {
  for (const part of fixture.contains ?? []) {
    assert.ok(html.includes(part), `${fixture.id} missing ${part} in ${html}`);
  }
  for (const part of fixture.notContains ?? []) {
    assert.ok(!html.includes(part), `${fixture.id} unexpectedly includes ${part} in ${html}`);
  }
  for (const { pattern, count } of fixture.counts ?? []) {
    assert.equal(html.split(pattern).length - 1, count, `${fixture.id} expected ${count} occurrences of ${pattern} in ${html}`);
  }
}

module.exports = { assertRenderFixture };
