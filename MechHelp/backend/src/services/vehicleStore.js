/**
 * vehicleStore.js
 *
 * Loads ALL vehicles from MongoDB once at server startup and keeps them in memory.
 * Every API request for vehicle data is served from this in-memory store —
 * MongoDB is NEVER queried at runtime, protecting the M0 free tier connection limit.
 *
 * To refresh (e.g. after manually adding a vehicle in Atlas):
 *   Call vehicleStore.load() again, or hit POST /api/cars/refresh
 */

const Car = require('../models/Car');

class VehicleStore {
  constructor() {
    this._cars = [];        // flat array of all vehicle plain objects
    this._loaded = false;
    this._loading = null;   // promise guard — prevents double-load on startup
  }

  /**
   * Load all vehicles from MongoDB into memory.
   * Safe to call multiple times — concurrent calls share a single DB query.
   */
  async load() {
    // If already loading, wait for that to finish instead of firing another query
    if (this._loading) return this._loading;

    this._loading = (async () => {
      try {
        const connectDB = require('../db');
        await connectDB();
        const raw = await Car.find({}).lean();
        this._cars = raw;
        this._loaded = true;
        console.log(`🚗 VehicleStore: loaded ${this._cars.length} vehicles into memory`);
      } catch (err) {
        console.error('VehicleStore: failed to load vehicles from MongoDB:', err.message);
        throw err;
      } finally {
        this._loading = null;
      }
    })();

    return this._loading;
  }

  /**
   * Ensure store is loaded into memory. If not yet loaded, loads now.
   */
  async ensureLoaded() {
    if (this._loaded && this._cars.length > 0) return;
    await this.load();
  }

  /**
   * Returns all in-memory vehicles (optionally filtered by type).
   * Throws if store hasn't been loaded yet.
   */
  all(type = null) {
    this._assertLoaded();
    if (!type) return this._cars;
    const t = String(type).trim().toLowerCase();
    return this._cars.filter(c => String(c.type || '').toLowerCase() === t);
  }

  /**
   * Full-text search across brand, model, variant.
   * Supports per-word AND matching (all words must appear somewhere in the record).
   */
  search({ brand, model, fuelType, query, type } = {}) {
    this._assertLoaded();
    let results = this._cars;

    // Filter by type (normal / premium)
    if (type) {
      const t = String(type).trim().toLowerCase() === 'premium' ? 'premium' : 'normal';
      results = results.filter(c => String(c.type || '').toLowerCase() === t);
    }

    // Filter by brand
    if (brand && brand.trim()) {
      const re = new RegExp(escapeRegExp(brand.trim()), 'i');
      results = results.filter(c => re.test(c.brand));
    }

    // Filter by model
    if (model && model.trim()) {
      const re = new RegExp(escapeRegExp(model.trim()), 'i');
      results = results.filter(c => re.test(c.model));
    }

    // Filter by fuel type
    if (fuelType && fuelType.trim()) {
      const re = new RegExp('^' + escapeRegExp(fuelType.trim()), 'i');
      results = results.filter(c => re.test(c.fuelType));
    }

    // Free-text query: every word must match brand OR model OR variant
    if (query && query.trim()) {
      const words = query.trim().split(/\s+/).filter(Boolean);
      const wordRegs = words.map(w => new RegExp(escapeRegExp(w), 'i'));
      results = results.filter(c =>
        wordRegs.every(re =>
          re.test(c.brand) || re.test(c.model) || re.test(c.variant || '')
        )
      );
    }

    return results;
  }

  /**
   * Distinct values for dropdown options.
   */
  distinct(field, filter = {}) {
    this._assertLoaded();
    let items = this._cars;

    if (filter.type) {
      const t = String(filter.type).trim().toLowerCase() === 'premium' ? 'premium' : 'normal';
      items = items.filter(c => String(c.type || '').toLowerCase() === t);
    }
    if (filter.brand) {
      const re = new RegExp(escapeRegExp(filter.brand), 'i');
      items = items.filter(c => re.test(c.brand));
    }
    if (filter.model) {
      const re = new RegExp(escapeRegExp(filter.model), 'i');
      items = items.filter(c => re.test(c.model));
    }

    const values = [...new Set(items.map(c => c[field]).filter(Boolean))].sort();
    return values;
  }

  get count() {
    return this._cars.length;
  }

  get isLoaded() {
    return this._loaded;
  }

  _assertLoaded() {
    if (!this._loaded) {
      throw new Error('VehicleStore not loaded yet. Call vehicleStore.load() first.');
    }
  }
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Export a singleton — same instance shared across all requires
module.exports = new VehicleStore();
