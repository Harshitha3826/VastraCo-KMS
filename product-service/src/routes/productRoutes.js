const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware, requireAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/categories', productController.getCategories);
router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProductById);

// Admin-only routes
router.post('/products', authMiddleware, requireAdmin, productController.createProduct);
router.put('/products/:id', authMiddleware, requireAdmin, productController.updateProduct);
router.delete('/products/:id', authMiddleware, requireAdmin, productController.deleteProduct);

// Internal stock management — called by order-service within the Docker network
router.put('/products/variant/:id/stock', productController.decrementStock);
router.put('/products/variant/:id/stock/restore', productController.restoreStock);

module.exports = router;
