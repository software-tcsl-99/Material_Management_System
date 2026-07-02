const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    level: { type: Number, default: 0 },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Designation', designationSchema);
