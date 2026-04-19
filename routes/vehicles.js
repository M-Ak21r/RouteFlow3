const express = require('express');
const router = express.Router();

const Vehicle = require('../models/vehicle');
const Delivery = require('../models/delivery');

function normalizeStatus(status) {
  return typeof status === 'string' ? status.toLowerCase() : 'pending';
}

// GET /api/vehicles
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};

    const vehicles = await Vehicle.find(query).sort({ name: 1 }).lean();
    const vehicleIds = vehicles.map((vehicle) => vehicle._id);

    const deliveryStats = vehicleIds.length
      ? await Delivery.aggregate([
          { $match: { vehicleId: { $in: vehicleIds } } },
          {
            $group: {
              _id: '$vehicleId',
              total_deliveries: { $sum: 1 },
              active_stops: {
                $sum: {
                  $cond: [
                    { $in: [{ $toLower: '$status' }, ['pending', 'transit']] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
      : [];

    const statMap = new Map(deliveryStats.map((entry) => [entry._id.toString(), entry]));

    res.json(
      vehicles.map((vehicle) => {
        const stats = statMap.get(vehicle._id.toString()) || { total_deliveries: 0, active_stops: 0 };
        return {
          ...vehicle,
          id: vehicle._id.toString(),
          total_deliveries: stats.total_deliveries,
          active_stops: stats.active_stops,
          driver_name: vehicle.driverName || null,
          driver_email: vehicle.driverEmail || null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/vehicles/:id
router.get('/:id', async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).lean();
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const deliveries = await Delivery.find({ vehicleId: vehicle._id })
      .sort({ stopOrder: 1, createdAt: -1 })
      .lean();

    res.json({
      ...vehicle,
      id: vehicle._id.toString(),
      driver_name: vehicle.driverName || null,
      driver_email: vehicle.driverEmail || null,
      deliveries: deliveries.map((delivery) => ({
        ...delivery,
        id: delivery._id.toString(),
        status: normalizeStatus(delivery.status),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/vehicles
router.post('/', async (req, res, next) => {
  try {
    const { name, type, plate, capacity, status, driverName, driverEmail } = req.body;

    if (!name || !type || !plate) {
      return res.status(400).json({ error: 'name, type, and plate are required' });
    }

    const existing = await Vehicle.findOne({ plate }).select('_id').lean();
    if (existing) return res.status(409).json({ error: 'Plate number already exists' });

    const vehicle = await Vehicle.create({
      name,
      type,
      plate,
      capacity: Number(capacity) || 100,
      status: status || 'idle',
      driverName: driverName || undefined,
      driverEmail: driverEmail || undefined,
    });

    req.io.emit('vehicle:added', { id: vehicle._id.toString(), name: vehicle.name });
    res.status(201).json({ ...vehicle.toObject(), id: vehicle._id.toString() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/vehicles/:id
router.put('/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body };

    if (updates.capacity != null) {
      updates.capacity = Number(updates.capacity);
      if (!Number.isFinite(updates.capacity)) {
        return res.status(400).json({ error: 'capacity must be a valid number' });
      }
    }

    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    req.io.emit('vehicle:updated', { id: vehicle._id.toString(), vehicle });
    res.json({ ...vehicle, id: vehicle._id.toString() });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/vehicles/:id/location
router.patch('/:id/location', async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { lat: parsedLat, lng: parsedLng },
      { new: true }
    ).lean();

    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    req.io.emit('vehicle:locationUpdated', {
      id: vehicle._id.toString(),
      lat: parsedLat,
      lng: parsedLng,
      name: vehicle.name,
    });

    res.json({ id: vehicle._id.toString(), lat: parsedLat, lng: parsedLng });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/vehicles/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['idle', 'active', 'maintenance', 'offline'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    req.io.emit('vehicle:statusChanged', { id: vehicle._id.toString(), status });
    res.json({ ...vehicle, id: vehicle._id.toString() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/vehicles/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).lean();
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    await Delivery.updateMany({ vehicleId: vehicle._id }, { $unset: { vehicleId: '' } });
    await Vehicle.findByIdAndDelete(req.params.id);

    req.io.emit('vehicle:deleted', { id: req.params.id });
    res.json({ message: 'Vehicle deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
