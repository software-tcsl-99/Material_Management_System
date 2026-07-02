const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');

// Departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ departments });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const dept = await Department.create(req.body);
    res.status(201).json({ message: 'Department created.', department: dept });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Department already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });
    res.json({ message: 'Department updated.', department: dept });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// Designations
exports.getDesignations = async (req, res) => {
  try {
    const designations = await Designation.find().sort({ name: 1 });
    res.json({ designations });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.createDesignation = async (req, res) => {
  try {
    const desg = await Designation.create(req.body);
    res.status(201).json({ message: 'Designation created.', designation: desg });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Designation already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateDesignation = async (req, res) => {
  try {
    const desg = await Designation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!desg) return res.status(404).json({ message: 'Designation not found.' });
    res.json({ message: 'Designation updated.', designation: desg });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.deleteDesignation = async (req, res) => {
  try {
    await Designation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Designation deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// Locations
exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find().sort({ name: 1 });
    res.json({ locations });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.createLocation = async (req, res) => {
  try {
    const loc = await Location.create(req.body);
    res.status(201).json({ message: 'Location created.', location: loc });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Location already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const loc = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!loc) return res.status(404).json({ message: 'Location not found.' });
    res.json({ message: 'Location updated.', location: loc });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    await Location.findByIdAndDelete(req.params.id);
    res.json({ message: 'Location deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
