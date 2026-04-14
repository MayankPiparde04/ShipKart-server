import express from "express";
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


router.post("/activation", sanitizeInput, activationController);


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


router.post("/check-verified", sanitizeInput, checkVerifiedController);

export default router;
