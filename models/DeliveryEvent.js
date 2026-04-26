const mongoose = require('mongoose');

// Audit-trail schema for every delivery/vehicle mutation.
// eventType uses UPPER_SNAKE_CASE convention (e.g. STATUS_CHANGE, NEW_DELIVERY).
const DeliveryEventSchema = new mongoose.Schema({
  // Reference to the delivery that triggered this event (optional for system-level events)
  delivery_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },

  // Canonical upper-snake-case event type
  eventType: {
    type: String,
    enum: ['NEW_DELIVERY', 'STATUS_CHANGE', 'ROUTE_OPTIMIZED', 'VEHICLE_UPDATED', 'SYSTEM'],
    default: 'SYSTEM',
  },

  // ISO timestamp — stored explicitly so consumers can sort without relying on _id
  timestamp: { type: Date, default: Date.now },

  // The authenticated user who triggered the event (dispatcher / system)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // The driver associated with this event (may differ from userId)
  driverId: { type: String, default: null },

  // Freeform structured payload (status, orderId, vehicleName, etc.)
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Human-readable description kept for backwards compatibility
  message: { type: String, default: '' },

  // Legacy field alias — kept so existing documents remain readable
  event_type: { type: String, default: null },
}, {
  // Automatically add createdAt / updatedAt
  timestamps: { createdAt: 'created_at', updatedAt: false },
});

// Index on timestamp DESC for the "latest N events" query
DeliveryEventSchema.index({ timestamp: -1 });

module.exports = mongoose.models.DeliveryEvent || mongoose.model('DeliveryEvent', DeliveryEventSchema);