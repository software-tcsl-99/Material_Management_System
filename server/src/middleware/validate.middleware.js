const validate = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ message: 'Validation failed', errors });
      }
      req.validatedBody = result.data;
      next();
    } catch (error) {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        const errors = result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ message: 'Validation failed', errors });
      }
      req.validatedQuery = result.data;
      next();
    } catch (error) {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
  };
};

module.exports = { validate, validateQuery };
