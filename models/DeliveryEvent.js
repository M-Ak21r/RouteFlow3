const mongoose = require('mongoose');

const DeliveryEventSchema = new mongoose.Schema({
  delivery_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true },
  event_type: String,
  message: String,
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.models.DeliveryEvent || mongoose.model('DeliveryEvent', DeliveryEventSchema);