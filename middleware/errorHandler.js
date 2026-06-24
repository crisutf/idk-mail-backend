const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Error de validación', 
      details: Object.values(err.errors).map(e => e.message) 
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'ID inválido' });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({ error: 'El campo ya existe' });
  }
  
  res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = errorHandler;
