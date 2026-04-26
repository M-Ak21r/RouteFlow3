// const express = require('express');
// const router = express.Router();
// // const { getDB } = require('../db/database');

// // GET /api/deliveries - list all with filters
// router.get('/', (req, res) => {
//   const db = getDB();
//   const { status, vehicle_id, search, date } = req.query;

//   let query = `
//     SELECT d.*, c.name as customer_name, c.address, c.lat, c.lng, c.phone,
//            v.name as vehicle_name, v.type as vehicle_type
//     FROM deliveries d
//     JOIN customers c ON d.customer_id = c.id
//     LEFT JOIN vehicles v ON d.vehicle_id = v.id
//     WHERE 1=1
//   `;
//   const params = [];

//   if (status)     { query += ` AND d.status = ?`;                            params.push(status); }
//   if (vehicle_id) { query += ` AND d.vehicle_id = ?`;                        params.push(vehicle_id); }
//   if (search)     { query += ` AND (c.name LIKE ? OR d.delivery_number LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
//   if (date)       { query += ` AND DATE(d.created_at) = ?`;                  params.push(date); }

//   query += ` ORDER BY d.stop_order ASC`;

//   const deliveries = db.prepare(query).all(...params);

//   // Summary stats
//   const stats = db.prepare(`
//     SELECT
//       COUNT(*) as total,
//       SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
//       SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) as pending,
//       SUM(CASE WHEN status='transit'   THEN 1 ELSE 0 END) as in_transit,
//       SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) as failed
//     FROM deliveries
//   `).get();

//   res.json({ deliveries, stats });
// });

// // GET /api/deliveries/:id
// router.get('/:id', (req, res) => {
//   const db = getDB();
//   const delivery = db.prepare(`
//     SELECT d.*, c.name as customer_name, c.address, c.lat, c.lng, c.phone, c.email,
//            v.name as vehicle_name, v.type as vehicle_type, v.plate
//     FROM deliveries d
//     JOIN customers c ON d.customer_id = c.id
//     LEFT JOIN vehicles v ON d.vehicle_id = v.id
//     WHERE d.id = ?
//   `).get(req.params.id);

//   if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//   const events = db.prepare(`SELECT * FROM delivery_events WHERE delivery_id = ? ORDER BY created_at DESC`).all(req.params.id);
//   res.json({ ...delivery, events });
// });

// // POST /api/deliveries - create new delivery
// router.post('/', (req, res) => {
//   const db = getDB();
//   const { customer_id, vehicle_id, scheduled_time, priority, notes } = req.body;

//   if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

//   // Auto-generate delivery number
//   const count = db.prepare(`SELECT COUNT(*) as c FROM deliveries`).get().c;
//   const delivery_number = `DEL-${String(count + 1).padStart(3, '0')}`;

//   // Distance from depot (Distribution Centre: 28.6304, 77.2177)
//   const customer = db.prepare(`SELECT lat, lng FROM customers WHERE id = ?`).get(customer_id);
//   const distance = customer ? haversine(28.6304, 77.2177, customer.lat, customer.lng) : 0;

//   const result = db.prepare(`
//     INSERT INTO deliveries (delivery_number, customer_id, vehicle_id, status, scheduled_time, priority, notes, stop_order, distance_from_depot)
//     VALUES (?, ?, ?, 'pending', ?, ?, ?, (SELECT COALESCE(MAX(stop_order), 0) + 1 FROM deliveries), ?)
//   `).run(delivery_number, customer_id, vehicle_id || null, scheduled_time || null, priority || 'normal', notes || null, distance.toFixed(1));

//   const delivery = db.prepare(`SELECT * FROM deliveries WHERE id = ?`).get(result.lastInsertRowid);

//   // Emit real-time event
//   req.io.emit('delivery:created', delivery);
//   logEvent(db, delivery.id, 'created', 'Delivery created');

//   res.status(201).json(delivery);
// });

// // PATCH /api/deliveries/:id/status - update status
// router.patch('/:id/status', (req, res) => {
//   const db = getDB();
//   const { status } = req.body;
//   const validStatuses = ['pending', 'transit', 'delivered', 'failed', 'cancelled'];

//   if (!validStatuses.includes(status)) {
//     return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
//   }

