import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, parseDeposit } from '../services/parsePrice.js';
import { extractUtilitiesAndAmenities, FIELD_SYNONYMS } from '../services/autoDetectSheet.js';

describe('Strategy 1: Universal Sheet Ingestion & Normalization', () => {
  it('parsePrice handles range prices like 3.5 - 4tr', () => {
    assert.equal(parsePrice('3.5 - 4tr'), 3500000);
    assert.equal(parsePrice('3.8tr - 4.2tr'), 3800000);
    assert.equal(parsePrice('3500k - 4000k'), 3500000);
    assert.equal(parsePrice('4.500.000 - 5.000.000'), 4500000);
  });

  it('parseDeposit handles month notations and percentage', () => {
    const roomPrice = 4000000;
    assert.equal(parseDeposit('Cọc 1 tháng', roomPrice), 4000000);
    assert.equal(parseDeposit('1 tháng', roomPrice), 4000000);
    assert.equal(parseDeposit('1th', roomPrice), 4000000);
    assert.equal(parseDeposit('Cọc 2 tháng', roomPrice), 8000000);
    assert.equal(parseDeposit('2 tháng', roomPrice), 8000000);
    assert.equal(parseDeposit('Cọc 50%', roomPrice), 2000000);
    assert.equal(parseDeposit('nửa tháng', roomPrice), 2000000);
    // Explicit amounts
    assert.equal(parseDeposit('3.5tr', roomPrice), 3500000);
    assert.equal(parseDeposit('5000000', roomPrice), 5000000);
    // Fallback when empty
    assert.equal(parseDeposit('', roomPrice), 4000000);
    assert.equal(parseDeposit(null, roomPrice), 4000000);
  });

  it('extractUtilitiesAndAmenities extracts electric, water and decodes abbreviations', () => {
    const text = 'P302 khép kín full đồ: đh, nl, giường, tủ, tủ lạnh, máy giặt chung, điện 3.8k/số, nước 100k/ng, ban công';
    const result = extractUtilitiesAndAmenities(text);

    assert.equal(result.electric, '3.8k/số');
    assert.equal(result.water, '100k/ng');
    assert.ok(result.decodedAmenities.includes('Điều hòa'));
    assert.ok(result.decodedAmenities.includes('Nóng lạnh'));
    assert.ok(result.decodedAmenities.includes('Tủ lạnh'));
    assert.ok(result.decodedAmenities.includes('Máy giặt'));
    assert.ok(result.decodedAmenities.includes('Ban công'));
  });

  it('FIELD_SYNONYMS covers real-estate shorthand synonyms', () => {
    assert.ok(FIELD_SYNONYMS.price.includes('giá nét'));
    assert.ok(FIELD_SYNONYMS.price.includes('giá chốt'));
    assert.ok(FIELD_SYNONYMS.deposit.includes('mức cọc'));
    assert.ok(FIELD_SYNONYMS.code.includes('phòng số'));
    assert.ok(FIELD_SYNONYMS.amenities.includes('full đồ'));
    assert.ok(FIELD_SYNONYMS.images.includes('link drive'));
  });
});
