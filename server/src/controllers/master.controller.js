const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');
const { createAuditLog } = require('../middleware/audit.middleware');

// ===== DEPARTMENTS =====
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ departments });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await Department.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Department already exists.' });

    const department = await Department.create({ name, createdBy: req.user._id });
    await createAuditLog({ user: req.user._id, action: 'create', entity: 'Department', entityId: department._id.toString(), newData: { name }, req });
    res.status(201).json({ department, message: 'Department created.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found.' });

    const oldData = department.toObject();
    department.name = req.body.name || department.name;
    department.status = req.body.status || department.status;
    await department.save();

    await createAuditLog({ user: req.user._id, action: 'edit', entity: 'Department', entityId: department._id.toString(), oldData, newData: department.toObject(), req });
    res.json({ department, message: 'Department updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found.' });

    await createAuditLog({ user: req.user._id, action: 'delete', entity: 'Department', entityId: department._id.toString(), oldData: department.toObject(), req });
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ===== DESIGNATIONS =====
const getDesignations = async (req, res) => {
  try {
    const designations = await Designation.find().sort({ name: 1 });
    res.json({ designations });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const createDesignation = async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await Designation.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Designation already exists.' });

    const designation = await Designation.create({ name, createdBy: req.user._id });
    await createAuditLog({ user: req.user._id, action: 'create', entity: 'Designation', entityId: designation._id.toString(), newData: { name }, req });
    res.status(201).json({ designation, message: 'Designation created.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const updateDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id);
    if (!designation) return res.status(404).json({ message: 'Designation not found.' });

    const oldData = designation.toObject();
    designation.name = req.body.name || designation.name;
    designation.status = req.body.status || designation.status;
    await designation.save();

    await createAuditLog({ user: req.user._id, action: 'edit', entity: 'Designation', entityId: designation._id.toString(), oldData, newData: designation.toObject(), req });
    res.json({ designation, message: 'Designation updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id);
    if (!designation) return res.status(404).json({ message: 'Designation not found.' });

    await createAuditLog({ user: req.user._id, action: 'delete', entity: 'Designation', entityId: designation._id.toString(), oldData: designation.toObject(), req });
    await Designation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Designation deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ===== LOCATIONS =====
const getLocations = async (req, res) => {
  try {
    const locations = await Location.find().sort({ name: 1 });
    res.json({ locations });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const createLocation = async (req, res) => {
  try {
    const { name, address, coordinates } = req.body;
    const existing = await Location.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Location already exists.' });

    const location = await Location.create({ name, address, coordinates, createdBy: req.user._id });
    await createAuditLog({ user: req.user._id, action: 'create', entity: 'Location', entityId: location._id.toString(), newData: { name, address }, req });
    res.status(201).json({ location, message: 'Location created.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const updateLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) return res.status(404).json({ message: 'Location not found.' });

    const oldData = location.toObject();
    location.name = req.body.name || location.name;
    location.address = req.body.address ?? location.address;
    location.coordinates = req.body.coordinates || location.coordinates;
    location.status = req.body.status || location.status;
    await location.save();

    await createAuditLog({ user: req.user._id, action: 'edit', entity: 'Location', entityId: location._id.toString(), oldData, newData: location.toObject(), req });
    res.json({ location, message: 'Location updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const deleteLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) return res.status(404).json({ message: 'Location not found.' });

    await createAuditLog({ user: req.user._id, action: 'delete', entity: 'Location', entityId: location._id.toString(), oldData: location.toObject(), req });
    await Location.findByIdAndDelete(req.params.id);
    res.json({ message: 'Location deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const uploadMastersCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const fileContent = req.file.buffer.toString('utf8');
    const lines = fileContent.split(/\r?\n/);
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV file is empty or lacks headers.' });
    }

    // Extract headers (case-insensitive & trimmed)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    
    // Validate we have minimum headers (type, name)
    const typeIndex = headers.indexOf('type');
    const nameIndex = headers.indexOf('name');
    if (typeIndex === -1 || nameIndex === -1) {
      return res.status(400).json({ message: 'Invalid CSV format. Must include "type" and "name" columns.' });
    }

    const addressIndex = headers.indexOf('address');
    const latIndex = headers.indexOf('lat');
    const lngIndex = headers.indexOf('lng');

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse columns taking quotes into account
      const values = [];
      let current = '';
      let inQuotes = false;
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));

      const typeValue = values[typeIndex]?.trim().toLowerCase();
      const nameValue = values[nameIndex]?.trim();

      if (!typeValue || !nameValue) {
        skippedCount++;
        continue;
      }

      const addressValue = addressIndex !== -1 ? values[addressIndex]?.trim() : '';
      const latValue = latIndex !== -1 ? parseFloat(values[latIndex]) || 0 : 0;
      const lngValue = lngIndex !== -1 ? parseFloat(values[lngIndex]) || 0 : 0;

      try {
        if (typeValue === 'department') {
          const exists = await Department.findOne({ name: { $regex: new RegExp(`^${nameValue}$`, 'i') } });
          if (!exists) {
            await Department.create({ name: nameValue, status: 'active', createdBy: req.user._id });
            createdCount++;
          } else {
            skippedCount++;
          }
        } else if (typeValue === 'designation') {
          const exists = await Designation.findOne({ name: { $regex: new RegExp(`^${nameValue}$`, 'i') } });
          if (!exists) {
            await Designation.create({ name: nameValue, status: 'active', createdBy: req.user._id });
            createdCount++;
          } else {
            skippedCount++;
          }
        } else if (typeValue === 'location' || typeValue === 'workplace' || typeValue === 'work place') {
          const exists = await Location.findOne({ name: { $regex: new RegExp(`^${nameValue}$`, 'i') } });
          if (!exists) {
            await Location.create({
              name: nameValue,
              address: addressValue,
              coordinates: { lat: latValue, lng: lngValue },
              status: 'active',
              createdBy: req.user._id,
            });
            createdCount++;
          } else {
            skippedCount++;
          }
        } else {
          errors.push(`Row ${i + 1}: Unknown type "${typeValue}".`);
          skippedCount++;
        }
      } catch (err) {
        errors.push(`Row ${i + 1} (${nameValue}): ${err.message}`);
        skippedCount++;
      }
    }

    return res.json({
      message: `CSV upload completed. Created: ${createdCount}, Skipped/Duplicates: ${skippedCount}`,
      errors,
    });
  } catch (error) {
    console.error('Upload masters CSV error:', error);
    return res.status(500).json({ message: 'Server error parsing CSV.', error: error.message });
  }
};

module.exports = {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getDesignations, createDesignation, updateDesignation, deleteDesignation,
  getLocations, createLocation, updateLocation, deleteLocation,
  uploadMastersCSV,
};
