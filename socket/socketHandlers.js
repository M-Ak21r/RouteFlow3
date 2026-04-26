const Delivery = require('../models/delivery');
const Vehicle = require('../models/vehicle');
const DeliveryEvent = require('../models/DeliveryEvent');

function setupSocketHandlers(io) {
  io.on('connection', async (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send live snapshot on connect so the client has fresh data immediately
    try {
      const [deliveries, vehicles] = await Promise.all([
        Delivery.find().select('status').lean(),
        Vehicle.find().select('id name type status lat lng').lean(),
      ]);

      const stats = deliveries.reduce(
        (acc, delivery) => {
          const status = (delivery.status || 'pending').toLowerCase();
          acc.total += 1;
          if (status === 'delivered') acc.delivered += 1;
          else if (status === 'pending') acc.pending += 1;
          else if (status === 'transit') acc.in_transit += 1;
          else if (status === 'failed') acc.failed += 1;
          return acc;
        },
        { total: 0, delivered: 0, pending: 0, in_transit: 0, failed: 0 }
      );

      socket.emit('live:snapshot', { stats, vehicles });
    } catch (err) {
      console.error('Snapshot error:', err.message);
    }

    // Client joins a room scoped to a specific vehicle or route
    socket.on('join:vehicle', (vehicleId) => {
      socket.join(`vehicle_${vehicleId}`);
      console.log(`Socket ${socket.id} joined vehicle_${vehicleId}`);
    });

    socket.on('join:route', (routeId) => {
      socket.join(`route_${routeId}`);
    });

    // Driver sends a location update
    socket.on('driver:location', async ({ vehicleId, lat, lng }) => {
      try {
        await Vehicle.findByIdAndUpdate(vehicleId, { lat, lng });
        io.emit('vehicle:locationUpdated', { id: vehicleId, lat, lng });
      } catch (err) {
        console.error('Location update error:', err.message);
      }
    });

    // Driver marks a delivery as delivered
    socket.on('driver:deliveryComplete', async ({ deliveryId, vehicleId }) => {
      try {
        const delivery = await Delivery.findByIdAndUpdate(
          deliveryId,
          { status: 'delivered' },
          { new: true }
        ).lean();

        if (!delivery) return;

        const eventDoc = await DeliveryEvent.create({
          delivery_id: delivery._id,
          eventType: 'STATUS_CHANGE',
          event_type: 'delivered',
          message: `Delivery ${delivery.orderId || delivery._id.toString()} marked delivered by driver`,
          driverId: vehicleId || null,
          details: { orderId: delivery.orderId, status: 'delivered' },
          timestamp: new Date(),
        });

        io.emit('delivery:statusChanged', { id: deliveryId, status: 'delivered' });
        io.emit('DELIVERY_UPDATED', { id: deliveryId, status: 'delivered' });

        // Broadcast to the Activity Log
        io.emit('analytics:newEvent', {
          _id: eventDoc._id,
          eventType: eventDoc.eventType,
          timestamp: eventDoc.timestamp,
          message: eventDoc.message,
          details: eventDoc.details,
          driverId: eventDoc.driverId || null,
        });
      } catch (err) {
        console.error('Delivery complete error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  // Simulate vehicle location pings every 10 seconds (dev only)
  if (process.env.NODE_ENV !== 'production') {
    setInterval(async () => {
      try {
        const vehicles = await Vehicle.find({ status: 'active' }).lean();
        for (const vehicle of vehicles) {
          if (!vehicle.lat || !vehicle.lng) continue;
          const newLat = vehicle.lat + (Math.random() - 0.5) * 0.002;
          const newLng = vehicle.lng + (Math.random() - 0.5) * 0.002;
          await Vehicle.findByIdAndUpdate(vehicle._id, { lat: newLat, lng: newLng });
          io.emit('vehicle:locationUpdated', { id: vehicle._id.toString(), lat: newLat, lng: newLng, name: vehicle.name });
        }
      } catch (_) {}
    }, 10000);
  }
}

module.exports = { setupSocketHandlers };
