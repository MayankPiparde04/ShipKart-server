# ShipWise Backend API

A sophisticated backend application for intelligent shipping and packaging optimization, featuring advanced 3D bin packing algorithms, AI-powered dimension prediction, and comprehensive user management.

## 🚀 Overview

ShipWise Backend provides REST APIs for optimal packaging solutions, helping businesses minimize shipping costs and maximize space utilization through intelligent algorithms and AI-driven insights.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens)
- **AI Integration:** Google Gemini AI
- **Security:** Helmet, CORS, Rate Limiting
- **File Upload:** Multer
- **Email Service:** Nodemailer, SendGrid
- **Deployment:** Vercel
- **Environment:** dotenv for configuration

## 📋 Features

### Core Features
- **Advanced 3D Bin Packing:** Multiple algorithms (First Fit Decreasing, Best Fit Decreasing, Guillotine, Skyline, Hybrid)
- **AI-Powered Dimension Prediction:** Upload product images to predict dimensions and weights
- **User Authentication & Authorization:** Complete auth system with email verification
- **Product & Box Management:** CRUD operations for products and shipping containers
- **Optimal Packing Calculator:** Multi-product packing optimization
- **Shipping Cost Calculation:** Intelligent shipping cost estimation
- **Real-time Analytics:** Packing efficiency and cost analysis

### Advanced Capabilities
- **Multi-Algorithm Optimization:** Hybrid approach combining multiple packing strategies
- **Fragile Item Handling:** Special considerations for delicate products
- **Stacking Logic:** Intelligent vertical space utilization
- **Cost Optimization:** Minimize shipping costs while maximizing efficiency
- **3D Visualization Data:** Detailed positioning and layout information
- **Weight Distribution Analysis:** Center of mass calculations for stability

### Security & Performance
- **Rate Limiting:** Prevents API abuse
- **Input Validation & Sanitization:** Comprehensive request validation
- **Error Handling:** Robust error management and logging
- **CORS Configuration:** Secure cross-origin resource sharing
- **Compression:** Response compression for better performance

## 🏗️ API Endpoints

### Authentication
```
POST   /api/register           # User registration
POST   /api/login              # User login
GET    /api/activation/:token  # Email verification
POST   /api/refresh-token      # Token refresh
POST   /api/forgot-password    # Password reset request
POST   /api/reset-password     # Password reset
POST   /api/signout           # User logout
```

### Product Management
```
GET    /api/items             # Get user's products
POST   /api/items             # Create new product
PUT    /api/items/:id         # Update product
DELETE /api/items/:id         # Delete product
```

### Box Management
```
GET    /api/boxes             # Get user's boxes
POST   /api/boxes             # Create new box
PUT    /api/boxes/:id         # Update box
DELETE /api/boxes/:id         # Delete box
```

### Packing Optimization
```
POST   /api/optimal-analysis        # Enhanced 3D packing analysis
POST   /api/enhanced-packing        # Multi-product packing optimization
POST   /api/calculate-shipping      # Shipping calculation
GET    /api/carton-sizes           # Available carton sizes
```

### AI Services
```
POST   /api/ai/predict-dimensions   # AI dimension prediction from images
GET    /api/ai/prediction-history  # User's prediction history
```

### System
```
GET    /health                     # Health check endpoint
```

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- Google Gemini AI API key
- Email service credentials (Gmail/SendGrid)

### Installation

1. **Clone the repository**
    ```bash
    git clone <repository-url>
    cd ShipWise/Backend
    ```

2. **Install dependencies**
    ```bash
    npm install
    ```

3. **Environment Setup**
Create a `config/config.env` file with the following variables:

    ```env
    # Server Configuration
    PORT=3001
    NODE_ENV=development

    # Database
    MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/shipwise

    # Client URL
    CLIENT_URL=http://localhost:3000

    # JWT Secrets
    JWT_SECRET=your-jwt-secret-key
    JWT_ACCOUNT_ACTIVATION=your-activation-secret
    JWT_RESET_PASSWORD=your-reset-secret
    JWT_REFRESH_SECRET=your-refresh-secret
    JWT_EXPIRES_IN=15m
    JWT_REFRESH_EXPIRES_IN=7d

    # Email Configuration
    EMAIL_FROM=your-email@gmail.com
    EMAIL_PASSWORD=your-app-password

    # AI Services
    GEMINI_API_KEY=your-gemini-api-key
    ```

