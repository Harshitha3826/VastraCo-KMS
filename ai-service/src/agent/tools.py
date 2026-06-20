import json
import logging
from typing import Optional

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Module-level category ID cache (populated on first use, stable for service lifetime)
_cat_id_cache: dict[str, int] = {}


async def _resolve_category_id(name: str, product_service_url: str) -> Optional[int]:
    key = name.lower()
    if key in _cat_id_cache:
        return _cat_id_cache[key]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{product_service_url}/api/categories")
            if resp.status_code == 200:
                for cat in resp.json():
                    _cat_id_cache[cat["name"].lower()] = cat["id"]
                return _cat_id_cache.get(key)
    except Exception as e:
        logger.warning(f"Category resolution failed: {e}")
    return None


def create_tools(
    product_service_url: str,
    order_service_url: str,
    user_token: Optional[str] = None,
) -> list:
    """Create tool functions with service URLs and user token bound in closures."""

    @tool
    async def search_products(
        search: Optional[str] = None,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        gender: Optional[str] = None,
        occasion: Optional[str] = None,
        material: Optional[str] = None,
        color: Optional[str] = None,
        sort: str = "newest",
        limit: int = 6,
    ) -> str:
        """
        Search VastraCo's product catalog. Call this for ANY product discovery request.

        Args:
            search: Free-text keyword (name, brand, style, material). E.g. "cotton kurti", "slim jeans"
            category: Exact category name — one of: "Men's Shirts", "Women's Dresses", "Jeans", "Ethnic Wear", "Accessories"
            min_price: Minimum price in INR (inclusive)
            max_price: Maximum price in INR (inclusive)
            gender: "men", "women", or "unisex"
            occasion: Occasion tag. E.g. "casual", "formal", "wedding", "festive", "office", "party", "evening"
            material: Fabric type. E.g. "cotton", "silk", "denim", "linen", "polyester"
            color: Colour name. E.g. "black", "blue", "white", "red", "green"
            sort: One of "newest", "price_asc", "price_desc", "rating", "popularity"
            limit: Max results to return (1-10)
        """
        try:
            params: dict = {"sort": sort, "limit": min(max(1, limit), 10)}
            if search:
                params["search"] = search
            if min_price is not None:
                params["min_price"] = min_price
            if max_price is not None:
                params["max_price"] = max_price
            if gender:
                params["gender"] = gender.lower()
            if occasion:
                params["occasion"] = occasion
            if material:
                params["material"] = material
            if color:
                params["color"] = color

            if category:
                cat_id = await _resolve_category_id(category, product_service_url)
                if cat_id:
                    params["category"] = cat_id
                elif not search:
                    params["search"] = category

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{product_service_url}/api/products", params=params)
                resp.raise_for_status()
                data = resp.json()

            products = data.get("products", [])
            total = data.get("total", 0)

            if not products:
                return json.dumps({
                    "products": [],
                    "total": 0,
                    "message": "No products found matching these criteria.",
                })

            slim = [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "brand": p.get("brand", ""),
                    "price": float(p["price"]),
                    "category": p.get("category_name", ""),
                    "rating": float(p["rating"]) if p.get("rating") else None,
                    "material": p.get("material"),
                    "occasion": p.get("occasion"),
                    "image_url": p.get("image_url", ""),
                    "tags": p.get("tags", []),
                }
                for p in products
            ]

            return json.dumps({"products": slim, "total": total})

        except httpx.RequestError as e:
            logger.error(f"search_products network error: {e}")
            return json.dumps({"error": "Product service is temporarily unavailable.", "products": []})
        except Exception as e:
            logger.error(f"search_products error: {e}", exc_info=True)
            return json.dumps({"error": "Could not search products.", "products": []})

    @tool
    async def get_categories() -> str:
        """Get all available product categories in VastraCo's catalog."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(f"{product_service_url}/api/categories")
                resp.raise_for_status()
                return json.dumps(resp.json())
        except Exception as e:
            logger.error(f"get_categories error: {e}")
            return json.dumps({"error": "Could not fetch categories."})

    @tool
    async def get_return_policy() -> str:
        """Get VastraCo's full return, refund, exchange, and cancellation policy."""
        policy = {
            "return_window": "7 days from delivery date",
            "conditions": [
                "Item must be unused and unwashed",
                "Original tags must be attached",
                "Original packaging preferred but not mandatory",
            ],
            "non_returnable_categories": [
                "Sarees and lehengas",
                "Sherwanis and ethnic occasion wear",
                "Jewellery (earrings, necklaces, bracelets)",
                "Wallets, belts, and sunglasses",
                "Undergarments and innerwear",
                "Personalised or customised items",
            ],
            "refund_timeline": "5-7 business days to the original payment method",
            "exchange_policy": "Size or colour exchange available within 7 days for eligible items",
            "order_cancellation": "Only orders with 'pending' status can be cancelled by the customer",
            "contact": "support@vastraco.com for all return/refund queries",
        }
        return json.dumps(policy)

    tools = [search_products, get_categories, get_return_policy]

    if user_token:
        @tool
        async def get_user_orders() -> str:
            """
            Get all orders placed by the currently logged-in user.
            Use this when the user asks about their orders, order history, or latest order.
            Returns orders sorted newest first.
            """
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{order_service_url}/api/orders",
                        headers={"Authorization": f"Bearer {user_token}"},
                    )
                    if resp.status_code == 401:
                        return json.dumps({"error": "Authentication required. Please log in to view orders."})
                    resp.raise_for_status()
                    orders = resp.json()

                if not orders:
                    return json.dumps({"orders": [], "message": "No orders found for this account."})

                slim = [
                    {
                        "id": o["id"],
                        "status": o["status"],
                        "total_amount": float(o["total_amount"]),
                        "created_at": o["created_at"],
                        "item_count": len(o.get("items", [])),
                        "items": [
                            {
                                "product_name": i["product_name"],
                                "quantity": i["quantity"],
                                "size": i.get("size"),
                                "color": i.get("color"),
                                "unit_price": float(i["unit_price"]),
                            }
                            for i in o.get("items", [])
                        ],
                        "shipping_address": o.get("shipping_address", {}),
                    }
                    for o in orders
                ]
                return json.dumps({"orders": slim, "total": len(slim)})

            except httpx.HTTPStatusError as e:
                logger.error(f"get_user_orders HTTP error: {e}")
                return json.dumps({"error": "Could not fetch orders."})
            except Exception as e:
                logger.error(f"get_user_orders error: {e}", exc_info=True)
                return json.dumps({"error": "Order service is temporarily unavailable."})

        @tool
        async def get_order_by_id(order_id: str) -> str:
            """
            Get full details of a specific order by its ID.
            Use this when the user references a specific order ID.

            Args:
                order_id: The UUID of the order (e.g. "a1b2c3d4-...")
            """
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{order_service_url}/api/orders/{order_id}",
                        headers={"Authorization": f"Bearer {user_token}"},
                    )
                    if resp.status_code == 404:
                        return json.dumps({"error": "Order not found."})
                    if resp.status_code == 401:
                        return json.dumps({"error": "Authentication required."})
                    resp.raise_for_status()
                    o = resp.json()

                return json.dumps({
                    "id": o["id"],
                    "status": o["status"],
                    "total_amount": float(o["total_amount"]),
                    "created_at": o["created_at"],
                    "updated_at": o.get("updated_at"),
                    "items": o.get("items", []),
                    "shipping_address": o.get("shipping_address", {}),
                })
            except Exception as e:
                logger.error(f"get_order_by_id error: {e}", exc_info=True)
                return json.dumps({"error": "Could not fetch order details."})

        tools.extend([get_user_orders, get_order_by_id])

    return tools
