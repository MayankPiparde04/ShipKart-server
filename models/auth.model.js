import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// Enhanced user schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    name: {
      type: String,
      trim: true,
      required: [true, "Name is required"],
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    hashed_password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    salt: {
      type: String,
      // Salt is handled by bcrypt internally, usually part of hash, but keeping field for schema compatibility if needed
      required: false,
    },
    role: {
      type: String,
      enum: ["subscriber", "admin", "moderator"],
      default: "subscriber",
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, "Please provide a valid phone number"],
    },
    company: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    activationToken: String,
    activationTokenExpiry: Date,
    resetToken: String,
    resetTokenExpiry: Date,
    resetOtpVerified: {
      type: Boolean,
      default: false,
    },
    resetOtpVerifiedAt: Date,
    lastLogin: Date,
    tokenVersion: {
      type: Number,
      default: 0,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    deviceInfo: {
      type: Object,
      default: null,
    },
    preferences: {
      notifications: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        default: "en",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.hashed_password;
        delete ret.salt;
        delete ret.activationToken;
        delete ret.resetToken;
        return ret;
      },
    },
  },
);

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ activationToken: 1 });
userSchema.index({ resetToken: 1 });

// Virtual for password
userSchema
  .virtual("password")
  .set(function (password) {
    this._password = password;
    // bcrypt handles salting
    this.hashed_password = this.encryptPassword(password);
  })
  .get(function () {
    return this._password;
  });

// Virtual for account locked
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware
userSchema.pre("save", async function () {
  // Hash password if a plain text password was provided via the virtual setter
  if (this._password) {
    const salt = await bcrypt.genSalt(12);
    this.salt = salt.toString();
    this.hashed_password = await bcrypt.hash(this._password, salt);
    // Clear the plain text password after hashing
    this._password = undefined;
  }
});

// Instance methods
userSchema.methods = {
  authenticate: function (plainText) {
    return bcrypt.compareSync(plainText, this.hashed_password);
  },

  // Kept for backward compatibility if called, but pre-save does the work
  encryptPassword: function (password) {
    if (!password) return "";
    // Returning a dummy string to pass schema validation (required, minlength: 6)
    // The actual hashing happens in the pre-save middleware.
    return "secret_placeholder";
  },

  makeSalt: function () {
    return Math.round(Date.now() * Math.random()) + "";
  },

  // Method to handle failed login attempts
  incLoginAttempts: function () {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
      return this.updateOne({
        $set: {
          loginAttempts: 1,
        },
        $unset: {
          lockUntil: 1,
        },
      });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account after 5 failed attempts for 2 hours
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
      updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }

    return this.updateOne(updates);
  },

  // Reset login attempts
  resetLoginAttempts: function () {
    return this.updateOne({
      $unset: {
        loginAttempts: 1,
        lockUntil: 1,
      },
    });
  },

  // Generate activation token
  generateActivationToken: function () {
    // Generate a 6-digit OTP
    this.activationToken = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    this.activationTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    return this.activationToken;
  },

  // Generate reset token
  generateResetToken: function () {
    this.resetToken = uuidv4();
    this.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    return this.resetToken;
  },
};

// Static methods
userSchema.statics = {
  // Find user by credentials
  findByCredentials: async function (email, password) {
    const user = await this.findOne({
      email: email.toLowerCase(),
      isActive: true,
    });

    if (!user || user.isLocked) {
      return null;
    }

    const isMatch = user.authenticate(password);

    if (!isMatch) {
      await user.incLoginAttempts();
      return null;
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return user;
  },
};

export default mongoose.model("User", userSchema);
