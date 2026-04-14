import User from "../models/auth.model.js";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import crypto from "crypto";


const generateTokens = (userId) => {
  const accessToken = jwt.sign({ _id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });

  const refreshToken = jwt.sign(
    { _id: userId, type: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "14d" },
  );

  return { accessToken, refreshToken };
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


    const activationToken = crypto.randomInt(100000, 1000000).toString();
    const activationTokenExpiry = new Date(
      Date.now() + 60 * 60 * 1000 * 24 * 30,
    ); // 30 days


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
        console.log(`[EMAIL] Activation email sent to ${email}`);
      } catch (emailError) {
        console.error(`[EMAIL] FAILED to send activation email to ${email}:`, emailError.message);
        // Don't block registration if email fails — user can request resend
      }
    }

    res.status(201).json({
      success: true,
      message: `Registration successful. Activation email sent to ${email}`,
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
      activationTokenExpiry: { $gt: new Date() },
      emailVerified: false,
    });

    if (!user) {
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


    const { accessToken, refreshToken } = generateTokens(user._id);

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


    const activationToken = crypto.randomInt(100000, 1000000).toString();
    const activationTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    user.activationToken = activationToken;
    user.activationTokenExpiry = activationTokenExpiry;
    await user.save();

    if (process.env.NODE_ENV !== "test") {
      try {
        await sendActivationEmail(user.email, activationToken, user.name);
        console.log(`[EMAIL] Resent activation email to ${user.email}`);
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


    const { accessToken, refreshToken } = generateTokens(user._id);

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


    const tokens = generateTokens(user._id);

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

    const user = await User.findOne({
      email: email.toLowerCase(),
      isActive: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();


    if (process.env.NODE_ENV !== "test") {
      try {
        await sendPasswordResetEmail(email, resetToken, user.name);
        console.log(`[EMAIL] Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error(`[EMAIL] FAILED to send password reset email to ${email}:`, emailError.message);
        throw new Error("Failed to send password reset email. Please try again later.");
      }
    }

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const resetPasswordController = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }


    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

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


export const signoutController = async (req, res) => {
  try {

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
  console.log(`[EMAIL] Attempting to send activation email to: ${email}`);
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
    console.log("[EMAIL] SMTP connection verified successfully");
  } catch (verifyError) {
    console.error("[EMAIL] SMTP verification FAILED:", verifyError.message);
    throw verifyError;
  }

  const emailData = {
    from: `"ShipWise" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Activate Your ShipWise Account - ShipWise",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Welcome to ShipWise, ${name}!</h2>
        <p>Thank you for joining ShipWise. To complete your registration and activate your account, please use the 6-digit verification code below:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="font-size: 36px; letter-spacing: 6px; color: #1f2937; margin: 0;">${token}</h1>
        </div>
        <p>This code will expire in 30 minutes. If you did not sign up for an account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          ShipWise — Smart Packing & Shipping Solution
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(emailData);
  console.log(`[EMAIL] Activation email sent. MessageId: ${info.messageId}`);
};


const sendPasswordResetEmail = async (email, token, name) => {
  console.log(`[EMAIL] Attempting to send reset email to: ${email}`);
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
    subject: "Reset Your Password - ShipWise",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>You recently requested to reset your password for your ShipWise account. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/auth/reset-password/${token}" 
             style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 15 minutes. If you did not request a password reset, please ignore this email.</p>
        <p style="font-size: 12px; color: #6b7280;">
          For security, this link can only be used once. If it doesn't work, please request a new link.
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(emailData);
  console.log(`[EMAIL] Reset email sent. MessageId: ${info.messageId}`);
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
