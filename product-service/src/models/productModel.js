const db = require('../db');

const ProductModel = {
  async getProducts({
    categoryId, search, minPrice, maxPrice,
    gender, occasion, material, color, brand, tags,
    sort = 'newest', page = 1, limit = 20
  } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    let p = 1; // param counter

    let where = 'WHERE 1=1';

    if (categoryId) {
      where += ` AND p.category_id = $${p++}`;
      params.push(categoryId);
    }

    if (search) {
      // Search across name, brand, description, material, style, occasion, and tags
      where += ` AND (
        p.name        ILIKE $${p}
        OR p.brand    ILIKE $${p}
        OR p.description ILIKE $${p}
        OR p.material ILIKE $${p}
        OR p.style    ILIKE $${p}
        OR p.occasion ILIKE $${p}
        OR p.subcategory ILIKE $${p}
        OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $${p})
      )`;
      params.push(`%${search}%`);
      p++;
    }

    if (minPrice !== undefined && minPrice !== null) {
      where += ` AND p.price >= $${p++}`;
      params.push(Number(minPrice));
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      where += ` AND p.price <= $${p++}`;
      params.push(Number(maxPrice));
    }

    if (gender) {
      where += ` AND (p.gender = $${p} OR p.gender = 'unisex')`;
      params.push(gender.toLowerCase());
      p++;
    }

    if (occasion) {
      where += ` AND p.occasion ILIKE $${p++}`;
      params.push(`%${occasion}%`);
    }

    if (material) {
      where += ` AND p.material ILIKE $${p++}`;
      params.push(`%${material}%`);
    }

    if (brand) {
      where += ` AND p.brand ILIKE $${p++}`;
      params.push(`%${brand}%`);
    }

    if (color) {
      where += ` AND EXISTS (
        SELECT 1 FROM product_variants pv
        WHERE pv.product_id = p.id AND pv.color ILIKE $${p++}
      )`;
      params.push(`%${color}%`);
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      for (const tag of tagList) {
        where += ` AND EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $${p++})`;
        params.push(`%${tag}%`);
      }
    }

    const sortMap = {
      price_asc:   'p.price ASC',
      price_desc:  'p.price DESC',
      newest:      'p.created_at DESC',
      rating:      'p.rating DESC NULLS LAST',
      popularity:  'p.review_count DESC NULLS LAST',
    };
    const orderBy = sortMap[sort] || 'p.created_at DESC';

    const query = `
      SELECT p.*, c.name AS category_name, COUNT(*) OVER() AS total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${p} OFFSET $${p + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    return {
      products: result.rows,
      total,
      page,
      limit,
    };
  },

  async getProductById(id) {
    const prodResult = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    if (prodResult.rows.length === 0) return null;

    const product = prodResult.rows[0];
    const varResult = await db.query(
      `SELECT * FROM product_variants WHERE product_id = $1 ORDER BY size, color`,
      [id]
    );
    product.variants = varResult.rows;
    return product;
  },

  async getCategories() {
    const result = await db.query(`SELECT * FROM categories ORDER BY name`);
    return result.rows;
  },

  async createProduct(data) {
    const { name, description, price, category_id, subcategory, brand, gender, occasion, style, material, rating, tags, is_featured, image_url } = data;
    const result = await db.query(
      `INSERT INTO products (name, description, price, category_id, subcategory, brand, gender, occasion, style, material, rating, tags, is_featured, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [name, description, price, category_id, subcategory, brand, gender, occasion, style, material, rating, tags, is_featured || false, image_url]
    );
    return result.rows[0];
  },

  async updateProduct(id, data) {
    const { name, description, price, category_id, subcategory, brand, gender, occasion, style, material, rating, tags, is_featured, image_url } = data;
    const result = await db.query(
      `UPDATE products SET
         name        = COALESCE($1, name),
         description = COALESCE($2, description),
         price       = COALESCE($3, price),
         category_id = COALESCE($4, category_id),
         subcategory = COALESCE($5, subcategory),
         brand       = COALESCE($6, brand),
         gender      = COALESCE($7, gender),
         occasion    = COALESCE($8, occasion),
         style       = COALESCE($9, style),
         material    = COALESCE($10, material),
         rating      = COALESCE($11, rating),
         tags        = COALESCE($12, tags),
         is_featured = COALESCE($13, is_featured),
         image_url   = COALESCE($14, image_url)
       WHERE id = $15 RETURNING *`,
      [name, description, price, category_id, subcategory, brand, gender, occasion, style, material, rating, tags, is_featured, image_url, id]
    );
    return result.rows[0] || null;
  },

  async deleteProduct(id) {
    const result = await db.query(`DELETE FROM products WHERE id = $1`, [id]);
    return result.rowCount > 0;
  },

  async decrementStock(variantId, quantity) {
    const result = await db.query(
      `UPDATE product_variants
       SET stock_quantity = stock_quantity - $1
       WHERE id = $2 AND stock_quantity >= $1
       RETURNING *`,
      [quantity, variantId]
    );
    return result.rows[0] || null;
  },

  async restoreStock(variantId, quantity) {
    const result = await db.query(
      `UPDATE product_variants
       SET stock_quantity = stock_quantity + $1
       WHERE id = $2
       RETURNING *`,
      [quantity, variantId]
    );
    return result.rows[0] || null;
  },
};

module.exports = ProductModel;
