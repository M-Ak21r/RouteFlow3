const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: String,
  plate: { type: String, unique: true, sparse: true },
  status: { type: String, default: 'idle' },
  capacity: { type: Number, default: 100 },
  lat: Number,
  lng: Number,
  driverName: String,
  driverEmail: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.Vehicle || mongoose.model('Vehicle', VehicleSchema);