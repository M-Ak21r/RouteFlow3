const express = require('express');
const router = express.Router();

const Delivery = require('../models/delivery');
const DeliveryEvent = require('../models/DeliveryEvent');
const Vehicle = require('../models/vehicle');

function normalizeDelivery(delivery) {
  if (!delivery) return delivery;

  const lat = delivery.lat ?? delivery.latitude ?? null;
  const lng = delivery.lng ?? delivery.longitude ?? null;
  const normalizedStatus = typeof delivery.status === 'string'
    ? delivery.status.toLowerCase()
    : 'pending';

  return {
    ...delivery,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    status: normalizedStatus,
    id: delivery._id?.toString() || delivery.id || delivery.orderId,
    orderId: delivery.orderId || delivery.id || delivery._id?.toString(),
    name: delivery.name || delivery.customerName || 'Unknown Customer',
    customerName: delivery.customerName || delivery.name || 'Unknown Customer',
    priority: delivery.priority || 'medium',
    type: delivery.type || 'Standard',
    eta: delivery.eta || 'TBD',
    dist: typeof delivery.dist === 'number' ? delivery.dist : 0,
    notes: delivery.notes || '',
  };
}

async function getNextOrderId() {
  const lastDelivery = await Delivery.findOne({ orderId: /^DEL-\d+$/ })
    .sort({ createdAt: -1 })
    .select('orderId')
    .lean();

  const lastNumber = Number.parseInt(lastDelivery?.orderId?.replace('DEL-', ''), 10);
  const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : await Delivery.countDocuments() + 1;
  return `DEL-${String(nextNumber).padStart(3, '0')}`;
}

async function syncVehicleStatus(vehicleId) {
  if (!vehicleId) return null;

  const activeDeliveries = await Delivery.countDocuments({
    vehicleId,
    status: { $in: ['pending', 'transit'] },
  });

  const nextStatus = activeDeliveries > 0 ? 'active' : 'idle';
  const vehicle = await Vehicle.findByIdAndUpdate(vehicleId, { status: nextStatus }, { new: true }).lean();

  return vehicle
    ? { ...vehicle, id: vehicle._id.toString(), status: nextStatus }
    : null;
}

// ---------------- FILTER ----------------
async function buildDeliveryFilter({ status, search }) {
  const filter = {};

  if (status) filter.status = String(status).toLowerCase();

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { orderId: regex },
      { customerName: regex }
    ];
  }

  return filter;
}

// ---------------- GET ALL ----------------
router.get('/', async (req, res, next) => {
  try {
    const filter = await buildDeliveryFilter(req.query);

    const rawDeliveries = await Delivery.find(filter)
      .sort({ _id: -1 })
      .lean();

    const deliveries = rawDeliveries.map(normalizeDelivery);

    const stats = {
      total: deliveries.length,
      delivered: deliveries.filter((delivery) => delivery.status === 'delivered').length,
      pending: deliveries.filter((delivery) => delivery.status === 'pending').length,
      in_transit: deliveries.filter((delivery) => delivery.status === 'transit').length,
      failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
    };

    res.json({ deliveries, stats });

  } catch (err) {
    next(err);
  }
});

// ---------------- GET BY ID ----------------
router.get('/:id', async (req, res, next) => {
  try {
    const rawDelivery = await Delivery.findById(req.params.id).lean();
    const delivery = normalizeDelivery(rawDelivery);

    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const events = await DeliveryEvent.find({ delivery_id: req.params.id })
      .sort({ created_at: -1 })
      .lean();

    res.json({ ...delivery, events });

  } catch (err) {
    next(err);
  }
});

