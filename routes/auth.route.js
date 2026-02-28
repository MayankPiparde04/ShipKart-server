import express from "express";
// Load Controllers
import {
  registerController,
  activationController,
  signinController,
  refreshTokenController,
  forgotPasswordController,
  resetPasswordController,
  signoutController,
  checkVerifiedController,
  resendActivationController,
} from "../controllers/auth.controller.js";

// Load Middleware
import {
  authRateLimit,
  passwordResetRateLimit,
} from "../middleware/auth.middleware.js";
import {
  validateRegistration,
  validateLogin,
  validateEmail,
  validateToken,
  validateRefreshToken,
  validatePasswordReset,
  sanitizeInput,
} from "../middleware/validation.middleware.js";

const router = express.Router();

// Authentication Routes
router.post(
  "/register",
  authRateLimit,
  sanitizeInput,
  validateRegistration,
  registerController,
);

router.post(
  "/login",
  authRateLimit,
  sanitizeInput,
  validateLogin,
  signinController,
);

// Changed activation to POST and takes email + otp from body
router.post("/activation", sanitizeInput, activationController);

// Resend activation OTP route
router.post("/resend-activation", sanitizeInput, resendActivationController);

router.post("/refresh-token", sanitizeInput, refreshTokenController);

router.post(
  "/forgot-password",
  passwordResetRateLimit,
  sanitizeInput,
  validateEmail,
  forgotPasswordController,
);

router.post(
  "/reset-password",
  sanitizeInput,
  validatePasswordReset,
  resetPasswordController,
);

router.post("/signout", signoutController);

// Add route to check if user is verified
router.post("/check-verified", sanitizeInput, checkVerifiedController);

export default router;
