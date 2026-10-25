import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES, isBlocked } from '../js/world.js';
import { getBuildingFootprint, isBuildingBlocked, BUILDING_ORIGIN, BUILDING_SIZE } from '../js/scenery.js';

const openTown = { choices: Object.fromEntries(SITES.map(site => [site.id, 'fix'])) };

test('every raised building collides at its south foundation and leaves roof space walkable', () => {
  for (const site of SITES) {
    const f = getBuildingFootprint(site);
    assert.equal(f.y + f.height, site.y + 38);
    assert.ok(f.x >= site.x - BUILDING_ORIGIN.x);
    assert.ok(f.x + f.width <= site.x - BUILDING_ORIGIN.x + BUILDING_SIZE.width);
    assert.equal(isBlocked(site.x, f.y + f.height, openTown), true, `site ${site.id} front wall`);
    assert.equal(isBlocked(site.x, f.y + f.height + 1, openTown), false, `site ${site.id} front approach`);
    assert.equal(isBlocked(site.x, f.y - 12, openTown), false, `site ${site.id} behind roof`);
  }
});

test('the side road retains a full player radius beside all six building foundations', () => {
  for (const site of SITES) {
    for (const dx of [-8, 0, 8]) for (const dy of [-8, 0, 8]) {
      assert.equal(isBlocked(site.x + 134 + dx, site.y + 15 + dy, openTown), false,
        `site ${site.id} side road, ${dx},${dy}`);
    }
  }
});

test('recessed southeast corners are walkable rather than blocking the bounding-box air', () => {
  for (const site of SITES) {
    const f = getBuildingFootprint(site);
    const x = f.x + f.width - 2, y = f.y + f.height - 2;
    assert.equal(isBuildingBlocked(site, x, y), false, `site ${site.id} recessed corner`);
    assert.equal(isBlocked(x, y, openTown), false, `site ${site.id} integrated collision`);
  }
});
