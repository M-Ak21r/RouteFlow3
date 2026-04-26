const express = require('express');
const router = express.Router();

const Delivery = require('../models/delivery');
const Vehicle = require('../models/vehicle');
const DeliveryEvent = require('../models/DeliveryEvent');

const DEPOT = { lat: 28.6304, lng: 77.2177, name: 'Distribution Centre' };
const OSRM_BASE_URL = 'https://router.project-osrm.org';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

function normalizeDelivery(delivery) {
  const lat = Number(delivery.lat ?? delivery.latitude);
  const lng = Number(delivery.lng ?? delivery.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    ...delivery,
    id: delivery.id || delivery.orderId || delivery._id?.toString(),
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    status: typeof delivery.status === 'string' ? delivery.status.toLowerCase() : 'pending',
    customer_name: delivery.customer_name || delivery.customerName || delivery.name || 'Unknown Customer',
    address: delivery.address || '',
  };
}

function formatStop(delivery, stopNumber) {
  return {
    ...delivery,
    stop_number: stopNumber,
  };
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Routing API request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAddressSuggestion(result) {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const address = result.address || {};
  const postcode = address.postcode || '';
  const city = address.city || address.town || address.village || address.suburb || '';
  const state = address.state || '';
  const country = address.country || '';

  return {
    display_name: result.display_name,
    lat,
    lng,
    postcode,
    city,
    state,
    country,
  };
}

async function queryAddressSuggestions(query, limit = 5) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'in',
  });

  const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RouteFlow/1.0 (Route suggestion feature)',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      throw new Error(`Address lookup failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) return [];

    return payload
      .map(normalizeAddressSuggestion)
      .filter(Boolean);
  } finally {
    clearTimeout(timeout);
  }
}

