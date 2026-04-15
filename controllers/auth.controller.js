import User from "../models/auth.model.js";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const OTP_VALIDITY_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN = "7d";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const generateTokens = (userId, tokenVersion = 0) => {
  const accessToken = jwt.sign({ _id: userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { _id: userId, type: "refresh", tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
  );

  return { accessToken, refreshToken };
};

const generateOtpCode = () => crypto.randomInt(100000, 1000000).toString();

const applyAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === "production";
  const baseCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };

  res.cookie("shipwise_access", accessToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie("shipwise_refresh", refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const buildOtpEmailTemplate = ({
  name,
  otpCode,
  title,
  subtitle,
  note,
}) => {
  return `
    <div style="margin:0; padding:24px; background:#001224; font-family:Arial,sans-serif; color:#E5F2FF;">
      <div style="max-width:560px; margin:0 auto; background:#001933; border:1px solid #054161; border-radius:16px; padding:28px; text-align:center;">
        <div style="font-size:28px; font-weight:800; color:#E5F2FF; letter-spacing:0.6px;">ShipWise</div>
        <div style="margin-top:4px; font-size:12px; letter-spacing:2px; color:#99CCFF; text-transform:uppercase;">Logistics Intelligence</div>

        <h2 style="margin:22px 0 8px; color:#E5F2FF; font-size:22px;">${title}</h2>
        <p style="margin:0 0 14px; color:#C7E6FF; font-size:15px;">Hello ${name || "there"}, ${subtitle}</p>

        <p style="margin:0 0 10px; color:#E5F2FF; font-size:15px;">Your Verification Code:</p>
        <div style="margin:0 auto 18px; padding:14px 16px; border-radius:12px; border:1px solid #054161; background:#001224; width:fit-content; min-width:220px;">
          <span style="font-size:36px; font-weight:800; color:#007FFF; letter-spacing:10px;">${otpCode}</span>
        </div>

        <p style="margin:0; color:#99CCFF; font-size:13px; line-height:1.5;">${note}</p>

        <hr style="border:none; border-top:1px solid #054161; margin:20px 0 14px;" />
        <p style="margin:0; color:#C7E6FF; font-size:13px; line-height:1.6;">
          Thank you for choosing ShipWise to optimize your logistics journey!<br />
          <span style="color:#99CCFF;">- The ShipWise Team</span>
        </p>
      </div>
    </div>
  `;
};


export const registerController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, email, password, phone } = req.body;


    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or phone",
      });
    }


    const activationToken = generateOtpCode();
    const activationTokenExpiry = new Date(Date.now() + OTP_VALIDITY_MS);


    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      phone,
      activationToken,
      activationTokenExpiry,
      isActive: false, // Set to false during registration
      emailVerified: false,
    });

    await newUser.save();


    if (process.env.NODE_ENV !== "test") {
      try {
        await sendActivationEmail(email, activationToken, name);
      } catch (emailError) {
        console.error(`[EMAIL] FAILED to send activation email to ${email}:`, emailError.message);
        // Don't block registration if email fails — user can request resend
      }
    }

    res.status(201).json({
      success: true,
      message: `Registration successful. Activation OTP sent to ${email}`,
      data: {
        email,
        activationRequired: true,
      },
    });
  } catch (error) {

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or phone",
      });
    }
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during registration",
    });
  }
};


export const activationController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      activationToken: otp,
      emailVerified: false,
    });

    if (
      !user?.activationTokenExpiry ||
      Date.now() > new Date(user.activationTokenExpiry).getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.emailVerified = true;
    user.isActive = true;
    user.activationToken = undefined;
    user.activationTokenExpiry = undefined;
    await user.save();


    const { accessToken, refreshToken } = generateTokens(
      user._id,
      user.tokenVersion || 0,
    );

    applyAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: "Account activated successfully.",
      data: { accessToken, refreshToken, user },
    });
  } catch (error) {
    console.error("Activation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during activation",
    });
  }
};


export const resendActivationController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerified: false,
    });

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message: "User not found or already verified",
        });
    }


    const activationToken = generateOtpCode();
    const activationTokenExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    user.activationToken = activationToken;
    user.activationTokenExpiry = activationTokenExpiry;
    await user.save();

    if (process.env.NODE_ENV !== "test") {
      try {
        await sendActivationEmail(user.email, activationToken, user.name);
      } catch (emailError) {
        console.error(`[EMAIL] FAILED to resend activation email to ${user.email}:`, emailError.message);
        throw new Error("Failed to send activation email. Please try again later.");
      }
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    console.error("Resend Activation error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to resend activation OTP" });
  }
};

