const { getDB } = require('../db/database');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send live snapshot on connect
    try {
      const db = getDB();
      const stats = db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
               SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status='transit'   THEN 1 ELSE 0 END) as in_transit,
               SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) as failed
        FROM deliveries
      `).get();
      const vehicles = db.prepare(`SELECT id, name, type, status, lat, lng FROM vehicles`).all();
      socket.emit('live:snapshot', { stats, vehicles });
    } catch (err) {
      console.error('Snapshot error:', err.message);
    }

    // Client joins a room (e.g. for a specific vehicle or route)
    socket.on('join:vehicle', (vehicleId) => {
      socket.join(`vehicle_${vehicleId}`);
      console.log(`Socket ${socket.id} joined vehicle_${vehicleId}`);
    });

    socket.on('join:route', (routeId) => {
      socket.join(`route_${routeId}`);
    });

    // Driver sends their location update
    socket.on('driver:location', ({ vehicleId, lat, lng }) => {
      try {
        const db = getDB();
        db.prepare(`UPDATE vehicles SET lat=?, lng=? WHERE id=?`).run(lat, lng, vehicleId);
        // Broadcast to all clients
        io.emit('vehicle:locationUpdated', { id: vehicleId, lat, lng });
      } catch (err) {
        console.error('Location update error:', err.message);
      }
    });

    // Driver marks delivery as done
    socket.on('driver:deliveryComplete', ({ deliveryId, vehicleId }) => {
      try {
        const db = getDB();
        db.prepare(`UPDATE deliveries SET status='delivered', delivered_at=CURRENT_TIMESTAMP WHERE id=?`).run(deliveryId);
        db.prepare(`INSERT INTO delivery_events (delivery_id, event_type, message) VALUES (?, 'delivered', 'Marked delivered by driver')`).run(deliveryId);
        io.emit('delivery:statusChanged', { id: deliveryId, status: 'delivered' });
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
    setInterval(() => {
      try {
        const db = getDB();
        const vehicles = db.prepare(`SELECT * FROM vehicles WHERE status = 'active'`).all();
        vehicles.forEach(v => {
          if (!v.lat || !v.lng) return;
          // Tiny random drift to simulate movement
          const newLat = v.lat + (Math.random() - 0.5) * 0.002;
          const newLng = v.lng + (Math.random() - 0.5) * 0.002;
          db.prepare(`UPDATE vehicles SET lat=?, lng=? WHERE id=?`).run(newLat, newLng, v.id);
          io.emit('vehicle:locationUpdated', { id: v.id, lat: newLat, lng: newLng, name: v.name });
        });
      } catch (_) {}
    }, 10000);
  }
}

module.exports = { setupSocketHandlers };
