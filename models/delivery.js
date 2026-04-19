const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  orderId: String,
  name: String,
  customerName: String,
  address: String,
  lat: Number,
  lng: Number,
  latitude: Number,
  longitude: Number,
  priority: String,
  type: String,
  eta: String,
  dist: Number,
  notes: String,
  stopOrder: Number,
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  status: {
    type: String,
    default: 'pending'
  }
}, {
  timestamps: true
});

deliverySchema.pre('validate', function syncCoordinateAliases() {
  if (!this.customerName && this.name) this.customerName = this.name;
  if (!this.name && this.customerName) this.name = this.customerName;
  if (this.lat == null && this.latitude != null) this.lat = this.latitude;
  if (this.lng == null && this.longitude != null) this.lng = this.longitude;
  if (this.latitude == null && this.lat != null) this.latitude = this.lat;
  if (this.longitude == null && this.lng != null) this.longitude = this.lng;

  if (typeof this.status === 'string') {
    this.status = this.status.toLowerCase();
  }
});

module.exports = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);
