const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  lat: Number,
  lng: Number,
  phone: String,
  email: String,
  notes: String,
  zone: String,
  priority: { type: String, default: 'Standard' },
  orders: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