export const signinController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password, deviceInfo } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Account not activated. Please verify your email before logging in.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    if (!user.authenticate(password)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }


    user.lastLogin = new Date();
    if (deviceInfo) {
      user.deviceInfo = deviceInfo;
    }
    await user.save();


    const { accessToken, refreshToken } = generateTokens(
      user._id,
      user.tokenVersion || 0,
    );

    applyAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: "Sign in successful",
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          lastLogin: user.lastLogin,
          company: user.company,
          address: user.address,
        },
      },
    });
  } catch (error) {
    console.error("Sign in error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during sign in",
    });
  }
};


export const refreshTokenController = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    if (decoded.type !== "refresh") {
      return res.status(401).json({
        success: false,
        message: "Invalid token type",
      });
    }

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    if (!user.emailVerified) {
      return res.status(401).json({
        success: false,
        message: "User email not verified",
      });
    }

    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: "Session is no longer valid. Please sign in again.",
      });
    }


    const tokens = generateTokens(user._id, user.tokenVersion || 0);

    applyAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: tokens,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};


export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      isActive: true,
      emailVerified: true,
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If the account exists, an OTP has been sent.",
      });
    }

    const resetToken = generateOtpCode();
    const resetTokenExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    user.resetOtpVerified = false;
    user.resetOtpVerifiedAt = undefined;
    await user.save();


    if (process.env.NODE_ENV !== "test") {
      try {
        await sendPasswordResetEmail(email, resetToken, user.name);
      } catch (emailError) {
        console.error(`[EMAIL] FAILED to send password reset OTP to ${email}:`, emailError.message);
        throw new Error("Failed to send password reset OTP. Please try again later.");
      }
    }

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const verifyForgotPasswordOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const now = new Date();
    const verifiedUser = await User.findOneAndUpdate(
      {
        email: email.toLowerCase(),
        resetToken: otp,
        isActive: true,
        emailVerified: true,
        resetTokenExpiry: { $gt: now },
      },
      {
        $set: {
          resetOtpVerified: true,
          resetOtpVerifiedAt: now,
        },
      },
      { new: true },
    );

    if (!verifiedUser) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify forgot password OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const resetPasswordController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP and new password are required",
      });
    }

    const strongPasswordPattern = /^(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordPattern.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain at least one special character",
      });
    }

    const now = new Date();
    const verifiedCutoff = new Date(Date.now() - OTP_VALIDITY_MS);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedUser = await User.findOneAndUpdate(
      {
        email: email.toLowerCase(),
        resetToken: otp,
        isActive: true,
        emailVerified: true,
        resetTokenExpiry: { $gt: now },
        resetOtpVerified: true,
        resetOtpVerifiedAt: { $gte: verifiedCutoff },
      },
      {
        $set: {
          salt,
          hashed_password: hashedPassword,
        },
        $unset: {
          resetToken: 1,
          resetTokenExpiry: 1,
          resetOtpVerified: 1,
          resetOtpVerifiedAt: 1,
        },
      },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid, expired, or unverified OTP session",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const changePasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password, new password and confirmation are required",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match",
      });
    }

    const strongPasswordPattern = /^(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordPattern.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain at least one special character",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user?.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.hashed_password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.salt = String(salt);
    user.hashed_password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const tokens = generateTokens(user._id, user.tokenVersion);

    applyAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        ...tokens,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          company: user.company,
          address: user.address,
        },
      },
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const signoutController = async (req, res) => {
  try {
    res.clearCookie("shipwise_access", { path: "/" });
    res.clearCookie("shipwise_refresh", { path: "/" });

    res.status(200).json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("Sign out error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const sendActivationEmail = async (email, token, name) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Verify connection configuration
  try {
    await transporter.verify();
  } catch (verifyError) {
    console.error("[EMAIL] SMTP verification FAILED:", verifyError.message);
    throw verifyError;
  }

  const emailData = {
    from: `"ShipWise" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "ShipWise Verification Code",
    html: buildOtpEmailTemplate({
      name,
      otpCode: token,
      title: "Verify Your ShipWise Account",
      subtitle: "please use the OTP below to complete your sign up.",
      note: "This code is valid for 5 minutes. Do not share it with anyone.",
    }),
  };

  await transporter.sendMail(emailData);
};


const sendPasswordResetEmail = async (email, token, name) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const emailData = {
    from: `"ShipWise Support" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "ShipWise Password Reset OTP",
    html: buildOtpEmailTemplate({
      name,
      otpCode: token,
      title: "Reset Your ShipWise Password",
      subtitle: "please use the OTP below to continue your password reset.",
      note: "This code is valid for 5 minutes. Do not share it with anyone.",
    }),
  };

  await transporter.sendMail(emailData);
};


export const checkVerifiedController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      verified: !!user.emailVerified,
      message: user.emailVerified ? "User is verified" : "User is not verified",
    });
  } catch (error) {
    console.error("Check verified error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
