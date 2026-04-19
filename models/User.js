const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'driver' },
    phone: String,
    avatar: String,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);