//   const deliveredAt = status === 'delivered' ? new Date().toISOString() : null;
//   db.prepare(`UPDATE deliveries SET status = ?, delivered_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
//     .run(status, deliveredAt, req.params.id);

//   const delivery = db.prepare(`SELECT * FROM deliveries WHERE id = ?`).get(req.params.id);
//   if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//   logEvent(db, delivery.id, 'status_change', `Status changed to ${status}`);
//   req.io.emit('delivery:statusChanged', { id: delivery.id, status, delivery });

//   res.json(delivery);
// });

// // PUT /api/deliveries/:id - full update
// router.put('/:id', (req, res) => {
//   const db = getDB();
//   const { vehicle_id, scheduled_time, priority, notes, status } = req.body;

//   db.prepare(`
//     UPDATE deliveries SET vehicle_id=?, scheduled_time=?, priority=?, notes=?, status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP
//     WHERE id = ?
//   `).run(vehicle_id, scheduled_time, priority, notes, status, req.params.id);

//   const delivery = db.prepare(`SELECT * FROM deliveries WHERE id = ?`).get(req.params.id);
//   if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//   req.io.emit('delivery:updated', delivery);
//   res.json(delivery);
// });

// // DELETE /api/deliveries/:id
// router.delete('/:id', (req, res) => {
//   const db = getDB();
//   const delivery = db.prepare(`SELECT * FROM deliveries WHERE id = ?`).get(req.params.id);
//   if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//   db.prepare(`DELETE FROM delivery_events WHERE delivery_id = ?`).run(req.params.id);
//   db.prepare(`DELETE FROM deliveries WHERE id = ?`).run(req.params.id);
//   req.io.emit('delivery:deleted', { id: parseInt(req.params.id) });

//   res.json({ message: 'Delivery deleted successfully' });
// });

// // GET /api/deliveries/:id/events - timeline
// router.get('/:id/events', (req, res) => {
//   const db = getDB();
//   const events = db.prepare(`SELECT * FROM delivery_events WHERE delivery_id = ? ORDER BY created_at DESC`).all(req.params.id);
//   res.json(events);
// });

// // --- Helpers ---
// function logEvent(db, deliveryId, type, message) {
//   db.prepare(`INSERT INTO delivery_events (delivery_id, event_type, message) VALUES (?, ?, ?)`).run(deliveryId, type, message);
// }

// function haversine(lat1, lon1, lat2, lon2) {
//   const R = 6371;
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLon = (lon2 - lon1) * Math.PI / 180;
//   const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
// }

// module.exports = router;


// const express = require('express');
// const router = express.Router();

// const Delivery = require('../models/Delivery');
// const Customer = require('../models/Customer');
// const Vehicle = require('../models/Vehicle');
// const DeliveryEvent = require('../models/DeliveryEvent');

// async function buildDeliveryFilter({ status, vehicle_id, search, date }) {
//   const filter = {};
//   if (status) filter.status = status;
//   if (vehicle_id) filter.vehicle_id = vehicle_id;
//   if (date) {
//     const start = new Date(date);
//     if (!isNaN(start)) {
//       const end = new Date(start);
//       end.setDate(end.getDate() + 1);
//       filter.created_at = { $gte: start, $lt: end };
//     }
//   }

//   if (search) {
//     const regex = new RegExp(search, 'i');
//     const customerIds = await Customer.find({ name: regex }).select('_id').lean();
//     filter.$or = [{ delivery_number: regex }];
//     if (customerIds.length) {
//       filter.$or.push({ customer_id: { $in: customerIds.map((c) => c._id) } });
//     }
//   }

//   return filter;
// }

// router.get('/', async (req, res, next) => {
//   try {
//     const filter = await buildDeliveryFilter(req.query);
//     const deliveries = await Delivery.find(filter)
//       .sort({ stop_order: 1 })
//       .populate('customer_id', 'name address lat lng phone email')
//       .populate('vehicle_id', 'name type plate')
//       .lean();

//     const statsAggregation = await Delivery.aggregate([
//       {
//         $group: {
//           _id: null,
//           total: { $sum: 1 },
//           delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
//           pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
//           in_transit: { $sum: { $cond: [{ $eq: ['$status', 'transit'] }, 1, 0] } },
//           failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
//         },
//       },
//     ]);

//     const stats = statsAggregation[0] || {
//       total: 0,
//       delivered: 0,
//       pending: 0,
//       in_transit: 0,
//       failed: 0,
//     };

