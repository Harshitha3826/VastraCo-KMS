import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

const ProductCard = ({ product }) => {
  const rating      = product.rating ? Number(product.rating) : null;
  const reviewCount = product.review_count || 0;

  return (
    <div className="group relative bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
      <Link to={`/products/${product.id}`} className="block">
        <div className="aspect-[4/5] overflow-hidden bg-gray-100">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </Link>

      {product.is_featured && (
        <span className="absolute top-2 left-2 bg-brand-accent text-brand-dark text-xs font-bold px-2 py-0.5 rounded">
          Featured
        </span>
      )}

      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-gray-500 mb-1">{product.brand}</p>

        <h3 className="text-sm font-medium text-gray-900 mb-2 leading-snug line-clamp-2">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>

        <div className="mt-auto">
          {rating !== null && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="text-xs text-gray-400">({reviewCount})</span>
              )}
            </div>
          )}
          <p className="text-lg font-semibold text-brand-dark">₹{Number(product.price).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
