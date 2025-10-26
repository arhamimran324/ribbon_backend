import jwt from "jsonwebtoken";

export const verifyToken = (allowedRoles) => {
  return (req, res, next) => {
    let token = req.headers.authorization;

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access Denied. No token provided." });
    }

    try {
      if (token.startsWith("Bearer ")) {
        token = token.slice(7, token.length);
      }
      const decoded = jwt.verify(token, "supersecretkey");
      req.user = decoded;

      if (allowedRoles && !allowedRoles.includes(decoded.role)) {
        return res
          .status(403)
          .json({ error: "Forbidden: Insufficient permissions." });
      }

      next();
    } catch (error) {
      console.error("Token Verification Error:", error);

      if (error.name === "JsonWebTokenError") {
        return res.status(400).json({ error: "Invalid token format." });
      } else if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ error: "Token expired. Please log in again." });
      } else {
        return res.status(400).json({ error: "Invalid token." });
      }
    }
  };
};
