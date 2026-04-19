const express = require('express');
const router = express.Router();

const Customer = require('../models/Customer');
const Delivery = require('../models/delivery');

function normalizeStatus(status) {
  return typeof status === 'string' ? status.toLowerCase() : 'pending';
}

// GET /api/customers
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ name: regex }, { address: regex }, { phone: regex }];
    }

    const customers = await Customer.find(query).sort({ name: 1 }).lean();

    const customerNames = customers.map((customer) => customer.name).filter(Boolean);
    const deliveryStats = customerNames.length
      ? await Delivery.aggregate([
          { $match: { customerName: { $in: customerNames } } },
          {
            $group: {
              _id: '$customerName',
              total_deliveries: { $sum: 1 },
              completed_deliveries: {
                $sum: {
                  $cond: [{ $eq: [{ $toLower: '$status' }, 'delivered'] }, 1, 0],
                },
              },
            },
          },
        ])
      : [];

    const statMap = new Map(deliveryStats.map((entry) => [entry._id, entry]));

    const result = customers.map((customer) => {
      const stats = statMap.get(customer.name) || { total_deliveries: 0, completed_deliveries: 0 };
      return {
        ...customer,
        id: customer._id.toString(),
        total_deliveries: stats.total_deliveries || 0,
        completed_deliveries: stats.completed_deliveries || 0,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const deliveries = await Delivery.find({ customerName: customer.name })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      ...customer,
      id: customer._id.toString(),
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

// POST /api/customers
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, address, lat, lng, notes, zone, priority, orders } = req.body;
    const parsedLat = lat == null || lat === '' ? undefined : Number(lat);
    const parsedLng = lng == null || lng === '' ? undefined : Number(lng);

    if (!name || !address) {
      return res.status(400).json({ error: 'name and address are required' });
    }

    if ((parsedLat !== undefined && !Number.isFinite(parsedLat)) || (parsedLng !== undefined && !Number.isFinite(parsedLng))) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers when provided' });
    }

    const customer = await Customer.create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      address,
      lat: parsedLat,
      lng: parsedLng,
      notes: notes || undefined,
      zone: zone || undefined,
      priority: priority || 'Standard',
      orders: Number.isFinite(Number(orders)) ? Number(orders) : 0,
    });

    res.status(201).json({ ...customer.toObject(), id: customer._id.toString() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body };

    if (updates.lat != null) {
      updates.lat = Number(updates.lat);
      if (!Number.isFinite(updates.lat)) return res.status(400).json({ error: 'lat must be a valid number' });
    }

    if (updates.lng != null) {
      updates.lng = Number(updates.lng);
      if (!Number.isFinite(updates.lng)) return res.status(400).json({ error: 'lng must be a valid number' });
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json({ ...customer, id: customer._id.toString() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const active = await Delivery.countDocuments({
      customerName: customer.name,
      status: { $in: ['pending', 'transit'] },
    });

    if (active > 0) {
      return res.status(409).json({ error: 'Cannot delete customer with active deliveries' });
    }

    await Delivery.deleteMany({ customerName: customer.name });
    await Customer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
