const mongoose = require('mongoose');

const DeliveryEventSchema = new mongoose.Schema({
  delivery_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },

  eventType: {
    type: String,
    enum: ['NEW_DELIVERY', 'STATUS_CHANGE', 'ROUTE_OPTIMIZED', 'VEHICLE_UPDATED', 'SYSTEM'],
    default: 'SYSTEM',
  },

  timestamp: { type: Date, default: Date.now },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  driverId: { type: String, default: null },

  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  message: { type: String, default: '' },

  event_type: { type: String, default: null },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
});

DeliveryEventSchema.index({ timestamp: -1 });

module.exports = mongoose.models.DeliveryEvent || mongoose.model('DeliveryEvent', DeliveryEventSchema);