// ---------------- CREATE ----------------
router.post('/', async (req, res, next) => {
  try {
    const {
      orderId,
      customerName,
      name,
      address,
      lat,
      lng,
      latitude,
      longitude,
      priority,
      type,
      eta,
      dist,
      notes,
      vehicleId
    } = req.body;

    const finalName = String(customerName || name || '').trim();
    const finalAddress = String(address || '').trim();
    const normalizedLat = Number(lat ?? latitude);
    const normalizedLng = Number(lng ?? longitude);

    if (!finalName || !finalAddress) {
      return res.status(400).json({ error: 'customerName and address are required' });
    }

    if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }

    const delivery = await Delivery.create({
      orderId: orderId || await getNextOrderId(),
      name: finalName,
      customerName: finalName,
      address: finalAddress,
      lat: normalizedLat,
      lng: normalizedLng,
      latitude: normalizedLat,
      longitude: normalizedLng,
      priority,
      type,
      eta,
      dist,
      notes,
      vehicleId: vehicleId || undefined,
      status: 'pending'
    });

    await DeliveryEvent.create({
      delivery_id: delivery._id,
      eventType: 'NEW_DELIVERY',
      event_type: 'created',
      message: `Delivery ${delivery.orderId || delivery._id.toString()} created`,
      userId: req.user?.id || null,
      details: { orderId: delivery.orderId, address: delivery.address, priority: delivery.priority },
      timestamp: new Date(),
    });

    if (req.io) {
      const eventDoc = await DeliveryEvent.findOne({ delivery_id: delivery._id, eventType: 'NEW_DELIVERY' }).lean();
      req.io.emit('delivery:created', normalizeDelivery(delivery.toObject()));
      // Broadcast new audit event for the Activity Log
      if (eventDoc) {
        req.io.emit('analytics:newEvent', {
          _id: eventDoc._id,
          eventType: eventDoc.eventType,
          timestamp: eventDoc.timestamp,
          message: eventDoc.message,
          details: eventDoc.details,
          driverId: eventDoc.driverId || null,
        });
      }
      if (delivery.vehicleId) {
        const syncedVehicle = await syncVehicleStatus(delivery.vehicleId);
        if (syncedVehicle) {
          req.io.emit('vehicle:statusChanged', { id: syncedVehicle.id, status: syncedVehicle.status, vehicle: syncedVehicle });
        }
      }
    }

    res.status(201).json(normalizeDelivery(delivery.toObject()));

  } catch (err) {
    next(err);
  }
});

// ---------------- UPDATE STATUS ----------------
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const normalizedStatus = String(status || '').toLowerCase();
    const validStatuses = ['pending', 'transit', 'delivered', 'failed', 'cancelled'];

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      { status: normalizedStatus },
      { new: true }
    ).lean();

    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    await DeliveryEvent.create({
      delivery_id: delivery._id,
      eventType: 'STATUS_CHANGE',
      event_type: 'status_changed',
      message: `Delivery ${delivery.orderId || delivery._id.toString()} marked as ${normalizedStatus}`,
      userId: req.user?.id || null,
      details: { orderId: delivery.orderId, status: normalizedStatus, previousStatus: delivery.status },
      timestamp: new Date(),
    });

    let syncedVehicle = null;
    if (delivery.vehicleId) {
      syncedVehicle = await syncVehicleStatus(delivery.vehicleId);
    }

    if (req.io) {
      const eventDoc = await DeliveryEvent.findOne({ delivery_id: delivery._id, eventType: 'STATUS_CHANGE' })
        .sort({ timestamp: -1 })
        .lean();

      req.io.emit('delivery:statusChanged', { id: delivery._id.toString(), status: normalizedStatus, delivery: normalizeDelivery(delivery) });
      req.io.emit('DELIVERY_UPDATED', { id: delivery._id.toString(), status: normalizedStatus });

      // Broadcast new audit event for the Activity Log
      if (eventDoc) {
        req.io.emit('analytics:newEvent', {
          _id: eventDoc._id,
          eventType: eventDoc.eventType,
          timestamp: eventDoc.timestamp,
          message: eventDoc.message,
          details: eventDoc.details,
          driverId: eventDoc.driverId || null,
        });
      }

      if (syncedVehicle) {
        req.io.emit('vehicle:statusChanged', { id: syncedVehicle.id, status: syncedVehicle.status, vehicle: syncedVehicle });
      }
    }

    res.json(normalizeDelivery(delivery));

  } catch (err) {
    next(err);
  }
});

// ---------------- UPDATE ----------------
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await Delivery.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Delivery not found' });

    const updates = { ...req.body };

    if (updates.lat != null || updates.latitude != null) {
      const normalizedLat = updates.lat ?? updates.latitude;
      updates.lat = normalizedLat;
      updates.latitude = normalizedLat;
    }

    if (updates.lng != null || updates.longitude != null) {
      const normalizedLng = updates.lng ?? updates.longitude;
      updates.lng = normalizedLng;
      updates.longitude = normalizedLng;
    }

    if (typeof updates.status === 'string') {
      updates.status = updates.status.toLowerCase();
    }

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).lean();

    const vehicleIdsToSync = [existing.vehicleId, delivery.vehicleId]
      .filter(Boolean)
      .map((value) => value.toString());

    if (vehicleIdsToSync.length) {
      const uniqueVehicleIds = [...new Set(vehicleIdsToSync)];
      const syncedVehicles = await Promise.all(uniqueVehicleIds.map((vehicleId) => syncVehicleStatus(vehicleId)));

      if (req.io) {
        syncedVehicles.filter(Boolean).forEach((vehicle) => {
          req.io.emit('vehicle:statusChanged', { id: vehicle.id, status: vehicle.status, vehicle });
        });
      }
    }

    res.json(normalizeDelivery(delivery));

  } catch (err) {
    next(err);
  }
});

// ---------------- DELETE ----------------
router.delete('/:id', async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id).lean();
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    await Delivery.findByIdAndDelete(req.params.id);

    res.json({ message: 'Delivery deleted successfully' });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
