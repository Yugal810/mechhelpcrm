/**
 * carService.js
 *
 * Serves vehicle search and dropdown options entirely from in-memory VehicleStore.
 * Zero MongoDB queries at runtime — MongoDB is only touched once at server startup.
 */

const vehicleStore = require('./vehicleStore');
const { calculateCarConfidence, DEFAULT_CONFIDENCE_THRESHOLD } = require('../utils/fuzzyMatch');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class CarService {
  /**
   * Check if a vehicle's year range matches the requested year filter.
   */
  _rowMatchesYearFilter(rowYearStr, yearMode = null, customYear = null) {
    if (!rowYearStr || rowYearStr === '-') return false;

    const foundYears = [...String(rowYearStr).matchAll(/\b\d{4}\b/g)].map(m =>
      parseInt(m[0], 10)
    );

    if (customYear && String(customYear).trim()) {
      const typed = String(customYear).trim().toLowerCase();
      const typedDigits = [...typed.matchAll(/\b\d{4}\b/g)].map(m => parseInt(m[0], 10));

      let targetYr = null;
      if (typedDigits.length) {
        targetYr = typedDigits[0];
      } else if (/^\d{2}$/.test(typed)) {
        const val = parseInt(typed, 10);
        targetYr = val > 50 ? 1900 + val : 2000 + val;
      }

      if (targetYr !== null && foundYears.length) {
        const minYear = Math.min(...foundYears);
        const isPresent = /present/i.test(String(rowYearStr));
        const maxYear = isPresent
          ? Math.max(new Date().getFullYear(), Math.max(...foundYears))
          : Math.max(...foundYears);
        return minYear <= targetYr && targetYr <= maxYear;
      }

      return String(rowYearStr).toLowerCase().includes(typed);
    }

    if (yearMode && foundYears.length) {
      const minYear = Math.min(...foundYears);
      const isPresent = /present/i.test(String(rowYearStr));
      const maxYear = isPresent
        ? Math.max(new Date().getFullYear(), Math.max(...foundYears))
        : Math.max(...foundYears);
      const mode = String(yearMode).trim().toLowerCase();
      if (mode === 'after 2020') return maxYear >= 2020;
      if (mode === 'before 2020') return minYear < 2020;
    }

    return true;
  }

  /**
   * Search vehicles from in-memory store (no MongoDB at runtime).
   */
  async searchCars({
    type = 'normal',
    brand = null,
    model = null,
    year_mode = null,
    custom_year = null,
    fuelType = null,
    query = null,
  } = {}) {
    await vehicleStore.ensureLoaded();
    // All filtering is done in memory
    let cars = vehicleStore.all();

    // Filter type
    const targetType = String(type).trim().toLowerCase() === 'premium' ? 'premium' : 'normal';
    cars = cars.filter(c => String(c.type || '').toLowerCase() === targetType);

    // Filter brand
    if (brand && brand.trim()) {
      const re = new RegExp(escapeRegExp(brand.trim()), 'i');
      cars = cars.filter(c => re.test(c.brand));
    }

    // Filter model
    if (model && model.trim()) {
      const re = new RegExp(escapeRegExp(model.trim()), 'i');
      cars = cars.filter(c => re.test(c.model));
    }

    // Filter fuel type
    if (fuelType && fuelType.trim()) {
      const re = new RegExp(escapeRegExp(fuelType.trim()), 'i');
      cars = cars.filter(c => re.test(c.fuelType));
    }

    // Free-text query: every word must match brand OR model OR variant
    if (query && query.trim()) {
      const words = query.trim().split(/\s+/).filter(Boolean);
      const wordRegs = words.map(w => new RegExp(escapeRegExp(w), 'i'));
      const exact = cars.filter(c =>
        wordRegs.every(re =>
          re.test(c.brand) || re.test(c.model) || re.test(c.variant || '')
        )
      );

      if (exact.length > 0) {
        cars = exact;
      } else {
        // Fuzzy confidence score fallback
        const scored = cars.map(c => ({
          car: c,
          score: calculateCarConfidence(query, c),
        }));
        scored.sort((a, b) => b.score - a.score);
        cars = scored
          .filter(item => item.score >= DEFAULT_CONFIDENCE_THRESHOLD)
          .map(item => {
            item.car.confidenceScore = item.score;
            return item.car;
          });
      }
    }

    // Year filter
    if (year_mode || custom_year) {
      cars = cars.filter(car =>
        this._rowMatchesYearFilter(car.year, year_mode, custom_year)
      );
    }

    return cars.map(c => ({
      id: c._id ? c._id.toString() : undefined,
      type: c.type,
      brand: c.brand,
      model: c.model,
      variant: c.variant,
      year: c.year,
      fuelType: c.fuelType,
      oil_capacity: c.oilCapacity,
      pricing_category: c.pricingCategory,
      mech_lite: c.mechLite,
      mech_basic: c.mechBasic,
      mech_pro: c.mechPro,
      confidence_score: c.confidenceScore !== undefined ? c.confidenceScore : 1.0,
      ...c.details,
    }));
  }

  /**
   * Get distinct dropdown options from in-memory store (no MongoDB at runtime).
   */
  async getOptions({
    type = 'normal',
    brand = null,
    model = null,
    fuelType = null,
  } = {}) {
    await vehicleStore.ensureLoaded();
    const targetType = String(type).trim().toLowerCase() === 'premium' ? 'premium' : 'normal';
    let all = vehicleStore.all().filter(c => String(c.type || '').toLowerCase() === targetType);

    const brands = [...new Set(all.map(c => c.brand).filter(Boolean))].sort();

    let filtered = all;
    if (brand && brand.trim()) {
      const re = new RegExp(brand.trim(), 'i');
      filtered = filtered.filter(c => re.test(c.brand));
    }
    const models = [...new Set(filtered.map(c => c.model).filter(Boolean))].sort();

    if (model && model.trim()) {
      const re = new RegExp(model.trim(), 'i');
      filtered = filtered.filter(c => re.test(c.model));
    }
    const variants = [...new Set(filtered.map(c => c.variant).filter(Boolean))].sort();
    const fuelTypes = [...new Set(filtered.map(c => c.fuelType).filter(Boolean))].sort();

    return {
      brands,
      models,
      variants,
      fuelTypes,
      yearModes: ['after 2020', 'before 2020'],
    };
  }
}

module.exports = new CarService();
