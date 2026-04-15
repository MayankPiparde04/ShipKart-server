import express from "express";
import {
  registerController,
  activationController,
  signinController,
  refreshTokenController,
  forgotPasswordController,
  verifyForgotPasswordOtpController,
  resetPasswordController,
  changePasswordController,
  signoutController,
  checkVerifiedController,
  resendActivationController,
} from "../controllers/auth.controller.js";

import {
  authRateLimit,
  passwordResetRateLimit,
  authenticateToken,
} from "../middleware/auth.middleware.js";
import {
  validateRegistration,
  validateLogin,
  validateEmail,
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
  "/verify-forgot-password-otp",
  passwordResetRateLimit,
  sanitizeInput,
  verifyForgotPasswordOtpController,
);

router.post(
  "/reset-password",
  passwordResetRateLimit,
  sanitizeInput,
  validatePasswordReset,
  resetPasswordController,
);

router.post(
  "/change-password",
  authenticateToken,
  authRateLimit,
  sanitizeInput,
  changePasswordController,
);

router.post("/signout", signoutController);


router.post("/check-verified", sanitizeInput, checkVerifiedController);

export default router;