async function getOsrmDistanceMatrix(points) {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coordinates}?annotations=distance,duration`;
  const payload = await fetchJson(url);

  if (payload.code !== 'Ok' || !Array.isArray(payload.distances)) {
    throw new Error('Routing API matrix response is invalid');
  }

  return payload;
}

async function getOsrmGeometry(points) {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const payload = await fetchJson(url);

  if (payload.code !== 'Ok' || !Array.isArray(payload.routes) || !payload.routes[0]) {
    throw new Error('Routing API route response is invalid');
  }

  return payload.routes[0];
}

function nearestNeighbourFromMatrix(matrix, stopCount) {
  const unvisited = new Set(Array.from({ length: stopCount }, (_, index) => index + 1));
  const ordered = [];
  let current = 0;

  while (unvisited.size > 0) {
    let bestNode = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const node of unvisited) {
      const distance = Number(matrix[current][node]);
      if (!Number.isFinite(distance)) continue;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestNode = node;
      }
    }

    if (bestNode == null) {
      break;
    }

    ordered.push(bestNode);
    unvisited.delete(bestNode);
    current = bestNode;
  }

  for (const node of unvisited) {
    ordered.push(node);
  }

  return ordered;
}

function computeTotalDistanceMeters(matrix, orderedNodeIndexes) {
  if (!orderedNodeIndexes.length) return 0;

  let total = 0;
  let current = 0;

  for (const node of orderedNodeIndexes) {
    const segment = Number(matrix[current][node]);
    if (Number.isFinite(segment)) total += segment;
    current = node;
  }

  const returnDistance = Number(matrix[current][0]);
  if (Number.isFinite(returnDistance)) total += returnDistance;

  return total;
}

// GET /api/routes/live
router.get('/live', async (req, res) => {
  try {
    const rawDeliveries = await Delivery.find().lean();
    const deliveries = rawDeliveries.map(normalizeDelivery).filter(Boolean);

    const stats = {
      total: deliveries.length,
      delivered: deliveries.filter((delivery) => delivery.status === 'delivered').length,
      pending: deliveries.filter((delivery) => delivery.status === 'pending').length,
      in_transit: deliveries.filter((delivery) => delivery.status === 'transit').length,
      failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
    };

    const activeVehicles = await Vehicle.countDocuments({ status: 'active' });

    res.json({
      stats,
      active_routes: activeVehicles,
      optimised_stops: deliveries,
      depot: DEPOT,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/address-suggest?q=
router.get('/address-suggest', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3) return res.json({ suggestions: [] });

    const suggestions = await queryAddressSuggestions(query, 6);
    res.json({ suggestions });
  } catch (err) {
    res.status(502).json({ error: `Address suggestion failed: ${err.message}` });
  }
});

// GET /api/routes/address-geocode?q=
router.get('/address-geocode', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3) {
      return res.status(400).json({ error: 'Query must be at least 3 characters' });
    }

    const suggestions = await queryAddressSuggestions(query, 1);
    if (!suggestions.length) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ result: suggestions[0] });
  } catch (err) {
    res.status(502).json({ error: `Address geocode failed: ${err.message}` });
  }
});

// POST /api/routes/optimise
router.post('/optimise', async (req, res) => {
  try {
    const requestStops = Array.isArray(req.body?.stops) ? req.body.stops : null;

    const rawStops = requestStops
      ? requestStops
      : await Delivery.find({ status: { $nin: ['delivered', 'failed', 'cancelled'] } }).lean();

    const stops = rawStops
      .map(normalizeDelivery)
      .filter((delivery) => delivery && !['delivered', 'failed', 'cancelled'].includes(delivery.status));

    if (!stops.length) {
      return res.status(400).json({ error: 'No eligible deliveries to optimise' });
    }

    const points = [{ lat: DEPOT.lat, lng: DEPOT.lng }, ...stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))];
    const matrixPayload = await getOsrmDistanceMatrix(points);

    const orderedNodeIndexes = nearestNeighbourFromMatrix(matrixPayload.distances, stops.length);
    const orderedStops = orderedNodeIndexes.map((nodeIndex, index) => formatStop(stops[nodeIndex - 1], index + 1));

    const routePoints = [
      { lat: DEPOT.lat, lng: DEPOT.lng },
      ...orderedStops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
      { lat: DEPOT.lat, lng: DEPOT.lng },
    ];

    const routePayload = await getOsrmGeometry(routePoints);

    const matrixTotalDistance = computeTotalDistanceMeters(matrixPayload.distances, orderedNodeIndexes);
    const totalDistanceKm = Number(((routePayload.distance || matrixTotalDistance) / 1000).toFixed(1));

    const updateOps = orderedStops
      .filter((stop) => stop._id)
      .map((stop) =>
        Delivery.updateOne(
          { _id: stop._id },
          { $set: { stopOrder: stop.stop_number, dist: Number((stop.dist || 0).toFixed(1)) } }
        )
      );

    await Promise.all(updateOps);

    req.io.emit('route:optimised', {
      total_distance_km: totalDistanceKm,
      total_stops: orderedStops.length,
    });
    req.io.emit('ROUTE_OPTIMIZED', {
      total_distance_km: totalDistanceKm,
      total_stops: orderedStops.length,
    });

    // Log route optimisation as an audit event and broadcast to Activity Log
    try {
      const eventDoc = await DeliveryEvent.create({
        eventType: 'ROUTE_OPTIMIZED',
        event_type: 'route_optimised',
        message: `Route optimised — ${orderedStops.length} stops, ${totalDistanceKm} km`,
        userId: req.user?.id || null,
        details: { total_stops: orderedStops.length, total_distance_km: totalDistanceKm },
        timestamp: new Date(),
      });
      req.io.emit('analytics:newEvent', {
        _id: eventDoc._id,
        eventType: eventDoc.eventType,
        timestamp: eventDoc.timestamp,
        message: eventDoc.message,
        details: eventDoc.details,
        driverId: null,
      });
    } catch (_) {}

    res.json({
      message: 'Route optimised successfully',
      total_stops: orderedStops.length,
      total_distance_km: totalDistanceKm,
      estimated_duration_min: Number(((routePayload.duration || 0) / 60).toFixed(0)),
      optimised_stops: orderedStops,
      route_geometry: routePayload.geometry || null,
      depot: DEPOT,
      provider: 'osrm',
    });
  } catch (err) {
    res.status(502).json({ error: `Route optimisation failed: ${err.message}` });
  }
});

// POST /api/routes/reset
router.post('/reset', async (req, res) => {
  try {
    const deliveries = await Delivery.find({ status: { $nin: ['delivered', 'failed', 'cancelled'] } })
      .sort({ createdAt: 1 })
      .lean();

    await Promise.all(
      deliveries.map((delivery, index) =>
        Delivery.updateOne({ _id: delivery._id }, { $set: { stopOrder: index + 1 } })
      )
    );

    req.io.emit('route:reset', { message: 'Route reset to original order' });

    res.json({ message: 'Route reset successfully', total_stops: deliveries.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/deliveries
router.post('/deliveries', async (req, res) => {
  try {
    const rawDelivery = req.body;
    const normalized = normalizeDelivery(rawDelivery);
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid delivery data provided' });
    }

    const newDelivery = new Delivery(normalized);
    await newDelivery.save();

    // Emit event for real-time UI updates (if using Socket.IO)
    req.io.emit('delivery:added', { delivery: newDelivery });

    res.status(201).json({ message: 'Delivery added successfully', delivery: newDelivery });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;