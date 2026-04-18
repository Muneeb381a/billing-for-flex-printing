import * as Q from '../db/queries/dashboard.js';

export const getSummary = async (_req, res) => {
  const { rows } = await Q.getSummary();
  res.json({ data: rows[0] });
};

export const getDailySales = async (req, res) => {
  const { days = 30 } = req.query;
  const { rows } = await Q.getDailySales({ days: Number(days) });
  res.json({ data: rows });
};

export const getMonthlySales = async (req, res) => {
  const { months = 12 } = req.query;
  const { rows } = await Q.getMonthlySales({ months: Number(months) });
  res.json({ data: rows });
};

export const getPendingOrders = async (req, res) => {
  const { limit = 20 } = req.query;
  const { rows } = await Q.getPendingOrders({ limit: Number(limit) });
  res.json({ data: rows });
};

export const getTopProducts = async (req, res) => {
  const { limit = 10, days = 30 } = req.query;
  const { rows } = await Q.getTopProducts({ limit: Number(limit), days: Number(days) });
  res.json({ data: rows });
};

export const getStockAlerts = async (_req, res) => {
  const { rows } = await Q.getStockAlerts();
  res.json({ data: rows });
};
