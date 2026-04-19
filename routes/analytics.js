const express = require('express');
const router = express.Router();

const Delivery = require('../models/delivery');
const Vehicle = require('../models/vehicle');
const Customer = require('../models/Customer');

function statusCounts(deliveries) {
  return deliveries.reduce(
    (acc, delivery) => {
      const status = typeof delivery.status === 'string' ? delivery.status.toLowerCase() : 'pending';
      if (status === 'delivered') acc.delivered += 1;
      else if (status === 'pending') acc.pending += 1;
      else if (status === 'transit') acc.in_transit += 1;
      else if (status === 'failed') acc.failed += 1;
      else if (status === 'cancelled') acc.cancelled += 1;
      return acc;
    },
    { delivered: 0, pending: 0, in_transit: 0, failed: 0, cancelled: 0 }
  );
}

// GET /api/analytics/overview
router.get('/overview', async (req, res, next) => {
  try {
    const deliveries = await Delivery.find().select('status dist createdAt').lean();
    const vehicles = await Vehicle.find().select('status').lean();

    const counts = statusCounts(deliveries);
    const total = deliveries.length;
    const totalDist = deliveries.reduce((sum, delivery) => sum + (Number(delivery.dist) || 0), 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayDist = deliveries
      .filter((delivery) => delivery.createdAt && new Date(delivery.createdAt) >= todayStart)
      .reduce((sum, delivery) => sum + (Number(delivery.dist) || 0), 0);

    const successRate = total > 0 ? Number(((counts.delivered / total) * 100).toFixed(1)) : 0;

    const vehicleStats = {
      total_vehicles: vehicles.length,
      active: vehicles.filter((vehicle) => vehicle.status === 'active').length,
      idle: vehicles.filter((vehicle) => vehicle.status === 'idle').length,
    };

    res.json({
      deliveries: {
        total,
        ...counts,
        avg_distance_km: total > 0 ? Number((totalDist / total).toFixed(2)) : 0,
        success_rate: successRate,
      },
      vehicles: vehicleStats,
      total_distance_km: Number(todayDist.toFixed(1)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/deliveries-by-day
router.get('/deliveries-by-day', async (req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const rows = await Delivery.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'delivered'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'failed'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(rows.map((row) => ({ date: row._id, total: row.total, delivered: row.delivered, failed: row.failed })));
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/deliveries-by-status
router.get('/deliveries-by-status', async (req, res, next) => {
  try {
    const rows = await Delivery.aggregate([
      {
        $group: {
          _id: { $toLower: '$status' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json(rows.map((row) => ({ status: row._id || 'pending', count: row.count })));
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/vehicle-performance
router.get('/vehicle-performance', async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find().lean();
    const grouped = await Delivery.aggregate([
      { $match: { vehicleId: { $ne: null } } },
      {
        $group: {
          _id: '$vehicleId',
          total_deliveries: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'delivered'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'failed'] }, 1, 0] },
          },
          total_km: { $sum: { $ifNull: ['$dist', 0] } },
        },
      },
    ]);

    const perfMap = new Map(grouped.map((entry) => [entry._id.toString(), entry]));

    const rows = vehicles
      .map((vehicle) => {
        const perf = perfMap.get(vehicle._id.toString()) || {
          total_deliveries: 0,
          delivered: 0,
          failed: 0,
          total_km: 0,
        };

        return {
          vehicle: vehicle.name,
          type: vehicle.type,
          total_deliveries: perf.total_deliveries,
          delivered: perf.delivered,
          failed: perf.failed,
          total_km: Number((perf.total_km || 0).toFixed(1)),
        };
      })
      .sort((a, b) => b.total_deliveries - a.total_deliveries);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/top-customers
router.get('/top-customers', async (req, res, next) => {
  try {
    const rows = await Delivery.aggregate([
      {
        $group: {
          _id: '$customerName',
          total_orders: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'delivered'] }, 1, 0] },
          },
          address: { $first: '$address' },
        },
      },
      { $sort: { total_orders: -1 } },
      { $limit: 10 },
    ]);

    res.json(
      rows.map((row) => ({
        name: row._id || 'Unknown Customer',
        address: row.address || '',
        total_orders: row.total_orders,
        completed: row.completed,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/hourly-distribution
router.get('/hourly-distribution', async (req, res, next) => {
  try {
    const deliveries = await Delivery.find().select('eta').lean();
    const buckets = new Map();

    deliveries.forEach((delivery) => {
      if (typeof delivery.eta !== 'string') return;
      const hour = delivery.eta.slice(0, 2);
      if (!/^\d{2}$/.test(hour)) return;
      buckets.set(hour, (buckets.get(hour) || 0) + 1);
    });

    const rows = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count }));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res) => {
  try {
    const [deliveries, vehicles, customers] = await Promise.all([
      Delivery.countDocuments(),
      Vehicle.countDocuments(),
      Customer.countDocuments(),
    ]);

    res.json({ deliveries, vehicles, customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
