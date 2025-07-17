const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'Missing Authorization header' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'jwt' || !token) {
    return res.status(401).json({ message: 'Invalid Authorization format' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = { id: decoded._id, email: decoded.email };
    next();
  });
};
