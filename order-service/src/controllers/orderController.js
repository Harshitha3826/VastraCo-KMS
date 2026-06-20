const axios = require('axios');
const OrderModel = require('../models/orderModel');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';

const placeOrder = async (req, res) => {
  try {
    const { items, shipping_address } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0 || !shipping_address) {
      return res.status(400).json({ error: 'Items and shipping address are required' });
    }

    // 1. Validate all products and fetch authoritative prices from the product service.
    //    This prevents price manipulation from the client.
    const validatedItems = [];
    for (const item of items) {
      let product;
      try {
        const prodRes = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${item.product_id}`);
        product = prodRes.data;
      } catch (err) {
        return res.status(400).json({ error: `Product ${item.product_id} not found` });
      }

      validatedItems.push({
        ...item,
        unit_price: Number(product.price)
      });
    }

    // 2. Decrement stock for each item, tracking what succeeded for compensation on failure.
    const decremented = [];
    for (const item of validatedItems) {
      try {
        await axios.put(`${PRODUCT_SERVICE_URL}/api/products/variant/${item.variant_id}/stock`, {
          quantity: item.quantity
        });
        decremented.push(item);
      } catch (err) {
        // Roll back stock for items already decremented before this failure.
        for (const d of decremented) {
          try {
            await axios.put(`${PRODUCT_SERVICE_URL}/api/products/variant/${d.variant_id}/stock/restore`, {
              quantity: d.quantity
            });
          } catch (rollbackErr) {
            console.error(`Stock rollback failed for variant ${d.variant_id}:`, rollbackErr.message);
          }
        }
        return res.status(409).json({ error: `Insufficient stock for ${item.product_name}` });
      }
    }

    // 3. Create the order in the database. If this fails, restore all decremented stock.
    const totalAmount = validatedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    let order;
    try {
      order = await OrderModel.createOrder(userId, validatedItems, shipping_address, totalAmount);
    } catch (dbErr) {
      for (const d of decremented) {
        try {
          await axios.put(`${PRODUCT_SERVICE_URL}/api/products/variant/${d.variant_id}/stock/restore`, {
            quantity: d.quantity
          });
        } catch (rollbackErr) {
          console.error(`Stock rollback failed for variant ${d.variant_id}:`, rollbackErr.message);
        }
      }
      throw dbErr;
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('placeOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const orders = await OrderModel.getOrdersByUser(req.user.id);
    res.status(200).json(orders);
  } catch (error) {
    console.error('getUserOrders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await OrderModel.getOrderByIdAndUser(req.params.id, req.user.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const order = await OrderModel.getOrderByIdAndUser(orderId, userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }

    const updatedOrder = await OrderModel.updateOrderStatus(orderId, userId, 'cancelled');

    // Restore stock for all items in the cancelled order.
    for (const item of order.items) {
      try {
        await axios.put(`${PRODUCT_SERVICE_URL}/api/products/variant/${item.variant_id}/stock/restore`, {
          quantity: item.quantity
        });
      } catch (err) {
        console.error(`Stock restore failed for variant ${item.variant_id}:`, err.message);
      }
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('cancelOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { placeOrder, getUserOrders, getOrderById, cancelOrder };