//     res.json({ deliveries, stats });
//   } catch (err) {
//     next(err);
//   }
// });

// router.get('/:id', async (req, res, next) => {
//   try {
//     const delivery = await Delivery.findById(req.params.id)
//       .populate('customer_id', 'name address lat lng phone email')
//       .populate('vehicle_id', 'name type plate')
//       .lean();

//     if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//     const events = await DeliveryEvent.find({ delivery_id: req.params.id })
//       .sort({ created_at: -1 })
//       .lean();

//     res.json({ ...delivery, events });
//   } catch (err) {
//     next(err);
//   }
// });

// router.post('/', async (req, res, next) => {
//   try {
//     const { customer_id, vehicle_id, scheduled_time, priority, notes } = req.body;
//     if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

//     const count = await Delivery.countDocuments();
//     const delivery_number = `DEL-${String(count + 1).padStart(3, '0')}`;

//     const customer = await Customer.findById(customer_id).lean();
//     const distance = customer ? haversine(28.6304, 77.2177, customer.lat, customer.lng) : 0;

//     const delivery = await Delivery.create({
//       delivery_number,
//       customer_id,
//       vehicle_id: vehicle_id || null,
//       status: 'pending',
//       scheduled_time: scheduled_time || null,
//       priority: priority || 'normal',
//       notes: notes || null,
//       stop_order: await getNextStopOrder(),
//       distance_from_depot: Number(distance.toFixed(1)),
//     });

//     req.io.emit('delivery:created', delivery);
//     await logEvent(delivery._id, 'created', 'Delivery created');

//     res.status(201).json(delivery);
//   } catch (err) {
//     next(err);
//   }
// });

// router.patch('/:id/status', async (req, res, next) => {
//   try {
//     const { status } = req.body;
//     const validStatuses = ['pending', 'transit', 'delivered', 'failed', 'cancelled'];

//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
//     }

//     const deliveredAt = status === 'delivered' ? new Date() : null;
//     const delivery = await Delivery.findByIdAndUpdate(
//       req.params.id,
//       { status, delivered_at: deliveredAt, updated_at: new Date() },
//       { new: true }
//     ).lean();

//     if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//     await logEvent(delivery._id, 'status_change', `Status changed to ${status}`);
//     req.io.emit('delivery:statusChanged', { id: delivery._id, status, delivery });

//     res.json(delivery);
//   } catch (err) {
//     next(err);
//   }
// });

// router.put('/:id', async (req, res, next) => {
//   try {
//     const { vehicle_id, scheduled_time, priority, notes, status } = req.body;

//     const delivery = await Delivery.findByIdAndUpdate(
//       req.params.id,
//       {
//         vehicle_id,
//         scheduled_time,
//         priority,
//         notes,
//         ...(status ? { status } : {}),
//         updated_at: new Date(),
//       },
//       { new: true }
//     ).lean();

//     if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//     req.io.emit('delivery:updated', delivery);
//     res.json(delivery);
//   } catch (err) {
//     next(err);
//   }
// });

// router.delete('/:id', async (req, res, next) => {
//   try {
//     const delivery = await Delivery.findById(req.params.id).lean();
//     if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

//     await DeliveryEvent.deleteMany({ delivery_id: req.params.id });
//     await Delivery.findByIdAndDelete(req.params.id);

//     req.io.emit('delivery:deleted', { id: req.params.id });
//     res.json({ message: 'Delivery deleted successfully' });
//   } catch (err) {
//     next(err);
//   }
// });

// router.get('/:id/events', async (req, res, next) => {
//   try {
//     const events = await DeliveryEvent.find({ delivery_id: req.params.id })
//       .sort({ created_at: -1 })
//       .lean();
//     res.json(events);
//   } catch (err) {
//     next(err);
//   }
// });

// async function logEvent(deliveryId, type, message) {
//   await DeliveryEvent.create({ delivery_id: deliveryId, event_type: type, message });
// }

// async function getNextStopOrder() {
//   const last = await Delivery.findOne().sort({ stop_order: -1 }).select('stop_order').lean();
//   return last?.stop_order ? last.stop_order + 1 : 1;
// }

// function haversine(lat1, lon1, lat2, lon2) {
//   const R = 6371;
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLon = ((lon2 - lon1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// module.exports = router;















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
