import { createHash, timingSafeEqual } from "node:crypto";

const TOKEN_MIN_BYTES = 32;
const TOKEN_MAX_BYTES = 512;

export const requireIntegrationToken = (req, res, next) => {
  res.set("Cache-Control", "no-store");

  const configuredToken = process.env.DALI_POS_INTEGRATION_TOKEN;
  if (!configuredToken || Buffer.byteLength(configuredToken) < TOKEN_MIN_BYTES) {
    return res.status(503).json({
      error: {
        code: "INTEGRATION_NOT_CONFIGURED",
        message: "The service integration is not configured.",
      },
    });
  }

  const authorization = req.get("authorization") || "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match || Buffer.byteLength(match[1]) > TOKEN_MAX_BYTES) {
    return unauthorized(res);
  }

  const configuredDigest = createHash("sha256").update(configuredToken).digest();
  const suppliedDigest = createHash("sha256").update(match[1]).digest();
  if (!timingSafeEqual(configuredDigest, suppliedDigest)) {
    return unauthorized(res);
  }

  next();
};

const unauthorized = (res) => res.status(401).json({
  error: {
    code: "UNAUTHORIZED",
    message: "A valid service bearer token is required.",
  },
});
