const ProductModel = require('../models/productModel');

const getProducts = async (req, res) => {
  try {
    const {
      category, search, page, limit,
      min_price, max_price, gender, occasion,
      material, color, brand, tags, sort
    } = req.query;

    const result = await ProductModel.getProducts({
      categoryId: category || undefined,
      search:     search   || undefined,
      minPrice:   min_price !== undefined ? Number(min_price) : undefined,
      maxPrice:   max_price !== undefined ? Number(max_price) : undefined,
      gender:     gender   || undefined,
      occasion:   occasion || undefined,
      material:   material || undefined,
      color:      color    || undefined,
      brand:      brand    || undefined,
      tags:       tags     || undefined,
      sort:       sort     || 'newest',
      page:       parseInt(page)  || 1,
      limit:      parseInt(limit) || 20,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await ProductModel.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json(product);
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await ProductModel.getCategories();
    res.status(200).json(categories);
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    if (isNaN(price) || Number(price) < 0) {
      return res.status(400).json({ error: 'Price must be a non-negative number' });
    }
    const product = await ProductModel.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { price } = req.body;
    if (price !== undefined && (isNaN(price) || Number(price) < 0)) {
      return res.status(400).json({ error: 'Price must be a non-negative number' });
    }
    const product = await ProductModel.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json(product);
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const deleted = await ProductModel.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.status(204).send();
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const decrementStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }
    const updatedVariant = await ProductModel.decrementStock(req.params.id, quantity);
    if (!updatedVariant) {
      return res.status(409).json({ error: 'Insufficient stock or variant not found' });
    }
    res.status(200).json(updatedVariant);
  } catch (error) {
    console.error('decrementStock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const restoreStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }
    const updatedVariant = await ProductModel.restoreStock(req.params.id, quantity);
    if (!updatedVariant) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    res.status(200).json(updatedVariant);
  } catch (error) {
    console.error('restoreStock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  decrementStock,
  restoreStock,
};
