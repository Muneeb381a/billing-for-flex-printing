import pool from '../config/db.js';
import * as Q from '../db/queries/inventory.js';
import * as invSvc from '../services/inventoryService.js';
import { createError } from '../middleware/errorHandler.js';

// ── Inventory Items ───────────────────────────────────────────

export const getAll = async (req, res) => {
  const activeOnly = req.query.active !== 'false';
  const { rows } = await Q.findAll({ activeOnly });
  res.json({ data: rows });
};

export const getById = async (req, res, next) => {
  const { rows } = await Q.findById(req.params.id);
  if (!rows.length) return next(createError(404, 'Inventory item not found'));

  const { rows: movements } = await Q.getMovements(req.params.id, { limit: 100 });
  res.json({ data: rows[0], movements });
};

const toNum  = (v, fallback = 0)    => { const n = parseFloat(v); return isNaN(n) ? fallback : n; };
const toNumN = (v, fallback = null) => { const n = parseFloat(v); return isNaN(n) ? fallback : n; };

export const create = async (req, res) => {
  const { name, unit, currentStock, warningThreshold, criticalThreshold, reorderPoint, costPerUnit, supplierName, notes } = req.body;
  if (!name?.trim()) throw createError(400, 'name is required');

  const { rows } = await Q.create({
    name:              name.trim(),
    unit:              unit || 'pcs',
    currentStock:      toNum(currentStock, 0),
    warningThreshold:  toNum(warningThreshold, 0),
    criticalThreshold: toNum(criticalThreshold, 0),
    reorderPoint:      toNum(reorderPoint, 0),
    costPerUnit:       toNumN(costPerUnit),
    supplierName:      supplierName || null,
    notes:             notes        || null,
  });
  res.status(201).json({ data: rows[0] });
};

export const update = async (req, res, next) => {
  const { name, unit, warningThreshold, criticalThreshold, reorderPoint, costPerUnit, supplierName, notes, isActive } = req.body;
  const { rows } = await Q.update(req.params.id, {
    name, unit, warningThreshold, criticalThreshold, reorderPoint, costPerUnit, supplierName, notes, isActive,
  });
  if (!rows.length) return next(createError(404, 'Inventory item not found'));
  res.json({ data: rows[0] });
};

// ── Stock operations ──────────────────────────────────────────

export const restock = async (req, res, next) => {
  const { quantity, notes } = req.body;
  if (!quantity || quantity <= 0) return next(createError(400, 'quantity must be > 0'));

  const item = await invSvc.recordPurchase(pool, {
    itemId: Number(req.params.id),
    quantity: Number(quantity),
    notes,
  });
  res.json({ data: item });
};

export const adjust = async (req, res, next) => {
  const { newStock, notes } = req.body;
  if (newStock == null || newStock < 0) return next(createError(400, 'newStock must be >= 0'));

  const item = await invSvc.adjustToAbsolute(pool, {
    itemId: Number(req.params.id),
    newStock: Number(newStock),
    notes,
  });
  res.json({ data: item });
};

export const getMovements = async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const { rows } = await Q.getMovements(req.params.id, { limit: Number(limit), offset: Number(offset) });
  res.json({ data: rows });
};

// ── Product → Inventory mappings ──────────────────────────────

export const getMappings = async (req, res) => {
  const { rows } = await Q.getMappingsForProduct(req.params.productId);
  res.json({ data: rows });
};

export const upsertMapping = async (req, res, next) => {
  const { inventoryItemId, qtyPerUnit, useSqft } = req.body;
  if (!inventoryItemId) return next(createError(400, 'inventoryItemId is required'));

  const { rows } = await Q.upsertMapping(req.params.productId, inventoryItemId, { qtyPerUnit, useSqft });
  res.json({ data: rows[0] });
};

export const deleteMapping = async (req, res, next) => {
  const { rows } = await Q.deleteMapping(req.params.productId, req.params.inventoryItemId);
  if (!rows.length) return next(createError(404, 'Mapping not found'));
  res.json({ message: 'Mapping removed' });
};

// ── Dashboard alerts ──────────────────────────────────────────

export const getAlerts = async (_req, res) => {
  const { rows } = await Q.getLowStockAlerts();
  res.json({ data: rows });
};
