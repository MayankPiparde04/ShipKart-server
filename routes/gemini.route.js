import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Prediction from "../models/prediction.model.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { sanitizeInput } from "../middleware/validation.middleware.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/images");
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `item-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
    }
  },
});

// genAI is lazily initialized per-request to ensure dotenv has loaded the key
// (ESM import hoisting runs before dotenv.config() in server.js)
let genAI = null;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI;
}

// Helper function to convert image to base64
async function fileToGenerativePart(filePath, mimeType) {
  const imageBuffer = await fs.readFile(filePath);
  return {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };
}

// Helper function to clean up uploaded files
async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Error cleaning up file:", error);
  }
}

// Helper function for retry logic
async function retryWithDelay(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      const isRetryableError =
        error.message.includes("503") ||
        error.message.includes("overloaded") ||
        error.message.includes("quota") ||
        error.message.includes("rate limit");

      if (!isRetryableError || isLastAttempt) {
        throw error;
      }

      console.warn(
        `Attempt ${i + 1} failed, retrying in ${delay}ms...`,
        error.message,
      );
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
    }
  }
}

router.post(
  "/predict-dimensions",
  authenticateToken,
  upload.single("image"),
  sanitizeInput,
  async (req, res) => {
    let filePath = null;
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Image file is required",
        });
      }

      filePath = req.file.path;
      const { referenceObject, unit = "cm", additionalContext } = req.body;

      // Validate inputs
      if (referenceObject && typeof referenceObject !== "string") {
        return res.status(400).json({
          success: false,
          message: "Reference object must be a string",
        });
      }

      const allowedUnits = ["cm", "inch", "mm"];
      if (!allowedUnits.includes(unit)) {
        return res.status(400).json({
          success: false,
          message: "Unit must be one of: cm, inch, mm",
        });
      }

      // Prepare the image for Gemini
      const imagePart = await fileToGenerativePart(filePath, req.file.mimetype);

      // Create detailed prompt for dimension prediction
      const prompt = `Analyze this image and predict the following product details:

Requirements:
1. Identify the product name (main object in the image)
2. Estimate its length, breadth (width), and height in centimeters (cm)
3. Estimate its weight in grams (g)
4. Estimate its price in Rupees (Rs.)
5. Identify the product category (e.g., electronics, apparel, etc.)
6. Provide confidence level for your estimates
7. If uncertain, indicate lower confidence

Return response in this exact JSON format:
{
  "product_name": "identified product name",
  "category": "product category",
  "dimensions": {
    "length": number,
    "breadth": number,
    "height": number,
    "unit": "cm"
  },
  "weight": {
    "value": number,
    "unit": "gram",
    "confidence": "low|medium|high"
  },
  "confidence_level": "low|medium|high",
  "notes": "any additional observations",
  "price": number

}

Be as accurate as possible with measurements. If uncertain, indicate lower confidence.`;

      // Generate response with retry logic using new Google GenAI SDK
      const retryAttempts = parseInt(process.env.GEMINI_RETRY_ATTEMPTS) || 3;
      const retryDelay = parseInt(process.env.GEMINI_RETRY_DELAY) || 2000;

      const result = await retryWithDelay(
        async () => {
          return await getGenAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }, imagePart],
              },
            ],
          });
        },
        retryAttempts,
        retryDelay,
      );

      const text = result.text;

      // Parse JSON from response
      let parsedResult;
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        console.error("Error parsing Gemini response:", parseError);
        return res.status(500).json({
          success: false,
          message: "Failed to parse AI response",
          rawResponse: text.substring(0, 500), // First 500 chars for debugging
        });
      }

      // Validate parsed result structure
      if (!parsedResult.dimensions || !parsedResult.product_name) {
        return res.status(500).json({
          success: false,
          message: "Invalid response format from AI",
          rawResponse: text.substring(0, 500),
        });
      }

      // Save prediction to database
      const prediction = new Prediction({
        userId: req.user._id,
        // imageUrl: req.file.path, // Uncomment if you want to store file path
        productName: parsedResult.product_name,
        category: parsedResult.category,
        dimensions: parsedResult.dimensions,
        weight: parsedResult.weight,
        price: parsedResult.price,
        confidenceLevel: parsedResult.confidence_level,
        notes: parsedResult.notes,
        processingInfo: {
          processingTime: Date.now() - startTime,
          modelUsed: "gemini-1.5-flash",
        },
      });

      await prediction.save();

      // Clean up uploaded file
      await cleanupFile(filePath);

      // Log successful prediction for analytics
      console.log(
        `Dimension prediction stored for user ${req.user._id}: ${parsedResult.product_name}`,
      );

      res.status(200).json({
        success: true,
        message: "Dimension prediction completed successfully",
        data: {
          prediction: parsedResult,
          id: prediction._id,
          processing_info: {
            image_processed: true,
            file_size: req.file.size,
            processing_time: new Date().toISOString(),
            user_id: req.user._id,
            retry_attempts_used: 0,
          },
        },
      });
    } catch (error) {
      console.error("Error in dimension prediction:", error);

      // Clean up file in case of error
      if (filePath) {
        await cleanupFile(filePath);
      }

      if (error.message.includes("API key")) {
        return res.status(500).json({
          success: false,
          message: error.message, // Return the raw message so the user sees the API key error explicitly
        });
      }

      if (
        error.message.includes("503") ||
        error.message.includes("overloaded")
      ) {
        return res.status(503).json({
          success: false,
          message:
            "AI service is temporarily overloaded. Please try again in a few minutes.",
          retryAfter: 60, // seconds
        });
      }

      if (error.message.includes("quota") || error.message.includes("limit")) {
        return res.status(429).json({
          success: false,
          message: "AI service rate limit exceeded. Please try again later.",
          retryAfter: 300, // seconds
        });
      }

      if (
        error.message.includes("400") ||
        error.message.includes("Bad Request")
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid image format or content. Please try with a different image.",
        });
      }

      res.status(500).json({
        success: false,
        message: "Error processing image for dimension prediction",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  },
);

// Get prediction history for user
router.get("/prediction-history", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const predictions = await Prediction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Prediction.countDocuments({ userId: req.user._id });

    res.status(200).json({
      success: true,
      message: "Prediction history retrieved",
      data: {
        predictions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPredictions: total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching prediction history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching prediction history",
    });
  }
});

export default router;