4. **Start the development server**
    ```bash
    npm run dev
    ```

5. **Start production server**
    ```bash
    npm start
    ```

The server will start on `http://localhost:3001` and display network access URLs.

## 📚 API Documentation

### Packing Algorithm Options

The enhanced packing endpoint supports multiple algorithms:

- **`hybrid`** (default): Combines multiple algorithms for optimal results
- **`ffd`**: First Fit Decreasing - Fast and efficient
- **`bfd`**: Best Fit Decreasing - Better space utilization
- **`guillotine`**: Advanced space cutting algorithm
- **`skyline`**: Skyline-based packing for complex shapes

### Example API Calls

**Optimal Packing Request:**
```javascript
POST /api/optimal-analysis
{
  "productId": "product_id_here",
  "quantity": 50,
  "options": {
    "algorithm": "hybrid",
    "costOptimization": true,
    "fragileHandling": true
  }
}
```

**AI Dimension Prediction:**
```javascript
POST /api/ai/predict-dimensions
Content-Type: multipart/form-data
{
  "image": [image file],
  "referenceObject": "credit card",
  "unit": "cm"
}
```

**Multi-Product Packing:**
```javascript
POST /api/enhanced-packing
{
  "products": [
    {
      "id": "prod1",
      "name": "Product 1",
      "length": 10,
      "breadth": 8,
      "height": 5,
      "weight": 0.5,
      "quantity": 20
    }
  ],
  "cartons": [
    {
      "id": "carton1",
      "length": 30,
      "breadth": 20,
      "height": 15,
      "maxWeight": 10,
      "cost": 2.50
    }
  ]
}
```

## 🌐 Deployment

### Vercel Deployment

The application is configured for Vercel deployment with:
- **Build Configuration:** `vercel.json` for routing
- **Environment Variables:** Set in Vercel dashboard
- **Serverless Functions:** Optimized for serverless architecture

### Production Environment

```bash
# Set production environment variables in your deployment platform
NODE_ENV=production
MONGODB_URI=your-production-mongodb-url
CLIENT_URL=your-frontend-url
```

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `CLIENT_URL` | Frontend application URL | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_ACCOUNT_ACTIVATION` | Account activation token secret | Yes |
| `JWT_RESET_PASSWORD` | Password reset token secret | Yes |
| `JWT_REFRESH_SECRET` | Refresh token secret | Yes |
| `JWT_EXPIRES_IN` | Access token expiration | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | No |
| `EMAIL_FROM` | Sender email address | Yes |
| `EMAIL_PASSWORD` | Email service password/app password | Yes |
| `GEMINI_API_KEY` | Google Gemini AI API key | Yes |

## 🏗️ Project Structure

```
Backend/
├── config/
│   ├── config.env          # Environment variables
│   └── db.js              # Database configuration
├── controllers/           # Route controllers
├── middleware/           # Custom middleware
├── models/              # MongoDB schemas
├── routes/              # API routes
├── utils/               # Utility functions
├── uploads/             # File upload directory
├── server.js           # Main server file
├── vercel.json         # Vercel deployment config
└── package.json        # Dependencies and scripts
```

## 🔐 Security Features

- **Rate Limiting:** Prevents API abuse and DDoS attacks
- **Input Validation:** Comprehensive request validation using express-validator
- **Sanitization:** Input sanitization to prevent XSS attacks
- **CORS Protection:** Configurable cross-origin request handling
- **Helmet:** Security headers for protection against common vulnerabilities
- **JWT Authentication:** Secure stateless authentication
- **File Upload Security:** Restricted file types and size limits

## 🚦 Health Monitoring

Access the health check endpoint to monitor server status:

```bash
GET /health
```

Response includes:
- Server status
- Environment information
- Timestamp
- Network accessibility

## 📈 Performance Features

- **Response Compression:** Gzip compression for faster data transfer
- **Connection Pooling:** Efficient database connection management
- **Caching Strategies:** Optimized for repeated calculations
- **Memory Management:** Efficient handling of large datasets
- **Algorithmic Optimization:** Multiple packing algorithms for different scenarios

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation for common solutions

## 🔄 Version History

- **v2.0.0** - Enhanced 3D packing algorithms, AI integration, multi-product support
- **v1.0.0** - Initial release with basic packing and authentication

---

**Built with ❤️ for efficient shipping and packaging optimization**