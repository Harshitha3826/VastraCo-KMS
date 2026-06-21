const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PRODUCT_DB_HOST,
  port: process.env.PRODUCT_DB_PORT || 5432,
  database: process.env.PRODUCT_DB_NAME,
  user: process.env.PRODUCT_DB_USER,
  password: process.env.PRODUCT_DB_PASSWORD,
});

const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('Connected to Product DB, initializing tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        subcategory VARCHAR(100),
        brand VARCHAR(100),
        gender VARCHAR(20),
        occasion VARCHAR(200),
        style VARCHAR(100),
        material VARCHAR(100),
        rating NUMERIC(3,1) DEFAULT 4.0,
        review_count INTEGER DEFAULT 0,
        tags TEXT[],
        is_featured BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Image corrections — fix wrong Unsplash photo IDs in live DB
    await client.query(`
      UPDATE products SET image_url = 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=500&auto=format&fit=crop&q=60'
      WHERE name = 'Sequin Party Mini Dress'
        AND image_url LIKE '%1518895312237%'
    `);
    await client.query(`
      UPDATE products SET image_url = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&auto=format&fit=crop&q=60'
      WHERE name = 'Bohemian Tie-Dye Maxi Dress'
        AND image_url LIKE '%1571945153237%'
    `);

    // Schema migrations — safe to run every startup on existing deployments
    const migrations = [
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100)`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS occasion VARCHAR(200)`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS style VARCHAR(100)`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(100)`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 4.0`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[]`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE`,
    ];
    for (const sql of migrations) {
      await client.query(sql);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        size VARCHAR(20) NOT NULL,
        color VARCHAR(50) NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        sku VARCHAR(120) UNIQUE NOT NULL
      )
    `);

    // Build category map from existing (or new) categories
    let catMap = {};
    const catRows = await client.query('SELECT id, name FROM categories');
    if (catRows.rows.length === 0) {
      console.log('Creating categories...');
      const categoryNames = ["Men's Shirts", "Women's Dresses", "Jeans", "Ethnic Wear", "Accessories"];
      for (const catName of categoryNames) {
        const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const res = await client.query(
          'INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id',
          [catName, slug]
        );
        catMap[catName] = res.rows[0].id;
      }
    } else {
      for (const row of catRows.rows) {
        catMap[row.name] = row.id;
      }
    }

    // Re-seed if no products have tags yet (fresh deploy or old schema)
    const tagCheck = await client.query(
      `SELECT COUNT(*) FROM products WHERE tags IS NOT NULL AND array_length(tags, 1) > 0`
    );
    if (parseInt(tagCheck.rows[0].count) === 0) {
      console.log('Seeding comprehensive product catalog...');
      await client.query('DELETE FROM products'); // cascades to product_variants

      const seedProducts = [
        // ─── MEN'S SHIRTS ────────────────────────────────────────────────────
        {
          name: "Classic White Formal Shirt",
          description: "A premium classic white formal shirt crafted from 100% pure cotton for all-day comfort. Features a spread collar, chest pocket, and slim fit silhouette — perfect for office meetings, corporate events, and formal occasions. Wrinkle-resistant fabric keeps you looking sharp throughout the day.",
          price: 1499.00, cat: "Men's Shirts", subcategory: "Formal Shirts",
          brand: "Raymond", gender: "men", occasion: "formal, office",
          style: "slim fit", material: "cotton",
          rating: 4.5, review_count: 328, is_featured: true,
          img: "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?w=500&auto=format&fit=crop&q=60",
          tags: ["white", "formal", "office", "slim fit", "cotton", "full sleeve", "classic", "workwear", "men"],
          variants: [
            { size: "S", color: "White", stock: 45 },
            { size: "M", color: "White", stock: 62 },
            { size: "L", color: "White", stock: 58 },
            { size: "XL", color: "White", stock: 34 },
            { size: "XXL", color: "White", stock: 21 },
          ]
        },
        {
          name: "Blue Oxford Cotton Shirt",
          description: "Crafted from breathable Oxford weave cotton, this versatile shirt transitions effortlessly from boardroom to casual outings. The classic blue colour pairs easily with trousers or jeans. Regular fit with a button-down collar for a timeless, polished look.",
          price: 1299.00, cat: "Men's Shirts", subcategory: "Formal Shirts",
          brand: "Peter England", gender: "men", occasion: "formal, office, casual",
          style: "regular fit", material: "cotton",
          rating: 4.3, review_count: 512, is_featured: false,
          img: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&auto=format&fit=crop&q=60",
          tags: ["blue", "formal", "office", "oxford", "cotton", "regular fit", "full sleeve", "men", "casual"],
          variants: [
            { size: "S", color: "Blue", stock: 38 },
            { size: "M", color: "Blue", stock: 55 },
            { size: "L", color: "Blue", stock: 49 },
            { size: "XL", color: "Blue", stock: 30 },
            { size: "XXL", color: "Blue", stock: 15 },
            { size: "M", color: "Light Blue", stock: 28 },
            { size: "L", color: "Light Blue", stock: 33 },
          ]
        },
        {
          name: "Linen Blend Casual Shirt",
          description: "Beat the heat with this breathable linen blend casual shirt from FabIndia. The natural linen fabric keeps you cool in warm weather while the relaxed fit ensures effortless comfort. Ideal for weekend outings, brunch dates, or casual workplaces.",
          price: 1799.00, cat: "Men's Shirts", subcategory: "Casual Shirts",
          brand: "FabIndia", gender: "men", occasion: "casual, summer",
          style: "regular fit", material: "linen",
          rating: 4.4, review_count: 219, is_featured: false,
          img: "https://images.unsplash.com/photo-1598032895397-b9472444bf93?w=500&auto=format&fit=crop&q=60",
          tags: ["linen", "casual", "summer", "regular fit", "full sleeve", "breathable", "men", "beige", "vacation"],
          variants: [
            { size: "S", color: "Beige", stock: 22 },
            { size: "M", color: "Beige", stock: 35 },
            { size: "L", color: "Beige", stock: 40 },
            { size: "XL", color: "Beige", stock: 18 },
            { size: "M", color: "White", stock: 25 },
            { size: "L", color: "White", stock: 30 },
            { size: "M", color: "Olive", stock: 20 },
            { size: "L", color: "Olive", stock: 24 },
          ]
        },
        {
          name: "Checked Flannel Shirt",
          description: "A rugged and warm checked flannel shirt perfect for cooler days. Made from soft brushed cotton flannel with a classic plaid pattern. Features a chest pocket and a relaxed fit that looks great untucked or layered over a tee.",
          price: 1199.00, cat: "Men's Shirts", subcategory: "Casual Shirts",
          brand: "Highlander", gender: "men", occasion: "casual, winter",
          style: "regular fit", material: "cotton",
          rating: 4.2, review_count: 387, is_featured: false,
          img: "https://images.unsplash.com/photo-1588359348347-9bc6cbbb689e?w=500&auto=format&fit=crop&q=60",
          tags: ["checked", "casual", "flannel", "cotton", "winter", "full sleeve", "men", "plaid", "regular fit"],
          variants: [
            { size: "S", color: "Red Check", stock: 30 },
            { size: "M", color: "Red Check", stock: 45 },
            { size: "L", color: "Red Check", stock: 38 },
            { size: "XL", color: "Red Check", stock: 22 },
            { size: "M", color: "Blue Check", stock: 35 },
            { size: "L", color: "Blue Check", stock: 40 },
            { size: "M", color: "Green Check", stock: 28 },
          ]
        },
        {
          name: "Navy Slim Fit Formal Shirt",
          description: "Make a strong impression with this sleek navy blue slim fit formal shirt by Arrow. The premium cotton fabric has a subtle sheen that elevates any formal ensemble. Tailored slim fit silhouette with spread collar — a must-have for professional wardrobes.",
          price: 1699.00, cat: "Men's Shirts", subcategory: "Formal Shirts",
          brand: "Arrow", gender: "men", occasion: "formal, office",
          style: "slim fit", material: "cotton",
          rating: 4.6, review_count: 445, is_featured: true,
          img: "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=500&auto=format&fit=crop&q=60",
          tags: ["navy", "formal", "office", "slim fit", "cotton", "full sleeve", "men", "blue", "workwear"],
          variants: [
            { size: "S", color: "Navy Blue", stock: 30 },
            { size: "M", color: "Navy Blue", stock: 48 },
            { size: "L", color: "Navy Blue", stock: 42 },
            { size: "XL", color: "Navy Blue", stock: 25 },
            { size: "XXL", color: "Navy Blue", stock: 12 },
          ]
        },
        {
          name: "Half Sleeve Solid Casual Shirt",
          description: "A lightweight half sleeve solid casual shirt, perfect for warm summer days. Made from 100% soft cotton, it offers all-day breathability. The minimalist solid design pairs effortlessly with chinos, jeans, or shorts. Great value for everyday wear.",
          price: 899.00, cat: "Men's Shirts", subcategory: "Casual Shirts",
          brand: "H&M", gender: "men", occasion: "casual, summer",
          style: "regular fit", material: "cotton",
          rating: 4.0, review_count: 673, is_featured: false,
          img: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=500&auto=format&fit=crop&q=60",
          tags: ["half sleeve", "casual", "solid", "cotton", "summer", "affordable", "men", "everyday"],
          variants: [
            { size: "S", color: "White", stock: 55 },
            { size: "M", color: "White", stock: 70 },
            { size: "L", color: "White", stock: 65 },
            { size: "S", color: "Black", stock: 50 },
            { size: "M", color: "Black", stock: 65 },
            { size: "L", color: "Black", stock: 60 },
            { size: "M", color: "Blue", stock: 45 },
            { size: "L", color: "Blue", stock: 48 },
            { size: "M", color: "Grey", stock: 40 },
          ]
        },
        {
          name: "Striped Regular Fit Shirt",
          description: "A smart striped shirt from Allen Solly that balances casual style with office-appropriate polish. The fine vertical stripes create a slimming effect while the premium cotton fabric ensures comfort throughout the day. Versatile enough for business casual and weekend wear.",
          price: 1399.00, cat: "Men's Shirts", subcategory: "Casual Shirts",
          brand: "Allen Solly", gender: "men", occasion: "casual, office",
          style: "regular fit", material: "cotton",
          rating: 4.3, review_count: 298, is_featured: false,
          img: "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=500&auto=format&fit=crop&q=60",
          tags: ["striped", "casual", "office", "cotton", "regular fit", "full sleeve", "men", "business casual"],
          variants: [
            { size: "S", color: "Blue Stripe", stock: 28 },
            { size: "M", color: "Blue Stripe", stock: 42 },
            { size: "L", color: "Blue Stripe", stock: 35 },
            { size: "XL", color: "Blue Stripe", stock: 20 },
            { size: "M", color: "White Stripe", stock: 35 },
            { size: "L", color: "White Stripe", stock: 30 },
          ]
        },
        {
          name: "Denim Casual Shirt",
          description: "A classic denim shirt that is a wardrobe essential for any man. Made from sturdy yet soft denim fabric with a relaxed fit and snap button placket. Layer it open over a tee or wear it buttoned-up — it works both ways. Perfect for weekends and casual days.",
          price: 1899.00, cat: "Men's Shirts", subcategory: "Casual Shirts",
          brand: "Wrangler", gender: "men", occasion: "casual",
          style: "regular fit", material: "denim",
          rating: 4.2, review_count: 184, is_featured: false,
          img: "https://images.unsplash.com/photo-1618517351616-38fb9c5df31b?w=500&auto=format&fit=crop&q=60",
          tags: ["denim", "casual", "full sleeve", "regular fit", "western", "men", "blue", "rugged"],
          variants: [
            { size: "S", color: "Blue Denim", stock: 20 },
            { size: "M", color: "Blue Denim", stock: 35 },
            { size: "L", color: "Blue Denim", stock: 38 },
            { size: "XL", color: "Blue Denim", stock: 22 },
            { size: "M", color: "Dark Blue", stock: 28 },
            { size: "L", color: "Dark Blue", stock: 32 },
          ]
        },
        {
          name: "Mandarin Collar Ethnic Shirt",
          description: "A refined mandarin collar shirt from FabIndia that seamlessly blends ethnic charm with contemporary styling. Made from breathable hand-block-print cotton, it is perfect for festive gatherings, casual outings, and cultural events. Pair with kurta-style trousers for a complete look.",
          price: 1299.00, cat: "Men's Shirts", subcategory: "Ethnic Shirts",
          brand: "FabIndia", gender: "men", occasion: "casual, festive",
          style: "regular fit", material: "cotton",
          rating: 4.4, review_count: 156, is_featured: false,
          img: "https://images.unsplash.com/photo-1614251055880-ee96e4803393?w=500&auto=format&fit=crop&q=60",
          tags: ["mandarin collar", "ethnic", "festive", "casual", "cotton", "full sleeve", "men", "handblock print"],
          variants: [
            { size: "S", color: "White", stock: 25 },
            { size: "M", color: "White", stock: 38 },
            { size: "L", color: "White", stock: 32 },
            { size: "XL", color: "White", stock: 18 },
            { size: "M", color: "Off White", stock: 22 },
            { size: "L", color: "Off White", stock: 28 },
            { size: "M", color: "Blue", stock: 20 },
          ]
        },
        {
          name: "Black Formal Slim Shirt",
          description: "A sophisticated all-black slim fit formal shirt from Van Heusen — your go-to for evening events, formal dinners, and corporate galas. The premium cotton blend fabric has a subtle sheen that catches light elegantly. Slim silhouette, spread collar, and impeccable tailoring.",
          price: 1799.00, cat: "Men's Shirts", subcategory: "Formal Shirts",
          brand: "Van Heusen", gender: "men", occasion: "formal, party, evening",
          style: "slim fit", material: "cotton",
          rating: 4.6, review_count: 392, is_featured: true,
          img: "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=500&auto=format&fit=crop&q=60",
          tags: ["black", "formal", "party", "slim fit", "cotton", "full sleeve", "evening", "men", "premium"],
          variants: [
            { size: "S", color: "Black", stock: 35 },
            { size: "M", color: "Black", stock: 52 },
            { size: "L", color: "Black", stock: 45 },
            { size: "XL", color: "Black", stock: 28 },
            { size: "XXL", color: "Black", stock: 14 },
          ]
        },

        // ─── WOMEN'S DRESSES ──────────────────────────────────────────────────
        {
          name: "Floral Print Maxi Dress",
          description: "Embrace effortless summer style with this gorgeous floral print maxi dress. The flowing silhouette and vibrant floral pattern make it perfect for beach days, garden parties, or casual brunches. Lightweight polyester fabric with adjustable spaghetti straps for a flattering fit.",
          price: 2499.00, cat: "Women's Dresses", subcategory: "Maxi Dresses",
          brand: "Vero Moda", gender: "women", occasion: "casual, summer, beach",
          style: "maxi", material: "polyester",
          rating: 4.5, review_count: 341, is_featured: true,
          img: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500&auto=format&fit=crop&q=60",
          tags: ["floral", "maxi", "casual", "summer", "western", "full length", "women", "beach", "print", "spaghetti straps"],
          variants: [
            { size: "XS", color: "Multicolor", stock: 18 },
            { size: "S", color: "Multicolor", stock: 32 },
            { size: "M", color: "Multicolor", stock: 40 },
            { size: "L", color: "Multicolor", stock: 28 },
            { size: "XL", color: "Multicolor", stock: 16 },
            { size: "S", color: "Pink", stock: 22 },
            { size: "M", color: "Pink", stock: 30 },
          ]
        },
        {
          name: "Elegant Black Evening Gown",
          description: "Turn heads at every formal event with this stunning black evening gown. The floor-length silhouette, subtle ruching at the waist, and a tasteful back slit make it a show-stopper. Premium satin-finish polyester drapes beautifully for a couture-like feel at an accessible price.",
          price: 4999.00, cat: "Women's Dresses", subcategory: "Evening Wear",
          brand: "Mango", gender: "women", occasion: "party, formal, evening",
          style: "gown", material: "polyester",
          rating: 4.7, review_count: 198, is_featured: true,
          img: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=500&auto=format&fit=crop&q=60",
          tags: ["black", "gown", "party", "evening", "formal", "western", "elegant", "women", "full length", "premium"],
          variants: [
            { size: "XS", color: "Black", stock: 12 },
            { size: "S", color: "Black", stock: 20 },
            { size: "M", color: "Black", stock: 25 },
            { size: "L", color: "Black", stock: 18 },
          ]
        },
        {
          name: "Summer Midi Sundress",
          description: "Bright, breezy, and beautiful — this sleeveless midi sundress from Only is the perfect warm-weather companion. The A-line silhouette flatters all body types, and the soft cotton fabric keeps you comfortable all day. Pair with sandals for a chic casual look.",
          price: 1899.00, cat: "Women's Dresses", subcategory: "Midi Dresses",
          brand: "Only", gender: "women", occasion: "casual, summer",
          style: "midi", material: "cotton",
          rating: 4.3, review_count: 278, is_featured: false,
          img: "https://images.unsplash.com/photo-1605763240000-7e93b172d754?w=500&auto=format&fit=crop&q=60",
          tags: ["midi", "casual", "summer", "cotton", "sleeveless", "western", "women", "a-line", "sundress", "affordable"],
          variants: [
            { size: "XS", color: "Yellow", stock: 20 },
            { size: "S", color: "Yellow", stock: 35 },
            { size: "M", color: "Yellow", stock: 42 },
            { size: "L", color: "Yellow", stock: 28 },
            { size: "S", color: "Pink", stock: 25 },
            { size: "M", color: "Pink", stock: 30 },
            { size: "M", color: "White", stock: 32 },
          ]
        },
        {
          name: "Polka Dot Wrap Dress",
          description: "A timeless polka dot wrap dress that transitions seamlessly from desk to dinner. The wrap silhouette is universally flattering with a cinched waist and adjustable tie. The V-neckline adds a touch of elegance. Available in classic black-and-white polka dot print.",
          price: 2199.00, cat: "Women's Dresses", subcategory: "Midi Dresses",
          brand: "H&M", gender: "women", occasion: "casual, office",
          style: "wrap", material: "polyester",
          rating: 4.4, review_count: 322, is_featured: false,
          img: "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=500&auto=format&fit=crop&q=60",
          tags: ["polka dot", "wrap dress", "casual", "office", "western", "midi", "women", "v neck", "work wear"],
          variants: [
            { size: "XS", color: "Black White", stock: 15 },
            { size: "S", color: "Black White", stock: 28 },
            { size: "M", color: "Black White", stock: 35 },
            { size: "L", color: "Black White", stock: 22 },
            { size: "XL", color: "Black White", stock: 12 },
            { size: "M", color: "Navy White", stock: 20 },
            { size: "L", color: "Navy White", stock: 18 },
          ]
        },
        {
          name: "Red Bodycon Party Dress",
          description: "Own the night in this bold red bodycon party dress. The figure-hugging stretch fabric highlights your silhouette beautifully, while the above-knee length keeps it playful. A scoop neckline and sleeveless design add to the chic appeal. Perfect for parties, night outs, and celebrations.",
          price: 1799.00, cat: "Women's Dresses", subcategory: "Party Wear",
          brand: "Forever 21", gender: "women", occasion: "party, evening",
          style: "bodycon", material: "polyester",
          rating: 4.2, review_count: 415, is_featured: false,
          img: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=500&auto=format&fit=crop&q=60",
          tags: ["red", "bodycon", "party", "evening", "western", "mini", "women", "night out", "figure hugging"],
          variants: [
            { size: "XS", color: "Red", stock: 22 },
            { size: "S", color: "Red", stock: 38 },
            { size: "M", color: "Red", stock: 45 },
            { size: "L", color: "Red", stock: 30 },
            { size: "S", color: "Black", stock: 28 },
            { size: "M", color: "Black", stock: 35 },
            { size: "S", color: "Royal Blue", stock: 18 },
            { size: "M", color: "Royal Blue", stock: 22 },
          ]
        },
        {
          name: "Floral Off-Shoulder Midi Dress",
          description: "A romantic floral off-shoulder midi dress that is ideal for summer parties, outdoor events, and weekend brunch. The ruffle off-shoulder neckline adds feminine charm, while the midi length keeps the look tasteful. Lightweight woven fabric with a flattering A-line cut.",
          price: 3499.00, cat: "Women's Dresses", subcategory: "Party Wear",
          brand: "Zara", gender: "women", occasion: "party, casual, summer",
          style: "midi", material: "cotton",
          rating: 4.6, review_count: 267, is_featured: true,
          img: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop&q=60",
          tags: ["floral", "off shoulder", "party", "summer", "western", "midi", "women", "a-line", "ruffle"],
          variants: [
            { size: "XS", color: "White Floral", stock: 15 },
            { size: "S", color: "White Floral", stock: 25 },
            { size: "M", color: "White Floral", stock: 30 },
            { size: "L", color: "White Floral", stock: 20 },
            { size: "S", color: "Blue Floral", stock: 18 },
            { size: "M", color: "Blue Floral", stock: 24 },
          ]
        },
        {
          name: "Office Pencil Dress",
          description: "Polished and professional, this pencil dress from Vero Moda is your ultimate workwear statement piece. The knee-length silhouette and structured fit project confidence in any office setting. A subtle back slit allows for ease of movement. Available in classic corporate colours.",
          price: 2299.00, cat: "Women's Dresses", subcategory: "Office Wear",
          brand: "Vero Moda", gender: "women", occasion: "office, formal",
          style: "pencil", material: "polyester",
          rating: 4.4, review_count: 189, is_featured: false,
          img: "https://images.unsplash.com/photo-1594938298603-c8148c4b8c4f?w=500&auto=format&fit=crop&q=60",
          tags: ["pencil dress", "office", "formal", "work wear", "western", "midi", "women", "corporate", "professional"],
          variants: [
            { size: "XS", color: "Black", stock: 20 },
            { size: "S", color: "Black", stock: 32 },
            { size: "M", color: "Black", stock: 38 },
            { size: "L", color: "Black", stock: 25 },
            { size: "XL", color: "Black", stock: 14 },
            { size: "M", color: "Navy", stock: 25 },
            { size: "L", color: "Navy", stock: 20 },
            { size: "M", color: "Grey", stock: 22 },
          ]
        },
        {
          name: "White Cotton Shirt Dress",
          description: "Effortlessly chic, this white cotton shirt dress from AND is a wardrobe staple. The relaxed shirt-style silhouette with a button placket and collar creates a casual-cool aesthetic. Wear it belted for a defined waist or loose for laid-back comfort. Ideal for summer days or casual Fridays.",
          price: 1999.00, cat: "Women's Dresses", subcategory: "Casual Dresses",
          brand: "AND", gender: "women", occasion: "casual, office, summer",
          style: "shirt dress", material: "cotton",
          rating: 4.3, review_count: 231, is_featured: false,
          img: "https://images.unsplash.com/photo-1596993100471-c3905dafa78e?w=500&auto=format&fit=crop&q=60",
          tags: ["white", "cotton", "casual", "shirt dress", "western", "midi", "summer", "women", "casual friday", "versatile"],
          variants: [
            { size: "XS", color: "White", stock: 22 },
            { size: "S", color: "White", stock: 38 },
            { size: "M", color: "White", stock: 45 },
            { size: "L", color: "White", stock: 30 },
            { size: "XL", color: "White", stock: 18 },
            { size: "M", color: "Light Blue", stock: 20 },
            { size: "L", color: "Light Blue", stock: 15 },
          ]
        },
        {
          name: "Bohemian Tie-Dye Maxi Dress",
          description: "Channel your free spirit with this stunning tie-dye maxi dress from Global Desi. The vibrant hand-dyed pattern ensures each piece is unique. A flowing silhouette with tassel detailing at the neckline creates an authentic bohemian look. Perfect for music festivals, holidays, and casual days.",
          price: 2799.00, cat: "Women's Dresses", subcategory: "Maxi Dresses",
          brand: "Global Desi", gender: "women", occasion: "casual, beach, vacation",
          style: "maxi", material: "cotton",
          rating: 4.5, review_count: 145, is_featured: false,
          img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&auto=format&fit=crop&q=60",
          tags: ["tie dye", "maxi", "bohemian", "casual", "western", "cotton", "women", "boho", "festival", "unique"],
          variants: [
            { size: "XS", color: "Multicolor", stock: 12 },
            { size: "S", color: "Multicolor", stock: 20 },
            { size: "M", color: "Multicolor", stock: 25 },
            { size: "L", color: "Multicolor", stock: 18 },
            { size: "S", color: "Blue Tie Dye", stock: 15 },
            { size: "M", color: "Blue Tie Dye", stock: 20 },
          ]
        },
        {
          name: "Sequin Party Mini Dress",
          description: "Shimmer and shine all night in this gorgeous sequin mini dress. The all-over sequin embellishment catches the light at every angle for maximum glam. A form-flattering silhouette with a slightly stretchy fabric ensures both comfort and style. The go-to dress for parties, New Year's Eve, and celebrations.",
          price: 3999.00, cat: "Women's Dresses", subcategory: "Party Wear",
          brand: "Forever 21", gender: "women", occasion: "party, evening, celebration",
          style: "mini", material: "polyester",
          rating: 4.6, review_count: 312, is_featured: true,
          img: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=500&auto=format&fit=crop&q=60",
          tags: ["sequin", "party", "evening", "mini", "western", "glam", "women", "night out", "shimmer", "celebration"],
          variants: [
            { size: "XS", color: "Gold", stock: 14 },
            { size: "S", color: "Gold", stock: 22 },
            { size: "M", color: "Gold", stock: 28 },
            { size: "L", color: "Gold", stock: 18 },
            { size: "S", color: "Silver", stock: 18 },
            { size: "M", color: "Silver", stock: 24 },
            { size: "S", color: "Black", stock: 20 },
            { size: "M", color: "Black", stock: 25 },
          ]
        },

        // ─── JEANS ────────────────────────────────────────────────────────────
        {
          name: "Slim Fit Blue Jeans",
          description: "The iconic Levi's 511 slim fit jeans in classic medium blue wash. A wardrobe essential crafted from premium denim with a touch of stretch for comfortable all-day wear. The slim silhouette from hip to ankle creates a clean, modern look that pairs with any top.",
          price: 1999.00, cat: "Jeans", subcategory: "Slim Fit Jeans",
          brand: "Levi's", gender: "men", occasion: "casual",
          style: "slim fit", material: "denim",
          rating: 4.6, review_count: 891, is_featured: true,
          img: "https://images.unsplash.com/photo-1542272604-780c8e5016f4?w=500&auto=format&fit=crop&q=60",
          tags: ["slim fit", "blue", "denim", "casual", "men", "stretchable", "everyday", "versatile", "5-pocket"],
          variants: [
            { size: "28", color: "Blue", stock: 25 },
            { size: "30", color: "Blue", stock: 42 },
            { size: "32", color: "Blue", stock: 55 },
            { size: "34", color: "Blue", stock: 48 },
            { size: "36", color: "Blue", stock: 30 },
            { size: "38", color: "Blue", stock: 15 },
          ]
        },
        {
          name: "Distressed Black Denim Jeans",
          description: "Make a style statement with these distressed black slim fit jeans from Jack & Jones. Strategic fading and rips at the knee give them an edgy, fashion-forward look. The stretchable fabric ensures comfort without compromising on style. Perfect for concerts, casual outings, and street-style looks.",
          price: 2299.00, cat: "Jeans", subcategory: "Slim Fit Jeans",
          brand: "Jack & Jones", gender: "men", occasion: "casual",
          style: "slim fit", material: "denim",
          rating: 4.4, review_count: 567, is_featured: false,
          img: "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=500&auto=format&fit=crop&q=60",
          tags: ["distressed", "black", "denim", "casual", "men", "ripped", "slim fit", "edgy", "street style"],
          variants: [
            { size: "28", color: "Black", stock: 20 },
            { size: "30", color: "Black", stock: 35 },
            { size: "32", color: "Black", stock: 45 },
            { size: "34", color: "Black", stock: 38 },
            { size: "36", color: "Black", stock: 22 },
          ]
        },
        {
          name: "High-Rise Flared Jeans",
          description: "A retro-inspired high-rise flared denim that is making a major comeback. The high waistband elongates the legs while the dramatic flare below the knee creates a vintage silhouette. Made from premium quality denim with a classic 5-pocket design. Style with a tucked-in top for the full 70s effect.",
          price: 1899.00, cat: "Jeans", subcategory: "Flared Jeans",
          brand: "Kraus", gender: "women", occasion: "casual",
          style: "flared", material: "denim",
          rating: 4.3, review_count: 324, is_featured: false,
          img: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&auto=format&fit=crop&q=60",
          tags: ["flared", "high rise", "blue", "denim", "casual", "women", "retro", "bell bottom", "vintage", "70s"],
          variants: [
            { size: "XS", color: "Blue", stock: 18 },
            { size: "S", color: "Blue", stock: 30 },
            { size: "M", color: "Blue", stock: 38 },
            { size: "L", color: "Blue", stock: 28 },
            { size: "XL", color: "Blue", stock: 15 },
            { size: "S", color: "Dark Blue", stock: 22 },
            { size: "M", color: "Dark Blue", stock: 28 },
          ]
        },
        {
          name: "Straight Cut Vintage Wash Jeans",
          description: "A rugged classic from Wrangler — straight cut jeans in a beautiful vintage wash finish. The slightly relaxed cut through the hip and thigh gives a comfortable fit without being baggy. The vintage wash gives these jeans a lived-in feel right out of the box. A true Western denim original.",
          price: 2499.00, cat: "Jeans", subcategory: "Straight Fit Jeans",
          brand: "Wrangler", gender: "men", occasion: "casual",
          style: "straight fit", material: "denim",
          rating: 4.3, review_count: 412, is_featured: false,
          img: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500&auto=format&fit=crop&q=60",
          tags: ["straight fit", "vintage", "blue", "denim", "casual", "men", "western", "classic", "wrangler"],
          variants: [
            { size: "30", color: "Vintage Blue", stock: 22 },
            { size: "32", color: "Vintage Blue", stock: 35 },
            { size: "34", color: "Vintage Blue", stock: 40 },
            { size: "36", color: "Vintage Blue", stock: 28 },
            { size: "38", color: "Vintage Blue", stock: 15 },
            { size: "32", color: "Dark Blue", stock: 25 },
            { size: "34", color: "Dark Blue", stock: 30 },
          ]
        },
        {
          name: "Skinny Stretch Blue Jeans",
          description: "The ultimate skinny jeans for women — super stretchy, ultra comfortable, and incredibly flattering. The second-skin fit highlights every curve while the high stretch content allows full range of movement. These jeans keep their shape wash after wash. Perfect with crop tops, knitwear, or oversized shirts.",
          price: 1499.00, cat: "Jeans", subcategory: "Skinny Jeans",
          brand: "H&M", gender: "women", occasion: "casual",
          style: "skinny", material: "denim",
          rating: 4.2, review_count: 748, is_featured: false,
          img: "https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=500&auto=format&fit=crop&q=60",
          tags: ["skinny", "stretch", "blue", "denim", "casual", "women", "stretchable", "affordable", "figure hugging"],
          variants: [
            { size: "XS", color: "Blue", stock: 30 },
            { size: "S", color: "Blue", stock: 48 },
            { size: "M", color: "Blue", stock: 55 },
            { size: "L", color: "Blue", stock: 40 },
            { size: "XL", color: "Blue", stock: 22 },
            { size: "S", color: "Black", stock: 35 },
            { size: "M", color: "Black", stock: 42 },
          ]
        },
        {
          name: "Boyfriend Ripped Jeans",
          description: "Channel effortless cool with these boyfriend-fit ripped jeans from Pepe Jeans. The relaxed, slouchy silhouette with strategic distressing and rips creates a casually cool aesthetic. Roll up the ankles for a more casual look. Pair with a fitted top and sneakers for the perfect weekend outfit.",
          price: 2799.00, cat: "Jeans", subcategory: "Boyfriend Jeans",
          brand: "Pepe Jeans", gender: "women", occasion: "casual",
          style: "boyfriend fit", material: "denim",
          rating: 4.4, review_count: 289, is_featured: false,
          img: "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=500&auto=format&fit=crop&q=60",
          tags: ["boyfriend fit", "ripped", "blue", "denim", "casual", "women", "distressed", "relaxed fit", "street style"],
          variants: [
            { size: "XS", color: "Light Blue", stock: 15 },
            { size: "S", color: "Light Blue", stock: 28 },
            { size: "M", color: "Light Blue", stock: 35 },
            { size: "L", color: "Light Blue", stock: 22 },
            { size: "S", color: "Blue", stock: 20 },
            { size: "M", color: "Blue", stock: 28 },
          ]
        },
        {
          name: "Women's White Slim Jeans",
          description: "Crisp, clean, and incredibly versatile — these white slim jeans from Levi's are a summer essential. The slim cut from waist to ankle creates a streamlined look. Perfect for pairing with colourful tops, stripes, or statement accessories. The premium denim fabric maintains its bright white colour wash after wash.",
          price: 2199.00, cat: "Jeans", subcategory: "Slim Fit Jeans",
          brand: "Levi's", gender: "women", occasion: "casual, office",
          style: "slim fit", material: "denim",
          rating: 4.3, review_count: 215, is_featured: false,
          img: "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=500&auto=format&fit=crop&q=60",
          tags: ["white", "slim fit", "denim", "casual", "office", "women", "clean look", "summer", "versatile"],
          variants: [
            { size: "XS", color: "White", stock: 18 },
            { size: "S", color: "White", stock: 30 },
            { size: "M", color: "White", stock: 38 },
            { size: "L", color: "White", stock: 25 },
            { size: "XL", color: "White", stock: 12 },
          ]
        },
        {
          name: "Men's Dark Wash Regular Jeans",
          description: "Classic comfort meets versatile style in these dark wash regular fit jeans from Lee. The clean, dark indigo wash looks equally sharp at the office or on weekends. A straight leg from knee to hem with a comfortable fit through the seat and thigh. A true wardrobe staple.",
          price: 2499.00, cat: "Jeans", subcategory: "Regular Fit Jeans",
          brand: "Lee", gender: "men", occasion: "casual, office",
          style: "regular fit", material: "denim",
          rating: 4.4, review_count: 334, is_featured: false,
          img: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&auto=format&fit=crop&q=60",
          tags: ["dark wash", "regular fit", "blue", "denim", "casual", "office", "men", "indigo", "versatile", "clean"],
          variants: [
            { size: "30", color: "Dark Blue", stock: 25 },
            { size: "32", color: "Dark Blue", stock: 40 },
            { size: "34", color: "Dark Blue", stock: 45 },
            { size: "36", color: "Dark Blue", stock: 32 },
            { size: "38", color: "Dark Blue", stock: 18 },
          ]
        },
        {
          name: "Women's High Waist Mom Jeans",
          description: "The iconic mom jeans from Marks & Spencer are back and better than ever. A high waist with a tapered leg creates a flattering vintage silhouette. The light blue wash and slightly relaxed fit through the hips and thighs are hallmarks of the original mom jean style. Tucked-in everything looks great with these.",
          price: 2699.00, cat: "Jeans", subcategory: "Mom Jeans",
          brand: "Marks & Spencer", gender: "women", occasion: "casual",
          style: "mom fit", material: "denim",
          rating: 4.5, review_count: 178, is_featured: false,
          img: "https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=500&auto=format&fit=crop&q=60",
          tags: ["mom jeans", "high waist", "blue", "denim", "casual", "women", "90s", "vintage", "tapered", "retro"],
          variants: [
            { size: "XS", color: "Blue", stock: 14 },
            { size: "S", color: "Blue", stock: 25 },
            { size: "M", color: "Blue", stock: 32 },
            { size: "L", color: "Blue", stock: 24 },
            { size: "XL", color: "Blue", stock: 14 },
            { size: "S", color: "Light Blue", stock: 18 },
            { size: "M", color: "Light Blue", stock: 22 },
          ]
        },
        {
          name: "Men's Jogger Denim",
          description: "The perfect fusion of the comfort of joggers and the look of jeans. These denim joggers from Jack & Jones feature an elasticated waist, tapered leg, and ribbed cuffs for a sporty-casual look. The premium stretch denim fabric moves with you. Ideal for travel, casual days out, and relaxed work environments.",
          price: 1799.00, cat: "Jeans", subcategory: "Jogger Jeans",
          brand: "Jack & Jones", gender: "men", occasion: "casual",
          style: "jogger fit", material: "denim",
          rating: 4.1, review_count: 246, is_featured: false,
          img: "https://images.unsplash.com/photo-1553143820-6bb68bc89cd1?w=500&auto=format&fit=crop&q=60",
          tags: ["jogger", "slim fit", "denim", "casual", "men", "stretchable", "sporty", "elasticated waist", "tapered"],
          variants: [
            { size: "28", color: "Black", stock: 22 },
            { size: "30", color: "Black", stock: 38 },
            { size: "32", color: "Black", stock: 42 },
            { size: "34", color: "Black", stock: 28 },
            { size: "30", color: "Dark Blue", stock: 25 },
            { size: "32", color: "Dark Blue", stock: 35 },
          ]
        },

        // ─── ETHNIC WEAR ──────────────────────────────────────────────────────
        {
          name: "Silk Embroidered Kurta Set",
          description: "An exquisite silk embroidered kurta set from Biba — a celebration of Indian craftsmanship. The rich silk fabric with intricate thread embroidery at the neckline and hem creates a look of understated luxury. Comes as a complete set with matching dupatta and bottom. Perfect for festivals, family celebrations, and puja occasions.",
          price: 3499.00, cat: "Ethnic Wear", subcategory: "Kurta Sets",
          brand: "Biba", gender: "women", occasion: "festive, casual, puja",
          style: "straight kurta", material: "silk",
          rating: 4.6, review_count: 287, is_featured: true,
          img: "https://images.unsplash.com/photo-1583391733958-d25e07fac0ec?w=500&auto=format&fit=crop&q=60",
          tags: ["silk", "embroidered", "kurta", "festive", "casual", "ethnic", "traditional", "women", "dupatta set", "kurti"],
          variants: [
            { size: "XS", color: "Blue", stock: 12 },
            { size: "S", color: "Blue", stock: 22 },
            { size: "M", color: "Blue", stock: 28 },
            { size: "L", color: "Blue", stock: 20 },
            { size: "XL", color: "Blue", stock: 12 },
            { size: "M", color: "Green", stock: 20 },
            { size: "L", color: "Green", stock: 18 },
            { size: "M", color: "Pink", stock: 22 },
            { size: "L", color: "Pink", stock: 18 },
          ]
        },
        {
          name: "Cotton Printed Saree",
          description: "A beautiful hand-printed cotton saree from Suta — celebrating the art of traditional Indian textile. The lightweight and breathable cotton fabric drapes gracefully and is perfect for everyday wear, festivals, and casual occasions. Each saree is hand-printed making every piece unique. Comes with matching blouse piece.",
          price: 1599.00, cat: "Ethnic Wear", subcategory: "Sarees",
          brand: "Suta", gender: "women", occasion: "casual, festive, office",
          style: "saree", material: "cotton",
          rating: 4.5, review_count: 456, is_featured: false,
          img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=60",
          tags: ["saree", "cotton", "printed", "casual", "festive", "traditional", "ethnic", "women", "handprinted", "everyday"],
          variants: [
            { size: "Free Size", color: "Blue", stock: 25 },
            { size: "Free Size", color: "Yellow", stock: 20 },
            { size: "Free Size", color: "Pink", stock: 30 },
            { size: "Free Size", color: "Green", stock: 22 },
          ]
        },
        {
          name: "Men's Festive Kurta Pajama Set",
          description: "Celebrate in style with this elegant festive kurta pajama set from Manyavar. The breathable cotton fabric with subtle self-design weaving looks sophisticated without being overly formal. The full set includes a knee-length kurta and matching straight pajama. Perfect for Diwali, Eid, weddings as a guest, and family gatherings.",
          price: 2199.00, cat: "Ethnic Wear", subcategory: "Kurta Pajamas",
          brand: "Manyavar", gender: "men", occasion: "festive, casual, puja",
          style: "kurta pajama", material: "cotton",
          rating: 4.5, review_count: 378, is_featured: false,
          img: "https://images.unsplash.com/photo-1603415526960-f7e0328c63b1?w=500&auto=format&fit=crop&q=60",
          tags: ["kurta", "pajama", "festive", "casual", "ethnic", "traditional", "men", "cotton", "diwali", "eid"],
          variants: [
            { size: "S", color: "White", stock: 25 },
            { size: "M", color: "White", stock: 38 },
            { size: "L", color: "White", stock: 42 },
            { size: "XL", color: "White", stock: 28 },
            { size: "XXL", color: "White", stock: 14 },
            { size: "M", color: "Cream", stock: 22 },
            { size: "L", color: "Cream", stock: 28 },
            { size: "M", color: "Blue", stock: 18 },
          ]
        },
        {
          name: "Designer Lehenga Choli",
          description: "A breathtaking designer lehenga choli from Kalki that is fit for a modern Indian bride or wedding guest. The rich fabric is adorned with intricate zari embroidery and stone work. The full circle skirt, embellished choli, and matching dupatta create a complete bridal look. A showstopper at every wedding.",
          price: 8999.00, cat: "Ethnic Wear", subcategory: "Lehenga Choli",
          brand: "Kalki", gender: "women", occasion: "wedding, festive, bridal",
          style: "lehenga", material: "silk",
          rating: 4.8, review_count: 134, is_featured: true,
          img: "https://images.unsplash.com/photo-1613206484394-b2586bf7fbfa?w=500&auto=format&fit=crop&q=60",
          tags: ["lehenga", "choli", "wedding", "festive", "bridal", "ethnic", "designer", "women", "silk", "embroidered", "zari"],
          variants: [
            { size: "XS", color: "Red", stock: 8 },
            { size: "S", color: "Red", stock: 14 },
            { size: "M", color: "Red", stock: 18 },
            { size: "L", color: "Red", stock: 12 },
            { size: "S", color: "Pink", stock: 10 },
            { size: "M", color: "Pink", stock: 15 },
            { size: "M", color: "Maroon", stock: 12 },
            { size: "S", color: "Green", stock: 8 },
            { size: "M", color: "Green", stock: 10 },
          ]
        },
        {
          name: "Anarkali Floor Length Suit",
          description: "Graceful and majestic, this floor-length Anarkali suit from W is a celebration of Indian fashion. The flowing silhouette with a fitted bodice and dramatic flare creates an elegant look for festive seasons. The rich georgette fabric drapes beautifully and the vibrant colours make a stunning statement.",
          price: 2799.00, cat: "Ethnic Wear", subcategory: "Anarkali Suits",
          brand: "W", gender: "women", occasion: "festive, casual, wedding guest",
          style: "anarkali", material: "georgette",
          rating: 4.4, review_count: 198, is_featured: false,
          img: "https://images.unsplash.com/photo-1617197505420-7bc38dca57b6?w=500&auto=format&fit=crop&q=60",
          tags: ["anarkali", "suit", "festive", "casual", "ethnic", "traditional", "women", "georgette", "floor length", "flared"],
          variants: [
            { size: "XS", color: "Magenta", stock: 12 },
            { size: "S", color: "Magenta", stock: 20 },
            { size: "M", color: "Magenta", stock: 25 },
            { size: "L", color: "Magenta", stock: 18 },
            { size: "M", color: "Royal Blue", stock: 20 },
            { size: "L", color: "Royal Blue", stock: 16 },
            { size: "M", color: "Mustard", stock: 18 },
          ]
        },
        {
          name: "Phulkari Cotton Kurti",
          description: "A vibrant Phulkari embroidered cotton kurti from Global Desi — a wearable piece of Punjab's rich folk art. The colourful floral thread embroidery on breathable cotton makes it perfect for everyday wear and casual outings. A comfortable straight cut that pairs beautifully with leggings, jeans, or palazzos.",
          price: 1299.00, cat: "Ethnic Wear", subcategory: "Kurtis",
          brand: "Global Desi", gender: "women", occasion: "casual, festive",
          style: "straight kurti", material: "cotton",
          rating: 4.4, review_count: 523, is_featured: false,
          img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=500&auto=format&fit=crop&q=60",
          tags: ["phulkari", "kurti", "casual", "cotton", "ethnic", "embroidered", "women", "everyday", "punjabi", "colorful"],
          variants: [
            { size: "XS", color: "Peach", stock: 18 },
            { size: "S", color: "Peach", stock: 32 },
            { size: "M", color: "Peach", stock: 40 },
            { size: "L", color: "Peach", stock: 28 },
            { size: "XL", color: "Peach", stock: 16 },
            { size: "XXL", color: "Peach", stock: 10 },
            { size: "M", color: "White", stock: 28 },
            { size: "L", color: "White", stock: 22 },
            { size: "M", color: "Yellow", stock: 22 },
          ]
        },
        {
          name: "Men's Wedding Sherwani Set",
          description: "An opulent men's sherwani set from Manyavar crafted for the groom who wants to make an unforgettable impression. Rich silk fabric adorned with intricate zardozi embroidery in gold thread, paired with matching churidar and dupatta. A complete bridal look that embodies regal Indian style.",
          price: 14999.00, cat: "Ethnic Wear", subcategory: "Sherwanis",
          brand: "Manyavar", gender: "men", occasion: "wedding, festive",
          style: "sherwani", material: "silk",
          rating: 4.8, review_count: 89, is_featured: true,
          img: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=500&auto=format&fit=crop&q=60",
          tags: ["sherwani", "wedding", "festive", "groom", "ethnic", "traditional", "men", "silk", "embroidered", "bridal", "zardozi"],
          variants: [
            { size: "S", color: "Cream Gold", stock: 8 },
            { size: "M", color: "Cream Gold", stock: 14 },
            { size: "L", color: "Cream Gold", stock: 16 },
            { size: "XL", color: "Cream Gold", stock: 10 },
            { size: "XXL", color: "Cream Gold", stock: 6 },
            { size: "M", color: "Navy Gold", stock: 10 },
            { size: "L", color: "Navy Gold", stock: 12 },
            { size: "M", color: "Maroon Gold", stock: 8 },
          ]
        },
        {
          name: "Chanderi Cotton Saree",
          description: "The Chanderi cotton saree from Suta — a luxury fabric with a centuries-old heritage from Madhya Pradesh. This handwoven saree has a signature silky texture with a subtle sheen from the blended zari threads. Lightweight, elegant, and versatile enough for casual lunches or office days. Comes with an unstitched blouse piece.",
          price: 2499.00, cat: "Ethnic Wear", subcategory: "Sarees",
          brand: "Suta", gender: "women", occasion: "casual, festive, office",
          style: "saree", material: "chanderi",
          rating: 4.6, review_count: 201, is_featured: false,
          img: "https://images.unsplash.com/photo-1617627143233-ab7d25842427?w=500&auto=format&fit=crop&q=60",
          tags: ["saree", "chanderi", "cotton", "casual", "festive", "office", "ethnic", "traditional", "women", "handwoven", "luxury"],
          variants: [
            { size: "Free Size", color: "Ivory", stock: 18 },
            { size: "Free Size", color: "Sage Green", stock: 15 },
            { size: "Free Size", color: "Powder Blue", stock: 20 },
          ]
        },
        {
          name: "Bandhani Print Kurti",
          description: "A vibrant Bandhani (tie-dye) kurti from FabIndia celebrating the rich textile tradition of Rajasthan and Gujarat. The hand-crafted tie-dye pattern creates a mesmerising circular motif unique to each piece. Made from breathable cotton for all-day comfort. Pairs perfectly with palazzos or churidars.",
          price: 1899.00, cat: "Ethnic Wear", subcategory: "Kurtis",
          brand: "FabIndia", gender: "women", occasion: "casual, festive",
          style: "straight kurti", material: "cotton",
          rating: 4.3, review_count: 312, is_featured: false,
          img: "https://images.unsplash.com/photo-1583744946564-b49f32f4a0d6?w=500&auto=format&fit=crop&q=60",
          tags: ["bandhani", "kurti", "tie dye", "casual", "festive", "cotton", "ethnic", "women", "rajasthani", "handcraft"],
          variants: [
            { size: "XS", color: "Multicolor", stock: 14 },
            { size: "S", color: "Multicolor", stock: 25 },
            { size: "M", color: "Multicolor", stock: 32 },
            { size: "L", color: "Multicolor", stock: 24 },
            { size: "XL", color: "Multicolor", stock: 14 },
            { size: "M", color: "Red", stock: 18 },
            { size: "L", color: "Red", stock: 15 },
          ]
        },
        {
          name: "Men's Nehru Jacket",
          description: "The timeless Nehru jacket from Manyavar — a quintessentially Indian garment that adds instant class to any ethnic or fusion outfit. The mandarin collar, slim fit, and subtle textured fabric make it a versatile layering piece. Wear over a kurta for traditional events or over a crisp white shirt for a fusion look.",
          price: 3499.00, cat: "Ethnic Wear", subcategory: "Nehru Jackets",
          brand: "Manyavar", gender: "men", occasion: "festive, casual, formal",
          style: "nehru jacket", material: "polyester",
          rating: 4.5, review_count: 167, is_featured: false,
          img: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=60",
          tags: ["nehru jacket", "festive", "casual", "ethnic", "formal", "men", "stylish", "classic", "mandarin collar", "fusion"],
          variants: [
            { size: "S", color: "Navy Blue", stock: 20 },
            { size: "M", color: "Navy Blue", stock: 30 },
            { size: "L", color: "Navy Blue", stock: 28 },
            { size: "XL", color: "Navy Blue", stock: 18 },
            { size: "M", color: "Black", stock: 22 },
            { size: "L", color: "Black", stock: 20 },
            { size: "M", color: "Maroon", stock: 15 },
          ]
        },

        // ─── ACCESSORIES ──────────────────────────────────────────────────────
        {
          name: "Leather Crossbody Bag",
          description: "A stunning hand-stitched full-grain leather crossbody bag from Hidesign — India's premium leather brand. The spacious interior with multiple compartments keeps you organised, while the adjustable strap allows versatile styling. Ages beautifully with use, developing a rich patina over time. Perfect for work and casual outings.",
          price: 2999.00, cat: "Accessories", subcategory: "Handbags",
          brand: "Hidesign", gender: "women", occasion: "casual, office, formal",
          style: "crossbody", material: "leather",
          rating: 4.7, review_count: 312, is_featured: true,
          img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&auto=format&fit=crop&q=60",
          tags: ["bag", "crossbody", "leather", "casual", "office", "women", "handbag", "premium", "genuine leather", "work bag"],
          variants: [
            { size: "Free Size", color: "Tan", stock: 25 },
            { size: "Free Size", color: "Black", stock: 30 },
            { size: "Free Size", color: "Brown", stock: 20 },
          ]
        },
        {
          name: "Polarized Aviator Sunglasses",
          description: "The iconic Ray-Ban aviator sunglasses — a timeless design that has defined cool for over 80 years. Polarized lenses provide 100% UV protection while eliminating glare for crystal-clear vision. The teardrop lens shape and thin metal frame suit all face shapes. A style icon that never goes out of fashion.",
          price: 6999.00, cat: "Accessories", subcategory: "Sunglasses",
          brand: "Ray-Ban", gender: "unisex", occasion: "casual, summer, outdoor",
          style: "aviator", material: "metal",
          rating: 4.8, review_count: 678, is_featured: true,
          img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format&fit=crop&q=60",
          tags: ["sunglasses", "aviator", "polarized", "casual", "summer", "unisex", "premium", "uv protection", "iconic", "outdoor"],
          variants: [
            { size: "Free Size", color: "Gold Brown", stock: 30 },
            { size: "Free Size", color: "Silver", stock: 25 },
            { size: "Free Size", color: "Black", stock: 35 },
          ]
        },
        {
          name: "Minimalist Analog Watch",
          description: "A sophisticated minimalist analog watch from Fossil that speaks volumes through simplicity. The clean dial with slim hands and a durable stainless steel case looks equally elegant with formal and casual outfits. Water resistant up to 30 metres. An everyday luxury that lasts a lifetime.",
          price: 8999.00, cat: "Accessories", subcategory: "Watches",
          brand: "Fossil", gender: "unisex", occasion: "casual, formal, office",
          style: "analog", material: "stainless steel",
          rating: 4.7, review_count: 445, is_featured: true,
          img: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&auto=format&fit=crop&q=60",
          tags: ["watch", "analog", "minimalist", "casual", "formal", "office", "premium", "unisex", "stainless steel", "water resistant"],
          variants: [
            { size: "Free Size", color: "Silver", stock: 22 },
            { size: "Free Size", color: "Gold", stock: 18 },
            { size: "Free Size", color: "Black", stock: 25 },
          ]
        },
        {
          name: "Woven Leather Belt",
          description: "A classic woven leather belt from Tommy Hilfiger that adds a touch of designer style to any outfit. The premium full-grain leather with a woven pattern provides durability and a sophisticated aesthetic. The polished silver buckle completes the look. Suitable for formal trousers and casual jeans alike.",
          price: 1499.00, cat: "Accessories", subcategory: "Belts",
          brand: "Tommy Hilfiger", gender: "men", occasion: "formal, casual, office",
          style: "belt", material: "leather",
          rating: 4.4, review_count: 234, is_featured: false,
          img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60",
          tags: ["belt", "leather", "formal", "casual", "men", "woven", "classic", "office", "designer"],
          variants: [
            { size: "28", color: "Black", stock: 20 },
            { size: "30", color: "Black", stock: 30 },
            { size: "32", color: "Black", stock: 35 },
            { size: "34", color: "Black", stock: 28 },
            { size: "36", color: "Black", stock: 20 },
            { size: "38", color: "Black", stock: 12 },
            { size: "32", color: "Brown", stock: 22 },
            { size: "34", color: "Brown", stock: 18 },
          ]
        },
        {
          name: "Sterling Silver Jhumka Earrings",
          description: "Handcrafted sterling silver jhumka earrings from Tribe Amrapali — inspired by centuries of Indian jewellery tradition. Each jhumka features intricate filigree work and delicate bell detailing that moves gracefully. The oxidised silver finish adds a vintage charm. Perfect for kurtis, sarees, and fusion outfits.",
          price: 1299.00, cat: "Accessories", subcategory: "Earrings",
          brand: "Tribe Amrapali", gender: "women", occasion: "festive, casual, traditional",
          style: "jhumka", material: "silver",
          rating: 4.6, review_count: 389, is_featured: false,
          img: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&auto=format&fit=crop&q=60",
          tags: ["earrings", "jhumka", "silver", "festive", "traditional", "ethnic", "women", "handcrafted", "jhumki", "jewelry"],
          variants: [
            { size: "Free Size", color: "Silver", stock: 40 },
            { size: "Free Size", color: "Oxidised Silver", stock: 35 },
          ]
        },
        {
          name: "Gold Plated Choker Necklace",
          description: "A stunning gold plated choker necklace set from Voylla — a perfect blend of contemporary design and traditional opulence. The layered design with kundan stones and a matching maang tikka creates a complete festive look. The anti-tarnish coating ensures lasting shine. Ideal for weddings, festivals, and parties.",
          price: 999.00, cat: "Accessories", subcategory: "Necklaces",
          brand: "Voylla", gender: "women", occasion: "festive, party, wedding",
          style: "choker", material: "gold plated",
          rating: 4.3, review_count: 512, is_featured: false,
          img: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=500&auto=format&fit=crop&q=60",
          tags: ["necklace", "choker", "gold plated", "festive", "party", "women", "fashion jewelry", "wedding", "kundan"],
          variants: [
            { size: "Free Size", color: "Gold", stock: 45 },
            { size: "Free Size", color: "Rose Gold", stock: 35 },
          ]
        },
        {
          name: "Canvas Tote Bag",
          description: "A practical and stylish canvas tote bag from The House of Tara. Made from sturdy natural canvas with reinforced stitching and comfortable cotton rope handles. The spacious interior easily accommodates a laptop, books, or groceries. Eco-friendly and reusable — a conscious fashion choice for the modern woman.",
          price: 699.00, cat: "Accessories", subcategory: "Tote Bags",
          brand: "The House of Tara", gender: "women", occasion: "casual, office, everyday",
          style: "tote", material: "canvas",
          rating: 4.5, review_count: 623, is_featured: false,
          img: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=500&auto=format&fit=crop&q=60",
          tags: ["tote bag", "canvas", "casual", "office", "women", "eco friendly", "everyday", "laptop bag", "work bag", "affordable"],
          variants: [
            { size: "Free Size", color: "Natural", stock: 55 },
            { size: "Free Size", color: "Black", stock: 45 },
            { size: "Free Size", color: "Navy", stock: 40 },
          ]
        },
        {
          name: "Genuine Leather Bifold Wallet",
          description: "A slim and practical bifold wallet from Woodland crafted from 100% genuine full-grain leather. Features multiple card slots, a clear ID window, and a spacious note compartment. The structured design maintains its shape while remaining slim enough for front-pocket carry. Develops a beautiful patina over the years.",
          price: 1199.00, cat: "Accessories", subcategory: "Wallets",
          brand: "Woodland", gender: "men", occasion: "formal, casual, everyday",
          style: "bifold wallet", material: "leather",
          rating: 4.4, review_count: 478, is_featured: false,
          img: "https://images.unsplash.com/photo-1627123424574-724758594785?w=500&auto=format&fit=crop&q=60",
          tags: ["wallet", "leather", "bifold", "formal", "casual", "men", "genuine leather", "everyday", "card holder", "slim"],
          variants: [
            { size: "Free Size", color: "Tan", stock: 35 },
            { size: "Free Size", color: "Black", stock: 42 },
            { size: "Free Size", color: "Dark Brown", stock: 28 },
          ]
        },
        {
          name: "Floral Charm Bracelet Set",
          description: "A delightful set of three floral charm bracelets from Zaveri Pearls — stackable, dainty, and endlessly versatile. Featuring enamel flowers, pearls, and crystal charms on a slim bangle-style base. Wear together for a layered boho look or separately for everyday elegance. A perfect gift for any occasion.",
          price: 799.00, cat: "Accessories", subcategory: "Bracelets",
          brand: "Zaveri Pearls", gender: "women", occasion: "casual, festive, party",
          style: "charm bracelet", material: "alloy",
          rating: 4.2, review_count: 356, is_featured: false,
          img: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&auto=format&fit=crop&q=60",
          tags: ["bracelet", "charm", "floral", "casual", "festive", "party", "women", "fashion jewelry", "stackable", "gift"],
          variants: [
            { size: "Free Size", color: "Gold", stock: 48 },
            { size: "Free Size", color: "Rose Gold", stock: 40 },
            { size: "Free Size", color: "Silver", stock: 35 },
          ]
        },
        {
          name: "Pure Silk Stole Dupatta",
          description: "A luxurious pure silk dupatta from FabIndia — an essential ethnic accessory that elevates any outfit. The natural silk lustre and smooth drape add an air of elegance to kurtis, salwar suits, and sarees. Hand-woven with delicate border detailing. Available in rich festive colours that complement a wide range of outfits.",
          price: 1299.00, cat: "Accessories", subcategory: "Dupattas",
          brand: "FabIndia", gender: "women", occasion: "festive, casual, traditional",
          style: "dupatta", material: "silk",
          rating: 4.5, review_count: 198, is_featured: false,
          img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=60",
          tags: ["dupatta", "silk", "festive", "casual", "ethnic", "traditional", "women", "stole", "scarf", "handwoven"],
          variants: [
            { size: "Free Size", color: "Red", stock: 25 },
            { size: "Free Size", color: "Blue", stock: 22 },
            { size: "Free Size", color: "Green", stock: 20 },
            { size: "Free Size", color: "Gold", stock: 18 },
            { size: "Free Size", color: "Pink", stock: 24 },
          ]
        },
      ];

      for (let i = 0; i < seedProducts.length; i++) {
        const p = seedProducts[i];
        const prodRes = await client.query(
          `INSERT INTO products (name, description, price, category_id, subcategory, brand, gender, occasion, style, material, rating, review_count, is_featured, image_url, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
          [
            p.name, p.description, p.price, catMap[p.cat],
            p.subcategory, p.brand, p.gender, p.occasion,
            p.style, p.material, p.rating, p.review_count,
            p.is_featured || false, p.img, p.tags
          ]
        );
        const productId = prodRes.rows[0].id;

        for (let j = 0; j < p.variants.length; j++) {
          const v = p.variants[j];
          const colorCode = v.color.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10);
          const sku = `SKU-${productId.substring(0, 8)}-${v.size}-${colorCode}-${j}`;
          await client.query(
            `INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (sku) DO NOTHING`,
            [productId, v.size, v.color, v.stock, sku]
          );
        }
      }

      console.log(`Seeded ${seedProducts.length} products with rich metadata.`);
    }

    console.log('Product DB initialization complete.');
  } catch (err) {
    console.error('Error initializing Product DB:', err);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
  pool
};
